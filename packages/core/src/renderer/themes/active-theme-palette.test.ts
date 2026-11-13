/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { runInAction } from "mobx";
import { beforeEach, describe, expect, it } from "vitest";
import { getThemePalette } from "../../features/theme/palettes/common/palettes";
import userPreferencesStateInjectable from "../../features/user-preferences/common/state.injectable";
import { getDiForUnitTesting } from "../getDiForUnitTesting";
import activeThemeInjectable from "./active.injectable";
import systemThemeConfigurationInjectable from "./system-theme.injectable";

import type { DiContainer } from "@ogre-tools/injectable";

describe("the active theme with a color palette", () => {
  let di: DiContainer;

  beforeEach(() => {
    di = getDiForUnitTesting();
    runInAction(() => {
      const state = di.inject(userPreferencesStateInjectable);

      state.colorTheme = "system";
      state.colorPalette = "freelens";
      di.inject(systemThemeConfigurationInjectable).set("dark");
    });
  });

  const activeTheme = () => di.inject(activeThemeInjectable).get();
  const setPreference = (values: { colorTheme?: string; colorPalette?: string }) =>
    runInAction(() => Object.assign(di.inject(userPreferencesStateInjectable), values));

  it("is the plain theme with the Freelens palette", () => {
    expect(activeTheme().colors.primary).toBe("#00a7a0");
  });

  it("takes the palette's accent for the theme's type", () => {
    setPreference({ colorPalette: "sunset" });

    expect(activeTheme().type).toBe("dark");
    expect(activeTheme().colors.primary).toBe(getThemePalette("sunset").accent?.dark);
  });

  it("follows a change of the theme with the same palette", () => {
    setPreference({ colorPalette: "sunset", colorTheme: "Light" });

    expect(activeTheme().type).toBe("light");
    expect(activeTheme().colors.primary).toBe(getThemePalette("sunset").accent?.light);
  });

  it("follows the operating system on auto", () => {
    setPreference({ colorPalette: "ocean" });
    runInAction(() => di.inject(systemThemeConfigurationInjectable).set("light"));

    expect(activeTheme().type).toBe("light");
    expect(activeTheme().colors.primary).toBe(getThemePalette("ocean").accent?.light);
  });
});
