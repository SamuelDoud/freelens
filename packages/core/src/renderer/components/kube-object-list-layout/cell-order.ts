/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sortBy } from "es-toolkit/compat";

/**
 * The positions of the cells of a row in the order they are shown: first the cells the list gives,
 * with priorities falling from 20, then the cells of the columns, with the priority each has; the
 * highest priority comes first, and equal priorities keep the order they were given in.
 */
export function getCellOrder(listCellCount: number, columnPriorities: readonly number[]): number[] {
  const priorities = [...Array.from({ length: listCellCount }, (_, index) => 20 - index), ...columnPriorities];

  return sortBy(
    priorities.map((priority, position) => ({ priority, position })),
    (entry) => -entry.priority,
  ).map((entry) => entry.position);
}
