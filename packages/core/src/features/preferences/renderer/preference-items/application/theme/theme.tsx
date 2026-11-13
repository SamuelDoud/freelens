/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { defaultColorThemePreference } from "../../../../../../common/vars";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import { Select } from "../../../../../../renderer/components/select";
import { lensThemeDeclarationInjectionToken } from "../../../../../../renderer/themes/declaration";
import { defaultThemePaletteId, getThemePalette, themePalettes } from "../../../../../theme/palettes/common/palettes";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { LensTheme } from "../../../../../../renderer/themes/lens-theme";
import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
  themes: LensTheme[];
}

const paletteOptions = themePalettes.map((palette) => ({
  value: palette.id,
  label: palette.name,
}));

const NonInjectedTheme = observer(({ state, themes }: Dependencies) => {
  const themeOptions = [
    {
      value: defaultColorThemePreference,
      label: "Auto (sync with computer)",
    },
    ...themes.map((theme) => ({
      value: theme.name,
      label: theme.name,
    })),
  ];

  return (
    <section id="appearance">
      <SubTitle title="Theme" />
      <Select
        id="theme-input"
        options={themeOptions}
        value={state.colorTheme}
        onChange={(value) => (state.colorTheme = value?.value ?? defaultColorThemePreference)}
        themeName="lens"
      />
      <SubTitle title="Color palette" />
      <Select
        id="color-palette-input"
        options={paletteOptions}
        value={state.colorPalette}
        onChange={(value) => (state.colorPalette = value?.value ?? defaultThemePaletteId)}
        themeName="lens"
      />
      <small className="hint">{getThemePalette(state.colorPalette).description}</small>
    </section>
  );
});

export const Theme = withInjectables<Dependencies>(NonInjectedTheme, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
    themes: di.injectMany(lensThemeDeclarationInjectionToken),
  }),
});
