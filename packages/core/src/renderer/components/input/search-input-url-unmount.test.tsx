/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { act, fireEvent } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import { renderFor } from "../test-utils/renderFor";
import { SearchInputUrl } from "./search-input-url";
import searchUrlPageParamInjectable from "./search-url-page-param.injectable";

describe("SearchInputUrl", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not put text typed on a list into the page that replaced it", () => {
    const di = getDiForUnitTesting();
    const searchUrlParam = di.inject(searchUrlPageParamInjectable);
    const { container, unmount } = renderFor(di)(<SearchInputUrl placeholder="Search Pods..." />);

    fireEvent.change(container.querySelector("input")!, { target: { value: "nginx" } });
    unmount();

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(searchUrlParam.get()).toBe("");
  });
});
