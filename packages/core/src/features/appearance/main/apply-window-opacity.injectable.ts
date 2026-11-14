/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import { app, BrowserWindow } from "electron";
import { reaction } from "mobx";
import { afterApplicationIsLoadedInjectionToken } from "../../../main/start-main-application/runnable-tokens/phases";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";

/**
 * Sets the opacity of every window of the application, and of each window
 * opened later, to the one of the appearance preferences. Electron applies
 * it on macOS and Windows; on Linux it does nothing.
 */
const applyWindowOpacityInjectable = getInjectable({
  id: "apply-window-opacity",
  instantiate: (di) => ({
    run: () => {
      const state = di.inject(userPreferencesStateInjectable);
      const opacity = () => state.appearance.windowOpacity;

      app.on("browser-window-created", (_event, window) => window.setOpacity(opacity()));

      reaction(
        opacity,
        (value) => {
          for (const window of BrowserWindow.getAllWindows()) {
            window.setOpacity(value);
          }
        },
        { fireImmediately: true },
      );
    },
  }),
  causesSideEffects: true,
  injectionToken: afterApplicationIsLoadedInjectionToken,
});

export default applyWindowOpacityInjectable;
