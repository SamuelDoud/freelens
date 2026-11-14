/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sidebarItemInjectionToken } from "@freelensapp/cluster-sidebar";
import { describe, expect, it } from "vitest";
import { resourceDefinitions } from "./definitions";

import type { Injectable } from "@ogre-tools/injectable";

// Every sidebar item of the cluster frame that Freelens itself registers.
const sidebarItemModules = import.meta.glob<{ default: Injectable<unknown, unknown, unknown> }>(
  ["../../../renderer/components/**/*.injectable.{ts,tsx}", "../../../features/**/renderer/**/*.injectable.{ts,tsx}"],
  { eager: true },
);

const sidebarItemIds = Object.values(sidebarItemModules)
  .map((module) => module.default)
  .filter((injectable) => injectable?.injectionToken === sidebarItemInjectionToken)
  .map((injectable) => injectable.id);

describe("resource definitions", () => {
  it("finds the sidebar items", () => {
    expect(sidebarItemIds).toContain("sidebar-item-pods");
  });

  it("define every sidebar item, so that a view added later is defined too", () => {
    expect(sidebarItemIds.filter((id) => !(id in resourceDefinitions))).toEqual([]);
  });

  it("define nothing that is not a sidebar item", () => {
    expect(Object.keys(resourceDefinitions).filter((id) => !sidebarItemIds.includes(id))).toEqual([]);
  });
});
