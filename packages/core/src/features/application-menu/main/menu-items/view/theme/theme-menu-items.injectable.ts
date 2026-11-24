/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { computed, runInAction } from "mobx";
import { defaultThemePreference } from "../../../../../../common/vars";
import { findBuiltInTheme } from "../../../../../theme/files/common/builtin-theme";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";
import applicationMenuItemInjectionToken from "../../application-menu-item-injection-token";
import { getApplicationMenuSeparatorInjectable } from "../../get-application-menu-separator-injectable";

import type { ThemeVariantPreference } from "../../../../../user-preferences/common/preferences-helpers";

// View → Theme: the variant (system, light, dark) and the built-in theme, the same two preferences
// that Preferences → Personalization sets. Imported themes are chosen there.

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

const getThemeVariantMenuItemInjectable = (variant: ThemeVariantPreference, label: string, orderNumber: number) =>
  getInjectable({
    id: `theme-variant-menu-item-${variant}`,
    instantiate: (di) => {
      const state = di.inject(userPreferencesStateInjectable);

      return {
        kind: "radio-menu-item" as const,
        parentId: "theme",
        id: `theme-mode-${variant}`,
        orderNumber,
        label,
        isChecked: computed(() => state.themeVariant === variant),
        onClick: () => runInAction(() => (state.themeVariant = variant)),
      };
    },
    injectionToken: applicationMenuItemInjectionToken,
  });

export const systemThemeVariantMenuItemInjectable = getThemeVariantMenuItemInjectable(
  "system",
  "Auto (sync with computer)",
  10,
);
export const lightThemeVariantMenuItemInjectable = getThemeVariantMenuItemInjectable("light", "Light", 20);
export const darkThemeVariantMenuItemInjectable = getThemeVariantMenuItemInjectable("dark", "Dark", 30);

export const themeNamesSeparatorInjectable = getApplicationMenuSeparatorInjectable({
  id: "separator-for-theme-names",
  parentId: "theme",
  orderNumber: 40,
});

const getThemeMenuItemInjectable = (name: string, orderNumber: number) => {
  const theme = findBuiltInTheme(name);

  if (!theme) {
    throw new Error(`No built-in theme "${name}" for the Theme menu`);
  }

  return getInjectable({
    id: `theme-name-menu-item-${name}`,
    instantiate: (di) => {
      const state = di.inject(userPreferencesStateInjectable);

      return {
        kind: "radio-menu-item" as const,
        parentId: "theme",
        id: `theme-name-${name}`,
        orderNumber,
        label: theme.spec.displayName,
        isChecked: computed(() => (state.theme || defaultThemePreference) === name),
        onClick: () => runInAction(() => (state.theme = name)),
      };
    },
    injectionToken: applicationMenuItemInjectionToken,
  });
};

export const freelensThemeMenuItemInjectable = getThemeMenuItemInjectable("freelens", 50);
export const ayuThemeMenuItemInjectable = getThemeMenuItemInjectable("ayu", 60);
export const ayuMirageThemeMenuItemInjectable = getThemeMenuItemInjectable("ayu-mirage", 70);
export const catppuccinThemeMenuItemInjectable = getThemeMenuItemInjectable("catppuccin", 80);
export const draculaThemeMenuItemInjectable = getThemeMenuItemInjectable("dracula", 90);
export const graphiteThemeMenuItemInjectable = getThemeMenuItemInjectable("graphite", 100);
export const solarizedThemeMenuItemInjectable = getThemeMenuItemInjectable("solarized", 110);
export const oceanThemeMenuItemInjectable = getThemeMenuItemInjectable("ocean", 120);
export const forestThemeMenuItemInjectable = getThemeMenuItemInjectable("forest", 130);
export const sunsetThemeMenuItemInjectable = getThemeMenuItemInjectable("sunset", 140);
export const highContrastThemeMenuItemInjectable = getThemeMenuItemInjectable("high-contrast", 150);
