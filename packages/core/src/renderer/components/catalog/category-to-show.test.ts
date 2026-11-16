/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { categoryToSwitchTo } from "./category-to-show";

import type { CatalogCategory } from "../../../common/catalog";

const category = (id: string) => ({ getId: () => id }) as unknown as CatalogCategory;

describe("categoryToSwitchTo", () => {
  const a = category("a");
  const b = category("b");

  it("switches to the first visible category when the shown one was filtered out", () => {
    expect(categoryToSwitchTo(category("hidden"), [a, b], false)).toBe(a);
  });

  it("stays on a shown category that is not the first", () => {
    expect(categoryToSwitchTo(b, [a, b], false)).toBeUndefined();
  });

  it("does not switch while browsing everything", () => {
    expect(categoryToSwitchTo(category("hidden"), [a], true)).toBeUndefined();
  });
});
