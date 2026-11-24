/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { limitGraphemeLengthOf } from "../../common/catalog/helpers";

import type { ClusterPreferences } from "../../common/cluster-types";

/** The icon preferences of the fork's versions before 2.6.1. */
interface ForkIconPreferences {
  iconText?: string;
  iconBackground?: string;
  iconTextColor?: string;
}

/** The longest label a cluster icon shows, as the icon settings allow. */
const maxIconShortNameLength = 3;

/**
 * Moves the icon preferences of the fork's earlier versions to the ones Freelens uses: the text
 * becomes the label (`iconShortName`, at most three characters), and the background becomes the
 * icon color (`icon`) unless the cluster has an image. The text color is dropped: Freelens picks
 * the text color that contrasts with the background. Preferences already set are kept, and the
 * old ones are removed, so the move happens once.
 */
export const migrateForkIconPreferences = (preferences: ClusterPreferences): void => {
  const old = preferences as ClusterPreferences & ForkIconPreferences;
  const { iconText, iconBackground, iconTextColor } = old;

  if (iconText === undefined && iconBackground === undefined && iconTextColor === undefined) {
    return;
  }

  if (iconText?.trim() && !preferences.iconShortName) {
    preferences.iconShortName = limitGraphemeLengthOf(iconText.trim(), maxIconShortNameLength);
  }

  if (iconBackground && !preferences.icon) {
    preferences.icon = iconBackground;
  }

  delete old.iconText;
  delete old.iconBackground;
  delete old.iconTextColor;
};
