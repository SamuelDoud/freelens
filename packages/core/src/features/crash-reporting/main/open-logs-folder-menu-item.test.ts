/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../main/getDiForUnitTesting";
import openLogsFolderInjectable from "./open-logs-folder.injectable";
import openLogsFolderMenuItemInjectable from "./open-logs-folder-menu-item.injectable";

import type { DiContainer } from "@ogre-tools/injectable";
import type { Mock } from "vitest";

describe("open-logs-folder-menu-item", () => {
  let di: DiContainer;
  let openLogsFolderMock: Mock;

  beforeEach(() => {
    di = getDiForUnitTesting();

    openLogsFolderMock = vi.fn().mockResolvedValue(undefined);
    di.override(openLogsFolderInjectable, () => openLogsFolderMock);
  });

  it("is placed at the end of the Help menu", () => {
    const menuItem = di.inject(openLogsFolderMenuItemInjectable);

    expect(menuItem).toMatchObject({ parentId: "help", label: "Open Logs Folder", orderNumber: 40 });
  });

  it("opens the logs folder when clicked", () => {
    const menuItem = di.inject(openLogsFolderMenuItemInjectable);

    menuItem.onClick();

    expect(openLogsFolderMock).toHaveBeenCalledTimes(1);
  });
});
