/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { ConfigMap } from "./specifics/config-map";
import { Pod } from "./specifics/pod";
import { Secret } from "./specifics/secret";

const metadata = { name: "a", namespace: "ns", uid: "u1", selfLink: "/x", resourceVersion: "1", creationTimestamp: "" };
const pod = () => new Pod({ apiVersion: "v1", kind: "Pod", metadata: { ...metadata, labels: { a: "b" } } });

describe("lazily bound KubeObject methods", () => {
  it("keeps detached calls working", () => {
    const p = pod();
    const { getName, getNs, getLabels } = p;

    expect(getName()).toBe("a");
    expect(getNs()).toBe("ns");
    expect(getLabels()).toEqual(["a=b"]);
  });

  it("passes a method as a callback", () => {
    const pods = [pod(), pod()];

    expect(pods.map((p) => p.getId).map((f) => f())).toEqual(["u1", "u1"]);
  });

  it("returns the same function on every read of an instance", () => {
    const p = pod();

    expect(p.getName).toBe(p.getName);
    expect(pod().getName).not.toBe(p.getName);
  });

  it("binds to the instance it was read from, not to another instance", () => {
    const a = pod();
    const b = new Pod({ ...a, metadata: { ...metadata, name: "b" } } as never);

    expect(a.getName()).toBe("a");
    expect(b.getName()).toBe("b");
  });

  it("does not copy bound methods when cloning with the constructor", () => {
    const a = pod();

    a.getName();

    const copy = new Pod(a as never);

    copy.metadata = { ...metadata, name: "copy" };
    expect(copy.getName()).toBe("copy");
  });

  it("leaves own keys data only", () => {
    const p = pod();

    p.getName();
    p.getNs();

    expect(Object.keys(p).sort()).toEqual(["apiVersion", "kind", "metadata", "spec", "status"]);
    expect({ ...p }).not.toHaveProperty("getName");
  });

  it("uses the most derived definition (Pod overrides)", () => {
    const p = pod();

    expect(p.getSelectedNodeOs).toBe(p.getSelectedNodeOs);
    expect(p.getId()).toBe("u1");
  });

  it("works for subclasses with own fields", () => {
    const secret = new Secret({
      apiVersion: "v1",
      kind: "Secret",
      metadata,
      data: { k: "v" },
      type: "Opaque",
    } as never);
    const configMap = new ConfigMap({ apiVersion: "v1", kind: "ConfigMap", metadata, data: { k: "v" } } as never);
    const { getName } = secret;

    expect(getName()).toBe("a");
    expect(secret.data).toEqual({ k: "v" });
    expect(configMap.getKeys()).toEqual(["k"]);
  });

  it("lets a subclass of a subclass override and call super", () => {
    class MyPod extends Pod {
      getName() {
        return `my-${super.getName()}`;
      }
    }

    const plain = pod();
    const mine = new MyPod({ apiVersion: "v1", kind: "Pod", metadata });

    expect(plain.getName()).toBe("a");
    expect(mine.getName()).toBe("my-a");

    const { getName } = mine;

    expect(getName()).toBe("my-a");
    // Instance created from the base class first, then the derived one, and the other way round.
    expect(new Pod({ apiVersion: "v1", kind: "Pod", metadata }).getName()).toBe("a");
    expect(new MyPod({ apiVersion: "v1", kind: "Pod", metadata }).getName()).toBe("my-a");
  });

  it("keeps assignment to a method name as an own property", () => {
    const p = pod();

    (p as any).getName = () => "custom";

    expect(p.getName()).toBe("custom");
    expect(pod().getName()).toBe("a");
  });

  it("reads the plain method from the prototype", () => {
    pod();

    expect(Pod.prototype.getName.call({ metadata: { name: "z" } })).toBe("z");
  });

  it("still works on a frozen instance", () => {
    const p = Object.freeze(pod());

    expect(p.getName()).toBe("a");
  });

  it("serialises to the same JSON", () => {
    const p = pod();

    p.getName();

    expect(JSON.parse(JSON.stringify(p))).toEqual({ apiVersion: "v1", kind: "Pod", metadata: p.metadata });
  });

  describe("spies and replacements", () => {
    it("lets vi.spyOn on an instance see later calls, and restores", () => {
      const p = pod();
      const spy = vi.spyOn(p, "getName");

      expect(p.getName()).toBe("a");
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();

      expect(p.getName()).toBe("a");
      expect(Object.getOwnPropertyDescriptor(p, "getName")?.get).toBeUndefined();
    });

    it("lets vi.spyOn on an instance that already cached its method", () => {
      const p = pod();

      p.getName();

      const spy = vi.spyOn(p, "getName").mockReturnValue("mocked");

      expect(p.getName()).toBe("mocked");
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("keeps the spy on one instance away from others", () => {
      const a = pod();
      const b = pod();
      const spy = vi.spyOn(a, "getName");

      b.getName();
      a.getName();

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("lets plain assignment replace a method, before and after the first read", () => {
      const before = pod();
      const after = pod();

      after.getName();
      (before as any).getName = () => "x";
      (after as any).getName = () => "y";

      expect(before.getName()).toBe("x");
      expect(after.getName()).toBe("y");
    });

    it("sees a prototype spy installed before any instance exists", () => {
      class Fresh extends Pod {}

      const spy = vi.spyOn(Fresh.prototype, "getName").mockReturnValue("proto");
      const p = new Fresh({ apiVersion: "v1", kind: "Pod", metadata });

      expect(p.getName()).toBe("proto");
      expect(spy).toHaveBeenCalledTimes(1);
      spy.mockRestore();
    });

    it("lets a prototype spy installed later reach instances that have not cached the method, not the ones that have", () => {
      class Later extends Pod {}

      const cached = new Later({ apiVersion: "v1", kind: "Pod", metadata });
      const uncached = new Later({ apiVersion: "v1", kind: "Pod", metadata });

      cached.getName();

      const spy = vi.spyOn(Later.prototype, "getName").mockReturnValue("proto");

      // Eager binding gave every instance its own bound copy at construction, so none saw the spy;
      // here only an instance that has not read the method yet does.
      expect(cached.getName()).toBe("a");
      expect(uncached.getName()).toBe("proto");
      expect(new Later({ apiVersion: "v1", kind: "Pod", metadata }).getName()).toBe("proto");

      spy.mockRestore();

      expect(new Later({ apiVersion: "v1", kind: "Pod", metadata }).getName()).toBe("a");
    });
  });
});
