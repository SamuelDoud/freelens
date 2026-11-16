/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sortBy } from "es-toolkit/compat";
import { describe, expect, it } from "vitest";
import { getCellOrder } from "./cell-order";

// How the cells of a row were put in order: sorted for every row, content and all.
const sortedBefore = (listCells: string[], columns: { priority: number; content: string }[]) =>
  sortBy(
    [
      ...listCells.map((content, index) => ({ priority: 20 - index, content })),
      ...columns.map((col) => ({ priority: col.priority, content: col.content })),
    ],
    (item) => -item.priority,
  ).map((value) => value.content);

describe("getCellOrder", () => {
  it("orders the cells as sorting them for every row did, ties included", () => {
    let seed = 9;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;

      return seed / 4294967296;
    };

    for (let round = 0; round < 300; round++) {
      const listCells = Array.from({ length: Math.floor(next() * 8) }, (_, index) => `l${index}`);
      const columns = Array.from({ length: Math.floor(next() * 8) }, (_, index) => ({
        priority: Math.floor(next() * 25) - 2,
        content: `c${index}`,
      }));
      const cells = [...listCells, ...columns.map((col) => col.content)];
      const order = getCellOrder(
        listCells.length,
        columns.map((col) => col.priority),
      );

      expect(order.map((position) => cells[position])).toStrictEqual(sortedBefore(listCells, columns));
    }
  });
});
