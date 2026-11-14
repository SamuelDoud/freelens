/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export interface AppearancePreferences {
  /** The opacity of the application's windows, from `minOpacity` to 1 */
  readonly windowOpacity: number;
  /** The font of the interface; empty for the default */
  readonly fontFamily: string;
  /** The base font size of the interface, in pixels */
  readonly fontSize: number;
  /** The opacity of the background of dropdowns and menus, from `minOpacity` to 1 */
  readonly dropdownOpacity: number;
}

export const minOpacity = 0.3;
export const minFontSize = 10;
export const maxFontSize = 22;

export const defaultAppearance: AppearancePreferences = {
  windowOpacity: 1,
  fontFamily: "",
  fontSize: 14,
  dropdownOpacity: 1,
};

const clamp = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

/** The appearance in a stored value, with every field in range. */
export function readAppearance(value: unknown): AppearancePreferences {
  const stored = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;

  return {
    windowOpacity: clamp(stored.windowOpacity, minOpacity, 1, defaultAppearance.windowOpacity),
    fontFamily: typeof stored.fontFamily === "string" ? stored.fontFamily.trim() : defaultAppearance.fontFamily,
    fontSize: clamp(stored.fontSize, minFontSize, maxFontSize, defaultAppearance.fontSize),
    dropdownOpacity: clamp(stored.dropdownOpacity, minOpacity, 1, defaultAppearance.dropdownOpacity),
  };
}

/** What to store: nothing when everything is the default. */
export function storeAppearance(value: AppearancePreferences): Partial<AppearancePreferences> | undefined {
  const changed = Object.fromEntries(
    Object.entries(value).filter(([key, field]) => field !== defaultAppearance[key as keyof AppearancePreferences]),
  );

  return Object.keys(changed).length ? changed : undefined;
}

/** The CSS font stack for a chosen font, falling back to the default fonts. */
export const fontStack = (fontFamily: string) =>
  `${fontFamily ? `"${fontFamily.replace(/"/g, "")}", ` : ""}"Roboto", "Helvetica", "Arial", sans-serif`;
