/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { getApplicationBuilder } from "../../../renderer/components/test-utils/get-application-builder";
import applicationMenuItemCompositeInjectable from "../../application-menu/main/application-menu-item-composite.injectable";
import { getApplicationMenuTemplate } from "../../application-menu/main/populate-application-menu.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";

import type { MenuItemConstructorOptions } from "electron";

import type { ApplicationBuilder } from "../../../renderer/components/test-utils/get-application-builder";

describe("choosing the theme and color palette from the application menu", () => {
  let builder: ApplicationBuilder;

  beforeEach(async () => {
    builder = getApplicationBuilder();
    await builder.render();
  });

  const themeMenu = () => {
    const template = getApplicationMenuTemplate(builder.mainDi.inject(applicationMenuItemCompositeInjectable).get());
    const view = template.find((menu) => menu.id === "view");
    const theme = (view?.submenu as MenuItemConstructorOptions[]).find((item) => item.id === "theme");

    return theme?.submenu as MenuItemConstructorOptions[];
  };

  const checkedLabels = () =>
    themeMenu()
      .filter((item) => item.checked)
      .map((item) => item.label);

  const state = () => builder.mainDi.inject(userPreferencesStateInjectable);

  it("offers auto, light and dark, then the palettes, as radio items", () => {
    expect(themeMenu().map((item) => item.label ?? item.type)).toEqual([
      "Auto (sync with computer)",
      "Light",
      "Dark",
      "separator",
      "Freelens",
      "Ocean",
      "Forest",
      "Sunset",
      "Graphite",
      "High contrast",
    ]);
    expect(themeMenu().filter((item) => item.type === "radio")).toHaveLength(9);
  });

  it("checks auto and the Freelens palette by default", () => {
    expect(checkedLabels()).toEqual(["Auto (sync with computer)", "Freelens"]);
  });

  describe("when Light is chosen", () => {
    beforeEach(async () => {
      await builder.applicationMenu.click("root", "view", "theme", "theme-mode-light");
    });

    it("sets the theme preference to the light theme", () => {
      expect(state().colorTheme).toBe("Light");
    });

    it("moves the check mark to Light", () => {
      expect(checkedLabels()).toEqual(["Light", "Freelens"]);
    });
  });

  describe("when the Ocean palette is chosen", () => {
    beforeEach(async () => {
      await builder.applicationMenu.click("root", "view", "theme", "theme-palette-ocean");
    });

    it("sets the palette preference", () => {
      expect(state().colorPalette).toBe("ocean");
    });

    it("moves the check mark to Ocean and keeps the theme", () => {
      expect(checkedLabels()).toEqual(["Auto (sync with computer)", "Ocean"]);
    });
  });
});
