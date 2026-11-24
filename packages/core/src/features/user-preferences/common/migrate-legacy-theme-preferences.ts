/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { defaultThemePreference } from "../../../common/vars";

import type { UserPreferencesModel } from "./preferences-helpers";

/**
 * The preferences as Freelens stored them before themes became files, which had a single
 * `colorTheme`, `"system"`, `"Dark"` or `"Light"`, and a terminal theme that named the same themes.
 */
export type LegacyThemePreferences = UserPreferencesModel & {
  colorTheme?: string;
  /** The color palette of the fork's versions before 2.6.1, laid over the default theme. */
  colorPalette?: string;
};

/**
 * The palettes of the fork before 2.6.1. Each is now a built-in theme of the same name; "freelens"
 * was the default theme itself.
 */
const forkPaletteThemes: ReadonlySet<string> = new Set(["ocean", "forest", "sunset", "graphite", "high-contrast"]);

/**
 * Turns the theme preferences of an earlier Freelens into a theme and a variant, so that an
 * update changes nothing visible:
 *
 * - `colorTheme` `"system"` becomes the `System` variant of the built-in theme, `"Dark"` and
 *   `"Light"` its `Dark` and `Light` variant. Any other value used to fall back to the default
 *   theme, which was the dark one.
 * - `terminalTheme` `"Dark"` and `"Light"` become the matching variant of the built-in theme. Any
 *   other value that is not a theme name used to match the application theme, and still does.
 *
 * - The fork's `colorPalette` becomes the built-in theme of the same name, in the variant that
 *   `colorTheme` gives.
 *
 * Preferences that already have a theme or a variant are not touched, and `colorTheme` and
 * `colorPalette` are dropped: the next write of the preferences no longer has them.
 */
export const migrateLegacyThemePreferences = (preferences: LegacyThemePreferences): UserPreferencesModel => {
  const { colorTheme, colorPalette, ...result } = preferences;

  if (result.theme === undefined && result.themeVariant === undefined) {
    if (colorTheme !== undefined) {
      result.theme = defaultThemePreference;
      result.themeVariant = colorTheme === "system" ? "system" : colorTheme === "Light" ? "light" : "dark";
    }

    if (colorPalette !== undefined && forkPaletteThemes.has(colorPalette)) {
      result.theme = colorPalette;
    }
  }

  if (result.terminalTheme === "Dark" || result.terminalTheme === "Light") {
    result.terminalThemeVariant = result.terminalTheme === "Light" ? "light" : "dark";
    result.terminalTheme = defaultThemePreference;
  }

  return result;
};
