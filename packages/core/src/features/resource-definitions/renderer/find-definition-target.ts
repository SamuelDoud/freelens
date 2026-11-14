/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { sideBarItemCustomResourcePrefix } from "../../../renderer/components/custom-resource-definitions/groups-sidebar-items-computed.injectable";
import { resourceDefinitions } from "../common/definitions";

export interface DefinitionTarget {
  /** The id of the sidebar item the element stands for. */
  readonly id: string;
  /** The element to show the definition beside. */
  readonly anchor: Element;
}

export const isDefinedId = (id: string) => id in resourceDefinitions || id.startsWith(sideBarItemCustomResourcePrefix);

/** The id a `data-testid` of the sidebar or of the tabs stands for. */
const idOfTestId = (testId: string) => {
  for (const prefix of ["tab-link-for-", "link-for-", "expand-icon-for-", "pin-icon-for-"]) {
    if (testId.startsWith(prefix)) {
      return testId.slice(prefix.length);
    }
  }

  return testId;
};

/** The innermost view the page shows: the active tab, or else the deepest active sidebar item. */
const activeViewOf = (document: Document): Element | undefined => {
  const activeTab = document.querySelector('[data-testid^="tab-link-for-"][data-is-active-test="true"]');

  if (activeTab) {
    return activeTab;
  }

  const activeItems = document.querySelectorAll("[data-is-active-test=true][data-parent-id-test]");

  return activeItems.length ? activeItems[activeItems.length - 1] : undefined;
};

/**
 * What the element under the pointer stands for: a sidebar item, a tab, or the title of a list,
 * which stands for the view the page shows. The sidebar and the tabs name their items in their
 * `data-testid`s, so no element needs an attribute of its own.
 */
export function findDefinitionTarget(target: Element | null): DefinitionTarget | undefined {
  if (!target) {
    return undefined;
  }

  const title = target.closest(".header .title");

  if (title) {
    const active = activeViewOf(target.ownerDocument);
    const id = active?.getAttribute("data-testid");
    const resolved = id ? idOfTestId(id) : undefined;

    return resolved && isDefinedId(resolved) ? { id: resolved, anchor: title } : undefined;
  }

  for (let element: Element | null = target; element; element = element.parentElement) {
    const testId = element.getAttribute("data-testid");

    if (testId) {
      const id = idOfTestId(testId);

      if (isDefinedId(id)) {
        return { id, anchor: element };
      }
    }
  }

  return undefined;
}
