/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";

import { act, render } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { Observer } from "mobx-react";
import { describe, expect, it } from "vitest";
import { VirtualList } from "./virtual-list";

const items = Array.from({ length: 20 }, (_, index) => ({ getId: () => `id-${index}` }));
const heights = items.map(() => 15);

describe("VirtualList tracking of what getRow reads", () => {
  it("makes a row again when getRow reads an observable that changes, by default", () => {
    const labels = observable.map<string, string>({ "id-0": "first" });
    const result = render(
      <VirtualList
        items={items}
        rowHeights={heights}
        fixedHeight={45}
        getRow={(id) => <div data-testid={id}>{labels.get(id) ?? id}</div>}
      />,
    );

    expect(result.getByTestId("id-0")).toHaveTextContent("first");

    act(() => runInAction(() => labels.set("id-0", "second")));

    expect(result.getByTestId("id-0")).toHaveTextContent("second");
  });

  it("leaves tracking to the row when trackRowObservables is off: an Observer row still follows its observable", () => {
    const labels = observable.map<string, string>({ "id-0": "first" });
    let getRowCalls = 0;
    const result = render(
      <VirtualList
        items={items}
        rowHeights={heights}
        fixedHeight={45}
        trackRowObservables={false}
        getRow={(id) => {
          getRowCalls++;

          return (
            <div data-testid={id}>
              <Observer>{() => <>{labels.get(id) ?? id}</>}</Observer>
            </div>
          );
        }}
      />,
    );

    expect(result.getByTestId("id-0")).toHaveTextContent("first");

    const calls = getRowCalls;

    act(() => runInAction(() => labels.set("id-0", "second")));

    expect(result.getByTestId("id-0")).toHaveTextContent("second");
    // Only the Observer rendered again, not the list's row.
    expect(getRowCalls).toBe(calls);
  });
});
