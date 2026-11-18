/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { TableCellProps } from "@freelensapp/list-layout";

/** The least a column of text needs to be readable. */
export const minColumnWidth = 90;
/** The least a column that holds an icon needs. */
export const minIconColumnWidth = 44;
/** The least the name column needs; it also takes the space the others leave. */
export const minNameColumnWidth = 160;

/**
 * Room the table spends outside its columns: the menu cell, the padding of a selectable table and
 * the scrollbar of the list.
 */
export const tableChromeWidth = 55 + 16 + 15;
export const checkboxCellWidth = 32;
/** The cell that opens a row's details and the cell that opens the side panel. */
export const expansionCellsWidth = 28 + 28;

export function getColumnMinWidth(header: TableCellProps): number {
  if (header.id === "name") {
    return minNameColumnWidth;
  }

  return typeof header.title === "string" && header.title !== "" ? minColumnWidth : minIconColumnWidth;
}

export interface FitColumnsOptions {
  /** The header cells in the order of their priority, highest first. */
  headers: readonly (TableCellProps | undefined | null)[];
  /** The width of the table, in pixels; when it is not known every column is shown. */
  width: number | undefined;
  /** Whether the user's own setting hides a column. */
  isHiddenByUser: (header: TableCellProps) => boolean;
  /**
   * The ids of the columns, the ones to keep longest first. It ranks the columns for fitting only,
   * the display order stays that of `headers`. Columns it does not name come after the ones it
   * names, in the order of `headers`.
   */
  keepOrder?: readonly string[];
  /** The width the cells outside the headers take, such as the checkbox of a row. */
  extraWidth?: number;
}

/**
 * The ids of the columns left out because they do not fit in the width of the table.
 *
 * Columns are taken in priority order while their minimum widths add up to no more than the width
 * left by the columns that always show: the name column (the first column when there is none) and
 * the cells without an id. A column that does not fit ends the list: no lower priority column is
 * shown instead of it. A cell that is shown with another column goes with it. A column the user
 * hides takes no room and is never listed here, so this never changes what the user chose.
 */
export function getColumnsHiddenForSpace({
  headers,
  width,
  isHiddenByUser,
  extraWidth = 0,
  keepOrder = [],
}: FitColumnsOptions): ReadonlySet<string> {
  const hidden = new Set<string>();

  if (width === undefined) {
    return hidden;
  }

  const shown = headers.filter((header): header is TableCellProps => !!header && !isHiddenByUser(header));
  const columns = shown.filter((header) => header.id && !header.showWithColumn);
  const rank = (header: TableCellProps) => {
    const index = keepOrder.indexOf(header.id!);

    return index < 0 ? keepOrder.length : index;
  };
  const followers = new Map<string, TableCellProps[]>();
  let budget = width - tableChromeWidth - extraWidth;

  for (const header of shown) {
    if (!header.id) {
      budget -= getColumnMinWidth(header);
    } else if (header.showWithColumn) {
      const parent = columns.find((column) => column.id === header.showWithColumn);

      if (parent) {
        followers.set(header.showWithColumn, [...(followers.get(header.showWithColumn) ?? []), header]);
      } else {
        columns.push(header);
      }
    }
  }

  const cost = (header: TableCellProps) =>
    getColumnMinWidth(header) + (followers.get(header.id!) ?? []).reduce((sum, f) => sum + getColumnMinWidth(f), 0);
  const byKeepOrder = columns
    .map((header, position) => ({ header, position }))
    .sort((a, b) => rank(a.header) - rank(b.header) || a.position - b.position)
    .map(({ header }) => header);
  // The anchor takes the room the name column has, whichever column it is.
  const anchor = columns.find((header) => header.id === "name") ?? byKeepOrder[0];

  if (anchor) {
    budget -= Math.max(cost(anchor), minNameColumnWidth);
  }

  let full = false;

  for (const header of byKeepOrder) {
    if (header === anchor) {
      continue;
    }

    if (!full && cost(header) <= budget) {
      budget -= cost(header);
      continue;
    }

    full = true;
    hidden.add(header.id!);

    for (const follower of followers.get(header.id!) ?? []) {
      hidden.add(follower.id!);
    }
  }

  return hidden;
}
