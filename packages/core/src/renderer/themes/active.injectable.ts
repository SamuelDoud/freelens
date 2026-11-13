/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "node:assert";
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { getThemePalette } from "../../features/theme/palettes/common/palettes";
import lensColorThemePreferenceInjectable from "../../features/user-preferences/common/lens-color-theme.injectable";
import userPreferencesStateInjectable from "../../features/user-preferences/common/state.injectable";
import { applyThemePalette } from "./apply-theme-palette";
import { lensThemeDeclarationInjectionToken } from "./declaration";
import defaultLensThemeInjectable from "./default-theme.injectable";
import systemThemeConfigurationInjectable from "./system-theme.injectable";
import lensThemesInjectable from "./themes.injectable";

import type { Injectable } from "@ogre-tools/injectable";
import type { IComputedValue } from "mobx";
import type { ReadonlyDeep } from "type-fest";

import type { LensTheme } from "./lens-theme";

// Annotated for declaration emit; see ./declaration.ts.
const activeThemeInjectable: Injectable<IComputedValue<ReadonlyDeep<LensTheme>>> = getInjectable({
  id: "active-theme",
  instantiate: (di) => {
    const lensThemes = di.inject(lensThemesInjectable);
    const themeDecls = di.injectMany(lensThemeDeclarationInjectionToken);
    const lensColorThemePreference = di.inject(lensColorThemePreferenceInjectable);
    const systemThemeConfiguration = di.inject(systemThemeConfigurationInjectable);
    const defaultLensTheme = di.inject(defaultLensThemeInjectable);

    const userPreferences = di.inject(userPreferencesStateInjectable);

    const baseTheme = computed(() => {
      const pref = lensColorThemePreference.get();

      if (pref.useSystemTheme) {
        const systemThemeType = systemThemeConfiguration.get();
        const matchingTheme = themeDecls.find((theme) => theme.type === systemThemeType);

        assert(matchingTheme, `Missing theme declaration for system theme "${systemThemeType}"`);

        return matchingTheme;
      }

      return lensThemes.get(pref.lensThemeId) ?? defaultLensTheme;
    });

    // The color palette the user picked, laid over the light or dark theme.
    return computed(() => applyThemePalette(baseTheme.get(), getThemePalette(userPreferences.colorPalette)));
  },
});

export default activeThemeInjectable;
