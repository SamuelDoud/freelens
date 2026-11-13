/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export type ThemePaletteType = "dark" | "light";

/**
 * A color palette laid over the active light or dark theme. The theme keeps
 * its layout of light and dark surfaces, and with it the contrast between
 * text and the surfaces it sits on; the palette changes their hue and the
 * accent color.
 */
export interface ThemePalette {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /**
   * The accent, per theme type. It replaces the theme's primary color wherever
   * the theme uses that color: buttons, links, the active menu item.
   */
  readonly accent?: Readonly<Record<ThemePaletteType, string>>;
  /**
   * Re-hues the theme's grey surfaces and borders, keeping the lightness of
   * each, so that they keep their contrast with the text. `saturation` is
   * between 0 (grey) and 1.
   */
  readonly tint?: { readonly hue: number; readonly saturation: number };
  /** Theme colors set outright, per theme type, after the tint and the accent. */
  readonly colors?: Readonly<Partial<Record<ThemePaletteType, Readonly<Record<string, string>>>>>;
}

export const defaultThemePaletteId = "freelens";

export const themePalettes: readonly ThemePalette[] = [
  {
    id: defaultThemePaletteId,
    name: "Freelens",
    description: "The colors of the theme itself.",
  },
  {
    id: "ocean",
    name: "Ocean",
    description: "Blue surfaces with a blue accent.",
    accent: { dark: "#3b8eea", light: "#0b62c4" },
    tint: { hue: 212, saturation: 0.22 },
  },
  {
    id: "forest",
    name: "Forest",
    description: "Green-grey surfaces with a green accent.",
    accent: { dark: "#2f9e6a", light: "#1f7a4d" },
    tint: { hue: 150, saturation: 0.14 },
  },
  {
    id: "sunset",
    name: "Sunset",
    description: "Warm surfaces with an orange accent.",
    accent: { dark: "#d9622b", light: "#b8430c" },
    tint: { hue: 22, saturation: 0.16 },
  },
  {
    id: "graphite",
    name: "Graphite",
    description: "Neutral grey surfaces with a slate accent.",
    accent: { dark: "#5f6f86", light: "#4b5563" },
    tint: { hue: 215, saturation: 0 },
  },
  {
    id: "high-contrast",
    name: "High contrast",
    description: "Black or white surfaces, stronger text and borders.",
    accent: { dark: "#1a7fff", light: "#0050b3" },
    tint: { hue: 0, saturation: 0 },
    colors: {
      dark: {
        mainBackground: "#000000",
        secondaryBackground: "#000000",
        contentColor: "#0a0a0a",
        layoutBackground: "#000000",
        layoutTabsBackground: "#000000",
        sidebarBackground: "#0a0a0a",
        tableHeaderBackground: "#000000",
        tableBgcStripe: "#121212",
        tableBgcSelected: "#1f3a5f",
        dialogBackground: "#0a0a0a",
        settingsBackground: "#0a0a0a",
        navSelectedBackground: "#0a0a0a",
        textColorPrimary: "#ffffff",
        textColorSecondary: "#f0f0f0",
        textColorTertiary: "#e6e6e6",
        textColorDimmed: "#cfcfcf",
        drawerItemNameColor: "#e6e6e6",
        drawerItemValueColor: "#ffffff",
        dialogTextColor: "#ffffff",
        settingsColor: "#ffffff",
        borderColor: "#bdbdbd",
        borderFaintColor: "#8a8a8a",
        inputControlBorder: "#bdbdbd",
      },
      light: {
        mainBackground: "#ffffff",
        secondaryBackground: "#ffffff",
        contentColor: "#ffffff",
        layoutBackground: "#ffffff",
        layoutTabsBackground: "#ffffff",
        sidebarBackground: "#f2f2f2",
        tableHeaderBackground: "#ffffff",
        tableBgcStripe: "#f2f2f2",
        tableBgcSelected: "#cce0ff",
        textColorPrimary: "#000000",
        textColorSecondary: "#111111",
        textColorTertiary: "#1a1a1a",
        textColorDimmed: "#333333",
        drawerItemNameColor: "#1a1a1a",
        drawerItemValueColor: "#000000",
        dialogTextColor: "#000000",
        settingsColor: "#000000",
        tableHeaderColor: "#000000",
        borderColor: "#4a4a4a",
        borderFaintColor: "#767676",
        inputControlBorder: "#4a4a4a",
      },
    },
  },
];

/** The palette with the given id, or the default palette for an unknown one. */
export const getThemePalette = (id: string | undefined): ThemePalette =>
  themePalettes.find((palette) => palette.id === id) ?? themePalettes[0];
