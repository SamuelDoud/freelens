/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { MenuControls } from "./menu-actions";

/**
 * What a menu hands to `onMenuReady` when it unmounts, in place of its controls: they do nothing,
 * and whoever kept the menu's controls can tell by identity that the menu is gone.
 */
export const releasedMenuControls: MenuControls = Object.freeze({
  open: () => {},
  close: () => {},
});
