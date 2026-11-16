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

  // A child's element is inside its section's, so the last active item is the deepest. Top-level
  // views (Nodes, Namespaces, Events) have no parent, and count too.
  const activeItems = document.querySelectorAll('[data-testid^="sidebar-item-"][data-is-active-test="true"]');

  return activeItems.length ? activeItems[activeItems.length - 1] : undefined;
};

/**
 * The view a list title names, when it is another view than the page's: the Events list inside the
 * workloads overview is titled "Events", which is a view of the sidebar.
 */
const viewNamedBy = (title: Element): string | undefined => {
  const name = labelOf(title);

  for (const link of title.ownerDocument.querySelectorAll('[data-testid^="link-for-sidebar-item-"]')) {
    const id = idOfTestId(link.getAttribute("data-testid") ?? "");

    if (isDefinedId(id) && labelOf(link) === name) {
      return id;
    }
  }

  return undefined;
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
    const named = viewNamedBy(title);

    if (named) {
      return { id: named, anchor: title };
    }

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

/**
 * The name an element shows, without the text of its icons: a material icon is a ligature, whose
 * text is the icon's name ("device_hub", "keyboard_arrow_up"), which a section of the sidebar has
 * beside its label.
 */
export function labelOf(element: Element): string {
  const document = element.ownerDocument;
  const walker = document.createTreeWalker(element, 4 /* NodeFilter.SHOW_TEXT */);
  const parts: string[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement?.closest(".Icon")) {
      parts.push(node.textContent ?? "");
    }
  }

  return parts.join("").replace(/​/g, "").replace(/\s+/g, " ").trim();
}
