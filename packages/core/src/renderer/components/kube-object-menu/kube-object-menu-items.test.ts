/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "@freelensapp/kube-object";
import { getInjectable } from "@ogre-tools/injectable";
import { computed, observable, runInAction } from "mobx";
import { beforeEach, describe, expect, it } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import { kubeObjectMenuItemInjectionToken } from "./kube-object-menu-item-injection-token";
import kubeObjectMenuItemsInjectable from "./kube-object-menu-items.injectable";

import type { DiContainer } from "@ogre-tools/injectable";

const makeObject = (kind: string, apiVersion: string, uid: string) =>
  new KubeObject({
    apiVersion,
    kind,
    metadata: { name: uid, uid, selfLink: `/${uid}`, resourceVersion: "1" },
  } as never);

const item = (id: string, kind: string, apiVersions: string[], orderNumber: number, enabled = computed(() => true)) => {
  const Component = () => null;

  return {
    Component,
    injectable: getInjectable({
      id,
      instantiate: () => ({ kind, apiVersions, Component, enabled, orderNumber }),
      injectionToken: kubeObjectMenuItemInjectionToken,
    }),
  };
};

describe("kube-object-menu-items", () => {
  let di: DiContainer;
  const enabled = observable.box(true);
  const podLate = item("pod-late", "SomePod", ["v1"], 5);
  const podEarly = item("pod-early", "SomePod", ["v1"], 1);
  const podOtherVersion = item("pod-other-version", "SomePod", ["v2"], 3);
  const podDisabled = item(
    "pod-disabled",
    "SomePod",
    ["v1"],
    2,
    computed(() => enabled.get()),
  );
  const node = item("node", "SomeNode", ["v1"], 1);

  beforeEach(() => {
    di = getDiForUnitTesting();
    enabled.set(true);

    runInAction(() => {
      di.register(
        podLate.injectable,
        podEarly.injectable,
        podOtherVersion.injectable,
        podDisabled.injectable,
        node.injectable,
      );
    });
  });

  it("gives every object of a kind the same items, sorted, whatever its uid", () => {
    const a = di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v1", "uid-a")).get();
    const b = di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v1", "uid-b")).get();

    expect(a).toEqual([podEarly.Component, podDisabled.Component, podLate.Component]);
    expect(b).toEqual(a);
  });

  it("keeps kinds and api versions apart", () => {
    expect(di.inject(kubeObjectMenuItemsInjectable, makeObject("SomeNode", "v1", "n")).get()).toEqual([node.Component]);
    expect(di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v2", "p")).get()).toEqual([
      podOtherVersion.Component,
    ]);
    expect(di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v3", "p")).get()).toEqual([]);
    expect(di.inject(kubeObjectMenuItemsInjectable, undefined as never).get()).toEqual([]);
  });

  it("shares one instance per kind and api version", () => {
    const a = di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v1", "uid-a"));

    expect(di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v1", "uid-b"))).toBe(a);
    expect(di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v2", "uid-a"))).not.toBe(a);
  });

  it("follows the enabled state of an item", () => {
    const items = di.inject(kubeObjectMenuItemsInjectable, makeObject("SomePod", "v1", "uid-a"));

    runInAction(() => enabled.set(false));

    expect(items.get()).toEqual([podEarly.Component, podLate.Component]);
  });
});
