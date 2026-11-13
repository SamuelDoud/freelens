/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { getThemePalette, themePalettes } from "../../features/theme/palettes/common/palettes";
import { applyThemePalette, contrastRatio, tintColor, tintedColorNames } from "./apply-theme-palette";
import lensDarkThemeInjectable from "./lens-dark.injectable";
import lensLightThemeInjectable from "./lens-light.injectable";

import type { LensColorName, LensTheme } from "./lens-theme";

const baseThemes: LensTheme[] = [
  lensDarkThemeInjectable.instantiate(undefined as never),
  lensLightThemeInjectable.instantiate(undefined as never),
];

const opaque = (color: string) => color.slice(0, 7);

// Where primary text sits: the pages, the panels, the sidebar, table rows.
const textSurfaces: LensColorName[] = [
  "mainBackground",
  "contentColor",
  "layoutBackground",
  "sidebarBackground",
  "tableBgcStripe",
];

describe("applyThemePalette", () => {
  it("leaves a theme as it is with the default palette", () => {
    for (const theme of baseThemes) {
      expect(applyThemePalette(theme, getThemePalette("freelens"))).toBe(theme);
    }
  });

  it("falls back to the default palette for an unknown id", () => {
    expect(getThemePalette("no-such-palette").id).toBe("freelens");
  });

  it.each(["ocean", "forest", "sunset"])("keeps the luminance and alpha of the surfaces %s tints", (id) => {
    const palette = getThemePalette(id);

    for (const theme of baseThemes) {
      const result = applyThemePalette(theme, palette);

      for (const name of tintedColorNames) {
        // Equal luminance is a contrast of 1:1; 8-bit channels round a little.
        expect(contrastRatio(opaque(result.colors[name]), opaque(theme.colors[name])), name).toBeLessThan(1.03);
        expect(result.colors[name].slice(7)).toBe(theme.colors[name].slice(7));
      }
    }
  });

  it("leaves colors that are not near grey as they are", () => {
    expect(tintColor("#00a7a0", { hue: 212, saturation: 0.22 })).toBe("#00a7a0");
    expect(tintColor("#808080", { hue: 212, saturation: 0.22 })).not.toBe("#808080");
  });

  it("puts the accent wherever the theme uses its primary color, and nowhere else", () => {
    const ocean = getThemePalette("ocean");

    for (const theme of baseThemes) {
      const result = applyThemePalette(theme, ocean);

      for (const [name, value] of Object.entries(theme.colors) as [LensColorName, string][]) {
        if (value.toLowerCase() === theme.colors.primary.toLowerCase()) {
          expect(result.colors[name]).toBe(ocean.accent?.[theme.type]);
        } else if (!tintedColorNames.includes(name)) {
          expect(result.colors[name]).toBe(value);
        }
      }
    }
  });

  describe.each(themePalettes.map((palette) => [palette.name, palette] as const))("the %s palette", (_, palette) => {
    it.each(baseThemes.map((theme) => [theme.name, theme] as const))(
      "keeps primary text readable on the %s theme",
      (__, theme) => {
        const result = applyThemePalette(theme, palette);

        for (const surface of textSurfaces) {
          const before = contrastRatio(opaque(theme.colors.textColorPrimary), opaque(theme.colors[surface]));
          const after = contrastRatio(opaque(result.colors.textColorPrimary), opaque(result.colors[surface]));

          // WCAG AA, or no worse than the theme itself where the theme is below it.
          expect(after, `textColorPrimary on ${surface}`).toBeGreaterThanOrEqual(Math.min(4.5, before * 0.95));
        }
      },
    );

    it.each(baseThemes.map((theme) => [theme.name, theme] as const))(
      "keeps white button text visible on its accent on the %s theme",
      (__, theme) => {
        const result = applyThemePalette(theme, palette);

        expect(contrastRatio("#ffffff", opaque(result.colors.buttonPrimaryBackground))).toBeGreaterThanOrEqual(
          Math.min(3, contrastRatio("#ffffff", opaque(theme.colors.buttonPrimaryBackground))),
        );
      },
    );
  });

  it("gives primary text at least 7:1 with the high contrast palette", () => {
    const highContrast = getThemePalette("high-contrast");

    for (const theme of baseThemes) {
      const result = applyThemePalette(theme, highContrast);

      for (const surface of ["mainBackground", "contentColor", "layoutBackground"] as const) {
        expect(
          contrastRatio(opaque(result.colors.textColorPrimary), opaque(result.colors[surface])),
          `${theme.name}: textColorPrimary on ${surface}`,
        ).toBeGreaterThanOrEqual(7);
      }
    }
  });

  it("knows the contrast of black and white", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  });
});
