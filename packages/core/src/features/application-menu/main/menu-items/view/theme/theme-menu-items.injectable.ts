/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed, runInAction } from "mobx";
import { defaultColorThemePreference } from "../../../../../../common/vars";
import { getThemePalette } from "../../../../../theme/palettes/common/palettes";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";
import applicationMenuItemInjectionToken from "../../application-menu-item-injection-token";
import { getApplicationMenuSeparatorInjectable } from "../../get-application-menu-separator-injectable";

// View → Theme: the theme (auto, light, dark) and the color palette, the same
// two preferences that Preferences → Application → Theme sets.

export const themeSeparatorForViewInjectable = getApplicationMenuSeparatorInjectable({
  id: "separator-4-for-view",
  parentId: "view",
  orderNumber: 140,
});

export const themeSubMenuInjectable = getInjectable({
  id: "theme-sub-menu",
  instantiate: () => ({
    kind: "sub-menu" as const,
    parentId: "view",
    id: "theme",
    orderNumber: 150,
    label: "Theme",
  }),
  injectionToken: applicationMenuItemInjectionToken,
});

// The values of the colorTheme preference: "system" follows the operating
// system, and the built-in themes are named "Light" and "Dark".
const getThemeModeMenuItemInjectable = (colorTheme: string, label: string, orderNumber: number) =>
  getInjectable({
    id: `theme-mode-menu-item-${colorTheme}`,
    instantiate: (di) => {
      const state = di.inject(userPreferencesStateInjectable);

      return {
        kind: "radio-menu-item" as const,
        parentId: "theme",
        id: `theme-mode-${colorTheme.toLowerCase()}`,
        orderNumber,
        label,
        isChecked: computed(() => (state.colorTheme || defaultColorThemePreference) === colorTheme),
        onClick: () => runInAction(() => (state.colorTheme = colorTheme)),
      };
    },
    injectionToken: applicationMenuItemInjectionToken,
  });

export const autoThemeMenuItemInjectable = getThemeModeMenuItemInjectable(
  defaultColorThemePreference,
  "Auto (sync with computer)",
  10,
);
export const lightThemeMenuItemInjectable = getThemeModeMenuItemInjectable("Light", "Light", 20);
export const darkThemeMenuItemInjectable = getThemeModeMenuItemInjectable("Dark", "Dark", 30);

export const themePaletteSeparatorInjectable = getApplicationMenuSeparatorInjectable({
  id: "separator-for-theme-palettes",
  parentId: "theme",
  orderNumber: 40,
});

const getPaletteMenuItemInjectable = (paletteId: string, orderNumber: number) => {
  const palette = getThemePalette(paletteId);

  if (palette.id !== paletteId) {
    throw new Error(`No color palette "${paletteId}" for the Theme menu`);
  }

  return getInjectable({
    id: `theme-palette-menu-item-${paletteId}`,
    instantiate: (di) => {
      const state = di.inject(userPreferencesStateInjectable);

      return {
        kind: "radio-menu-item" as const,
        parentId: "theme",
        id: `theme-palette-${paletteId}`,
        orderNumber,
        label: palette.name,
        isChecked: computed(() => getThemePalette(state.colorPalette).id === paletteId),
        onClick: () => runInAction(() => (state.colorPalette = paletteId)),
      };
    },
    injectionToken: applicationMenuItemInjectionToken,
  });
};

export const freelensPaletteMenuItemInjectable = getPaletteMenuItemInjectable("freelens", 50);
export const oceanPaletteMenuItemInjectable = getPaletteMenuItemInjectable("ocean", 60);
export const forestPaletteMenuItemInjectable = getPaletteMenuItemInjectable("forest", 70);
export const sunsetPaletteMenuItemInjectable = getPaletteMenuItemInjectable("sunset", 80);
export const graphitePaletteMenuItemInjectable = getPaletteMenuItemInjectable("graphite", 90);
export const highContrastPaletteMenuItemInjectable = getPaletteMenuItemInjectable("high-contrast", 100);
