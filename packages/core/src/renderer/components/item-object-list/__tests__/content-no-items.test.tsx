/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import { renderFor } from "../../test-utils/renderFor";
import { ItemListLayoutContent } from "../content";

import type { ItemObject } from "@freelensapp/list-layout";

const renderEmptyList = (props: Record<string, unknown>) =>
  renderFor(getDiForUnitTesting())(
    <ItemListLayoutContent<ItemObject, boolean>
      className=""
      getItems={() => []}
      getFilters={() => []}
      getIsReady={() => true}
      store={{ failedLoading: false, isSelected: () => false, pickOnlySelected: () => [] } as never}
      renderTableContents={() => []}
      renderTableHeader={[{ title: "Name", id: "name" }]}
      {...props}
    />,
  );

describe("<ItemListLayoutContent> with no items", () => {
  it("offers to reset when only advanced search conditions filter the list", () => {
    const resetAdvancedSearch = vi.fn();
    const { getByText } = renderEmptyList({ getHasAdvancedSearchFilter: () => true, resetAdvancedSearch });

    fireEvent.click(getByText("Reset filters?"));

    expect(resetAdvancedSearch).toHaveBeenCalledTimes(1);
  });

  it("does not offer to reset a list nothing filters", () => {
    const { queryByText } = renderEmptyList({ getHasAdvancedSearchFilter: () => false });

    expect(queryByText("Reset filters?")).toBeNull();
  });
});
