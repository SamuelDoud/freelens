/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { autorun, observable } from "mobx";
import { describe, expect, it } from "vitest";
import { AdvancedSearchState } from "../../../../features/advanced-search/renderer/advanced-search-state";
import { NonInjectedItemListLayout } from "../list-layout";
import { PageFiltersStore } from "../page-filters/store";

import type { ItemObject } from "@freelensapp/list-layout";

import type { SearchCondition, SearchField } from "../../../../features/advanced-search/common/conditions";
import type { PageParam } from "../../../navigation/page-param";

type LayoutProps = ConstructorParameters<typeof NonInjectedItemListLayout<ItemObject, boolean>>[0];

interface Item extends ItemObject {
  namespace: string;
}

const makeItem = (name: string, namespace: string): Item => ({
  getId: () => `${namespace}/${name}`,
  getName: () => name,
  namespace,
});

const items = [
  makeItem("api-server", "default"),
  makeItem("web", "default"),
  makeItem("api-gateway", "edge"),
  makeItem("coredns", "kube-system"),
];

const fields: SearchField<Item>[] = [
  { id: "name", title: "Name", kind: "text", getValues: (item) => item.getName() },
  { id: "namespace", title: "Namespace", kind: "text", getValues: (item) => item.namespace },
];

const viewKey = "test/Item";

const makeLayout = () => {
  const search = observable.box("");
  const searchUrlParam = {
    get: () => search.get(),
    set: (value: string) => search.set(value),
  } as unknown as PageParam<string>;
  const advancedSearchState = new AdvancedSearchState();
  const props = {
    className: "",
    getItems: () => items,
    store: { isLoaded: true },
    searchFilters: [(item: Item) => [item.getName(), item.namespace]],
    advancedSearch: { viewKey, viewTitle: "Items", fields },
    renderTableContents: () => [],
    pageFiltersStore: new PageFiltersStore({ searchUrlParam }),
    advancedSearchState,
  } as unknown as LayoutProps;

  return { layout: new NonInjectedItemListLayout(props), search, advancedSearchState };
};

const condition = (
  field: string,
  operator: "exactly" | "startsWith" | "contains",
  value: string,
  negate = false,
): SearchCondition => ({ id: `${field}-${operator}-${value}-${negate}`, kind: "text", field, operator, value, negate });

describe("<ItemListLayout> advanced search", () => {
  it("leaves the items alone without conditions", () => {
    const { layout } = makeLayout();

    expect(layout.items).toHaveLength(4);
    expect(layout.hasAdvancedSearchFilter).toBe(false);
  });

  it("filters the items by the conditions of its view, and follows them as they change", () => {
    const { layout, advancedSearchState } = makeLayout();
    const seen: string[][] = [];
    const dispose = autorun(() => seen.push(layout.items.map((item) => item.getName())));

    advancedSearchState.setConditions(viewKey, [
      condition("name", "startsWith", "api"),
      condition("namespace", "exactly", "edge", true),
    ]);
    advancedSearchState.setConditions("other/View", [condition("name", "exactly", "web")]);
    advancedSearchState.clear(viewKey);
    dispose();

    expect(seen).toEqual([
      ["api-server", "web", "api-gateway", "coredns"],
      ["api-server"],
      ["api-server", "web", "api-gateway", "coredns"],
    ]);
  });

  it("applies the conditions on top of the quick search", () => {
    const { layout, search, advancedSearchState } = makeLayout();

    search.set("default");
    advancedSearchState.setConditions(viewKey, [condition("name", "contains", "e")]);

    expect(layout.items.map((item) => item.getName())).toEqual(["api-server", "web"]);
    expect(layout.hasAdvancedSearchFilter).toBe(true);
  });

  it("offers an Any field field that reads what the quick search reads", () => {
    const { layout, advancedSearchState } = makeLayout();

    expect(layout.advancedSearchView?.fields.map(({ id }) => id)).toEqual(["name", "namespace", "any"]);

    advancedSearchState.setConditions(viewKey, [condition("any", "exactly", "kube-system")]);

    expect(layout.items.map((item) => item.getName())).toEqual(["coredns"]);
  });
});
