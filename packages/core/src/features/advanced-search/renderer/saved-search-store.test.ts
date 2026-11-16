/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observable } from "mobx";
import { describe, expect, it } from "vitest";
import { SavedSearches } from "./saved-search-store";

import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { SearchCondition } from "../common/conditions";

const condition: SearchCondition = {
  id: "c1",
  kind: "text",
  field: "name",
  operator: "startsWith",
  value: "api",
  negate: false,
};

const makeSavedSearches = () => {
  const state = observable.object({ savedSearches: [] }) as unknown as UserPreferencesState;

  return { state, savedSearches: new SavedSearches(state) };
};

const request = (name: string, viewKey = "v1/Pod") => ({
  name,
  viewKey,
  viewTitle: "Pods",
  routePath: "/pods",
  conditions: [condition],
});

describe("SavedSearches", () => {
  it("saves into the user preferences and lists the searches of a view by name", () => {
    const { state, savedSearches } = makeSavedSearches();

    savedSearches.save(request("web"));
    savedSearches.save(request("  api  "));
    savedSearches.save(request("nodes", "v1/Node"));

    expect(state.savedSearches).toHaveLength(3);
    expect(savedSearches.forView("v1/Pod").map(({ name }) => name)).toEqual(["api", "web"]);
    expect(savedSearches.forView("v1/Node").map(({ routePath }) => routePath)).toEqual(["/pods"]);
  });

  it("replaces the search of the same view with the same name, keeping its id", () => {
    const { savedSearches } = makeSavedSearches();
    const first = savedSearches.save(request("API"));
    const replaced = savedSearches.save({ ...request("api"), conditions: [{ ...condition, value: "web" }] });

    expect(replaced.id).toBe(first.id);
    expect(savedSearches.all).toHaveLength(1);
    expect(savedSearches.all[0].conditions[0].value).toBe("web");
  });

  it("renames and removes a search", () => {
    const { savedSearches } = makeSavedSearches();
    const saved = savedSearches.save(request("api"));

    savedSearches.rename(saved.id, " backend ");
    expect(savedSearches.all[0].name).toBe("backend");

    savedSearches.remove(saved.id);
    expect(savedSearches.all).toEqual([]);
  });

  it("replaces the search that has the name a rename gives, as a save does", () => {
    const { savedSearches } = makeSavedSearches();
    const api = savedSearches.save(request("api"));
    const web = savedSearches.save(request("web"));
    const otherView = savedSearches.save(request("web", "v1/Node"));

    savedSearches.rename(api.id, " WEB ");

    expect(savedSearches.forView("v1/Pod").map(({ id, name }) => [id, name])).toEqual([[api.id, "WEB"]]);
    expect(savedSearches.all.some(({ id }) => id === web.id)).toBe(false);
    expect(savedSearches.all.some(({ id }) => id === otherView.id)).toBe(true);
  });

  it("lets a search change the case of its own name", () => {
    const { savedSearches } = makeSavedSearches();
    const api = savedSearches.save(request("api"));

    savedSearches.rename(api.id, "API");

    expect(savedSearches.all.map(({ name }) => name)).toEqual(["API"]);
  });

  it("reads a store without saved searches as none", () => {
    const savedSearches = new SavedSearches(observable.object({}) as unknown as UserPreferencesState);

    expect(savedSearches.forView("v1/Pod")).toEqual([]);
  });
});
