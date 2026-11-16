/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { CatalogCategory } from "../../../common/catalog";

/**
 * The category to switch to when the one shown is no longer among the visible
 * categories, or none is shown yet; nothing when the shown one stays.
 */
export function categoryToSwitchTo(
  current: Pick<CatalogCategory, "getId"> | undefined,
  categories: readonly CatalogCategory[],
  isBrowsing: boolean,
): CatalogCategory | undefined {
  const [first] = categories;

  if (isBrowsing || !first) {
    return undefined;
  }

  const currentStillShown = current && categories.some((item) => item.getId() === current.getId());

  return currentStillShown ? undefined : first;
}
