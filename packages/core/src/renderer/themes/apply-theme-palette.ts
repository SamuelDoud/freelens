/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ReadonlyDeep } from "type-fest";

import type { ThemePalette } from "../../features/theme/palettes/common/palettes";
import type { LensColorName, LensTheme } from "./lens-theme";

/**
 * The surfaces and borders a palette's tint re-hues. Text, status colors and
 * the editor and log backgrounds keep the theme's colors.
 */
export const tintedColorNames: readonly LensColorName[] = [
  "mainBackground",
  "secondaryBackground",
  "contentColor",
  "layoutBackground",
  "layoutTabsBackground",
  "sidebarBackground",
  "sidebarLogoBackground",
  "sidebarItemHoverBackground",
  "buttonDefaultBackground",
  "tableBgcStripe",
  "tableBgcSelected",
  "tableHeaderBackground",
  "dockHeadBackground",
  "dockInfoBackground",
  "dockInfoBorderColor",
  "dockBadgeBackground",
  "dockTabBorderColor",
  "dockTabActiveBackground",
  "dialogBackground",
  "dialogFooterBackground",
  "drawerTogglerBackground",
  "drawerSubtitleBackground",
  "clusterMenuBackground",
  "clusterMenuBorderColor",
  "clusterMenuCellBackground",
  "clusterSettingsBackground",
  "filterAreaBackground",
  "inputControlBackground",
  "inputControlBorder",
  "inputControlHoverBorder",
  "lineProgressBackground",
  "radioActiveBackground",
  "menuSelectedOptionBgc",
  "settingsBackground",
  "navSelectedBackground",
  "tooltipBackground",
  "borderColor",
  "borderFaintColor",
  "colorVague",
  "logRowHoverBackground",
  "pieChartDefaultColor",
  "chartCapacityColor",
];

// Only colors this close to grey are tinted, so that a theme's deliberate
// colors survive a palette.
const maxTintedSaturation = 0.15;

interface Rgba {
  r: number;
  g: number;
  b: number;
  /** Two hex digits, or "" when the color has no alpha. */
  alpha: string;
}

const parseHexColor = (color: string): Rgba | undefined => {
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(color.trim());

  if (!match) {
    return undefined;
  }

  const hex = match[1].length === 3 ? [...match[1]].map((digit) => digit + digit).join("") : match[1];

  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
    alpha: hex.slice(6, 8),
  };
};

const toHex = ({ r, g, b, alpha }: Rgba) =>
  `#${[r, g, b].map((channel) => Math.round(channel).toString(16).padStart(2, "0")).join("")}${alpha}`;

const rgbToHsl = ({ r, g, b }: Rgba) => {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;
  const delta = max - min;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  return { saturation, lightness };
};

const hslToRgb = (hue: number, saturation: number, lightness: number) => {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const sector = (((hue % 360) + 360) % 360) / 60;
  const second = chroma * (1 - Math.abs((sector % 2) - 1));
  const [r, g, b] =
    sector < 1
      ? [chroma, second, 0]
      : sector < 2
        ? [second, chroma, 0]
        : sector < 3
          ? [0, chroma, second]
          : sector < 4
            ? [0, second, chroma]
            : sector < 5
              ? [second, 0, chroma]
              : [chroma, 0, second];
  const offset = lightness - chroma / 2;

  return { r: (r + offset) * 255, g: (g + offset) * 255, b: (b + offset) * 255 };
};

const luminanceOf = ({ r, g, b }: { r: number; g: number; b: number }) => {
  const [red, green, blue] = [r, g, b].map((channel) => {
    const value = channel / 255;

    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
};

const relativeLuminance = (color: string) => {
  const rgba = parseHexColor(color);

  if (!rgba) {
    throw new Error(`Not a hex color: ${color}`);
  }

  return luminanceOf(rgba);
};

/**
 * Gives a near-grey color the hue and saturation of a tint, keeping its alpha
 * and its relative luminance: the quantity contrast is computed from, so the
 * tinted color has the contrast with any other color that the grey had. (The
 * same HSL lightness would not do: a green looks brighter than a blue of the
 * same lightness.)
 */
export const tintColor = (color: string, tint: NonNullable<ThemePalette["tint"]>): string => {
  const rgba = parseHexColor(color);

  if (!rgba) {
    return color;
  }

  if (rgbToHsl(rgba).saturation > maxTintedSaturation) {
    return color;
  }

  // Luminance grows with the lightness of a fixed hue and saturation, so
  // bisect the lightness for the grey's luminance.
  const target = luminanceOf(rgba);
  let [low, high] = [0, 1];

  for (let step = 0; step < 24; step++) {
    const middle = (low + high) / 2;

    if (luminanceOf(hslToRgb(tint.hue, tint.saturation, middle)) < target) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return toHex({ ...hslToRgb(tint.hue, tint.saturation, (low + high) / 2), alpha: rgba.alpha });
};

/** The WCAG contrast ratio of two opaque hex colors, from 1 to 21. */
export const contrastRatio = (foreground: string, background: string): number => {
  const [lighter, darker] = [relativeLuminance(foreground), relativeLuminance(background)].sort((a, b) => b - a);

  return (lighter + 0.05) / (darker + 0.05);
};

/**
 * The theme with a palette laid over it: the grey surfaces tinted, the
 * theme's primary color replaced by the accent wherever the theme uses it,
 * and the palette's own colors for the theme's type set outright.
 */
export const applyThemePalette = (theme: ReadonlyDeep<LensTheme>, palette: ThemePalette): ReadonlyDeep<LensTheme> => {
  const { tint, accent, colors } = palette;

  if (!tint && !accent && !colors) {
    return theme;
  }

  const result: Record<string, string> = { ...theme.colors };

  if (tint) {
    for (const name of tintedColorNames) {
      result[name] = tintColor(theme.colors[name], tint);
    }
  }

  if (accent) {
    const primary = theme.colors.primary.toLowerCase();

    for (const [name, value] of Object.entries(theme.colors)) {
      if (value.toLowerCase() === primary) {
        result[name] = accent[theme.type];
      }
    }
  }

  for (const [name, value] of Object.entries(colors?.[theme.type] ?? {})) {
    if (name in result) {
      result[name] = value;
    }
  }

  return { ...theme, colors: result as LensTheme["colors"] };
};
