/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { autorun } from "mobx";
import { describe, expect, it, vi } from "vitest";
import { createObservableProps } from "../observable-props";

describe("createObservableProps", () => {
  it("reads the latest props", () => {
    const props = createObservableProps({ a: 1, b: "x" });

    expect(props.current.a).toBe(1);

    props.update({ a: 2, b: "x" });

    expect(props.current.a).toBe(2);
    expect("a" in props.current).toBe(true);
  });

  it("re-runs a derivation only when a prop it read changed", () => {
    const props = createObservableProps({ a: 1, b: 1 });
    const readA = vi.fn(() => props.current.a);
    const readB = vi.fn(() => props.current.b);
    const stopA = autorun(readA);
    const stopB = autorun(readB);

    props.update({ a: 1, b: 1 });
    expect([readA, readB].map((fn) => fn.mock.calls.length)).toEqual([1, 1]);

    props.update({ a: 2, b: 1 });
    expect([readA, readB].map((fn) => fn.mock.calls.length)).toEqual([2, 1]);

    props.update({ a: 2, b: 3 });
    expect([readA, readB].map((fn) => fn.mock.calls.length)).toEqual([2, 2]);

    stopA();
    stopB();
  });

  it("runs a derivation that reads several changed props once", () => {
    const props = createObservableProps({ a: 1, b: 1 });
    const read = vi.fn(() => props.current.a + props.current.b);
    const stop = autorun(read);

    props.update({ a: 2, b: 2 });

    expect(read).toHaveBeenCalledTimes(2);

    stop();
  });
});
