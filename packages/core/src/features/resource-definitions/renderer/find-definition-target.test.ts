/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it } from "vitest";
import { findDefinitionTarget } from "./find-definition-target";

describe("findDefinitionTarget", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div data-testid="sidebar-item-pods" data-is-active-test="true" data-parent-id-test="sidebar-item-workloads">
        <a data-testid="link-for-sidebar-item-pods"><span id="pods-label">Pods</span></a>
      </div>
      <div data-testid="sidebar-item-custom-resource-group-cert-manager.io/certificates">
        <a data-testid="link-for-sidebar-item-custom-resource-group-cert-manager.io/certificates"><span id="crd">Certificate</span></a>
      </div>
      <div class="Tab" data-testid="tab-link-for-sidebar-item-deployments" data-is-active-test="false"><span id="tab">Deployments</span></div>
      <div class="header"><h5 class="title" id="title">Pods</h5></div>
      <div data-testid="something-else"><span id="other">Other</span></div>
    `;
  });

  const target = (id: string) => findDefinitionTarget(document.getElementById(id));

  it("finds the sidebar item of a label, beside its link", () => {
    expect(target("pods-label")).toEqual({
      id: "sidebar-item-pods",
      anchor: document.querySelector('[data-testid="link-for-sidebar-item-pods"]'),
    });
  });

  it("finds the item of a tab and of a custom resource", () => {
    expect(target("tab")?.id).toBe("sidebar-item-deployments");
    expect(target("crd")?.id).toBe("sidebar-item-custom-resource-group-cert-manager.io/certificates");
  });

  it("takes the active view for the title of a list", () => {
    expect(target("title")).toEqual({ id: "sidebar-item-pods", anchor: document.getElementById("title") });
  });

  it("finds nothing for anything else", () => {
    expect(target("other")).toBeUndefined();
    expect(findDefinitionTarget(null)).toBeUndefined();
  });
});
