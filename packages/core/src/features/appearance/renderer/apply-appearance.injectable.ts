/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { reaction } from "mobx";
import { beforeFrameStartsSecondInjectionToken } from "../../../renderer/before-frame-starts/tokens";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import initUserStoreInjectable from "../../user-preferences/renderer/load-storage.injectable";
import { defaultAppearance, fontStack } from "../common/appearance";

/**
 * Applies the font, its size and the opacity of dropdowns to the frame, as
 * the CSS variables the styles read. Every frame, the root one and those of
 * the clusters, runs it.
 */
const applyAppearanceInjectable = getInjectable({
  id: "apply-appearance",
  instantiate: (di) => ({
    run: () => {
      const state = di.inject(userPreferencesStateInjectable);
      const style = document.documentElement.style;

      reaction(
        () => state.appearance,
        ({ fontFamily, fontSize, dropdownOpacity }) => {
          if (fontFamily) {
            style.setProperty("--font-main", fontStack(fontFamily));
          } else {
            style.removeProperty("--font-main");
          }

          if (fontSize !== defaultAppearance.fontSize) {
            style.setProperty("--font-size", `${fontSize}px`);
            style.setProperty("--font-size-small", `${(fontSize * 12) / 14}px`);
            style.setProperty("--font-size-big", `${(fontSize * 16) / 14}px`);
          } else {
            style.removeProperty("--font-size");
            style.removeProperty("--font-size-small");
            style.removeProperty("--font-size-big");
          }

          style.setProperty("--dropdown-opacity", String(dropdownOpacity));
        },
        { fireImmediately: true },
      );
    },
    runAfter: initUserStoreInjectable,
  }),
  injectionToken: beforeFrameStartsSecondInjectionToken,
});

export default applyAppearanceInjectable;
