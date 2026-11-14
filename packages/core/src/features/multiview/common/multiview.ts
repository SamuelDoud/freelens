/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** How the clusters of a multiview share the window */
export type MultiViewLayout = "columns" | "rows" | "grid";

/** Several clusters shown at once, which the user names and pins like a cluster */
export interface MultiView {
  readonly id: string;
  readonly name: string;
  /** The clusters, in the order of their panes */
  readonly clusterIds: readonly string[];
  readonly layout: MultiViewLayout;
  /** The text of its icon; the initials of the name by default */
  readonly iconText?: string;
  /** The background colour of its icon */
  readonly iconBackground?: string;
}

export const multiViewLayouts: readonly { readonly id: MultiViewLayout; readonly label: string }[] = [
  { id: "columns", label: "Side by side" },
  { id: "rows", label: "Stacked" },
  { id: "grid", label: "Grid" },
];

export const multiViewPath = (id: string) => `/multiview/${id}`;
export const multiViewSettingsPath = (id: string) => `/multiview-settings/${id}`;

/** The id a new multiview's settings are opened with */
export const newMultiViewId = "new";

export const multiViewEntityId = (id: string) => `multiview-${id}`;

const isString = (value: unknown): value is string => typeof value === "string";

/** The multiviews in a stored value, leaving out what is not well-formed. */
export function readMultiViews(value: unknown): MultiView[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item): MultiView[] => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const { id, name, clusterIds, layout, iconText, iconBackground } = item as Record<string, unknown>;

    if (!isString(id) || !isString(name) || !Array.isArray(clusterIds)) {
      return [];
    }

    return [
      {
        id,
        name,
        clusterIds: clusterIds.filter(isString),
        layout: multiViewLayouts.some((option) => option.id === layout) ? (layout as MultiViewLayout) : "columns",
        ...(isString(iconText) && iconText ? { iconText } : {}),
        ...(isString(iconBackground) && iconBackground ? { iconBackground } : {}),
      },
    ];
  });
}

/** A pane's place in the area of a multiview, in percent of it */
export interface PaneRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Where each of `count` panes goes. A grid has as many columns as it takes to stay about square. */
export function paneRects(count: number, layout: MultiViewLayout): PaneRect[] {
  if (count <= 0) {
    return [];
  }

  const columns = layout === "columns" ? count : layout === "rows" ? 1 : Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);

  return Array.from({ length: count }, (_, index) => {
    const row = Math.floor(index / columns);
    const column = index % columns;
    // The last row of a grid shares its width among the panes it has.
    const inRow = row === rows - 1 ? count - row * columns : columns;

    return {
      left: (column * 100) / inRow,
      top: (row * 100) / rows,
      width: 100 / inRow,
      height: 100 / rows,
    };
  });
}
