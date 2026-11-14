/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { act, fireEvent } from "@testing-library/react";
import { computed, runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import openConfirmDialogInjectable from "../../../renderer/components/confirm-dialog/open.injectable";
import searchUrlPageParamInjectable from "../../../renderer/components/input/search-url-page-param.injectable";
import { renderFor } from "../../../renderer/components/test-utils/renderFor";
import { getDiForUnitTesting } from "../../../renderer/getDiForUnitTesting";
import currentPathInjectable from "../../../renderer/routes/current-path.injectable";
import currentlyInClusterFrameInjectable from "../../../renderer/routes/currently-in-cluster-frame.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { AdvancedSearchControls, AdvancedSearchPanel } from "./advanced-search-panel";
import advancedSearchStateInjectable from "./advanced-search-state.injectable";
import savedSearchCommandsInjectable from "./saved-search-commands.injectable";
import savedSearchesInjectable from "./saved-searches.injectable";

import type { DiContainer } from "@ogre-tools/injectable";

import type { ConfirmDialogParams } from "../../../renderer/components/confirm-dialog";
import type { DiRender } from "../../../renderer/components/test-utils/renderFor";
import type { SearchCondition, SearchField } from "../common/conditions";
import type { AdvancedSearchView } from "./advanced-search-panel";
import type { AdvancedSearchState } from "./advanced-search-state";
import type { SavedSearches } from "./saved-search-store";

interface Item {
  name: string;
}

const fields: SearchField<Item>[] = [
  { id: "name", title: "Name", kind: "text", getValues: (item) => item.name },
  { id: "age", title: "Age", kind: "time", getTime: () => 0 },
];

const view: AdvancedSearchView<Item> = { viewKey: "v1/Pod", viewTitle: "Pods", fields };

const condition = (value: string, overrides: Partial<SearchCondition> = {}) =>
  ({
    id: `c-${value}`,
    kind: "text",
    field: "name",
    operator: "startsWith",
    value,
    negate: false,
    ...overrides,
  }) as SearchCondition;

describe("advanced search panel", () => {
  let di: DiContainer;
  let render: DiRender;
  let state: AdvancedSearchState;
  let savedSearches: SavedSearches;
  let confirmations: ConfirmDialogParams[];

  beforeEach(() => {
    di = getDiForUnitTesting();
    confirmations = [];
    di.override(openConfirmDialogInjectable, () => (params: ConfirmDialogParams) => confirmations.push(params));
    di.override(currentPathInjectable, () => computed(() => "/pods"));
    di.override(currentlyInClusterFrameInjectable, () => true);
    runInAction(() => {
      di.inject(userPreferencesStateInjectable).savedSearches = [];
    });
    render = renderFor(di);
    state = di.inject(advancedSearchStateInjectable);
    savedSearches = di.inject(savedSearchesInjectable);
  });

  it("renders nothing without conditions", () => {
    const { queryByTestId } = render(<AdvancedSearchPanel view={view} />);

    expect(queryByTestId("advanced-search-strip")).toBeNull();
  });

  it("adds a condition open from the header, edits, negates and removes it", () => {
    const { getByTestId, queryByTestId } = render(
      <>
        <AdvancedSearchControls view={view} />
        <AdvancedSearchPanel view={view} />
      </>,
    );

    fireEvent.click(getByTestId("advanced-search-toggle"));

    expect(state.getConditions("v1/Pod")).toMatchObject([
      { field: "name", kind: "text", operator: "contains", value: "", negate: false },
    ]);
    expect(getByTestId("advanced-search-condition-0")).toBeTruthy();

    fireEvent.change(getByTestId("advanced-search-value-0"), { target: { value: "api" } });
    fireEvent.click(getByTestId("advanced-search-not-0"));

    expect(state.getConditions("v1/Pod")).toMatchObject([{ value: "api", negate: true }]);
    expect(getByTestId("advanced-search-active-count").textContent).toBe("1");

    fireEvent.click(getByTestId("advanced-search-remove-0"));

    expect(state.getConditions("v1/Pod")).toEqual([]);
    expect(queryByTestId("advanced-search-active-count")).toBeNull();
    expect(queryByTestId("advanced-search-strip")).toBeNull();
  });

  it("shows each condition as a chip that opens in place, one at a time, and closes on Escape", () => {
    state.setConditions("v1/Pod", [condition("api"), condition("web", { id: "c-2", field: "name" })]);

    const { getByTestId, queryByTestId } = render(<AdvancedSearchPanel view={view} />);

    expect(getByTestId("advanced-search-chip-0").textContent).toContain('Name starts with "api"');
    expect(getByTestId("advanced-search-chip-1").textContent).toContain('Name starts with "web"');

    fireEvent.click(getByTestId("advanced-search-chip-0"));

    expect(getByTestId("advanced-search-condition-0")).toBeTruthy();
    expect(queryByTestId("advanced-search-chip-0")).toBeNull();

    fireEvent.click(getByTestId("advanced-search-chip-1"));

    expect(getByTestId("advanced-search-chip-0")).toBeTruthy();
    expect(getByTestId("advanced-search-condition-1")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(getByTestId("advanced-search-chip-1")).toBeTruthy();
  });

  it("removes a condition with the ✕ of its chip, without opening it", () => {
    state.setConditions("v1/Pod", [condition("api"), condition("web", { id: "c-2" })]);

    const { getByTestId, queryByTestId } = render(<AdvancedSearchPanel view={view} />);

    fireEvent.click(getByTestId("advanced-search-remove-0"));

    expect(state.getConditions("v1/Pod").map(({ value }) => value)).toEqual(["web"]);
    expect(queryByTestId("advanced-search-condition-0")).toBeNull();
  });

  it("marks a chip whose condition is not in effect, and says why once it is open", () => {
    state.setConditions("v1/Pod", [condition("(", { operator: "regex" })]);

    const { getByTestId } = render(<AdvancedSearchPanel view={view} />);

    expect(getByTestId("advanced-search-chip-0").getAttribute("title")).not.toBe("");

    fireEvent.click(getByTestId("advanced-search-chip-0"));

    expect(getByTestId("advanced-search-error-0").textContent).not.toBe("");
  });

  it("clears every condition", () => {
    state.setConditions("v1/Pod", [condition("api")]);

    const { getByTestId, queryByTestId } = render(<AdvancedSearchPanel view={view} />);

    fireEvent.click(getByTestId("advanced-search-clear"));

    expect(state.getConditions("v1/Pod")).toEqual([]);
    expect(queryByTestId("advanced-search-strip")).toBeNull();
  });

  it("saves the search from its dropdown, with the quick search as an Any field condition, and applies it from the ★ menu", () => {
    const searchUrlParam = di.inject(searchUrlPageParamInjectable);

    searchUrlParam.set("backend");
    state.setConditions("v1/Pod", [condition("api")]);

    const { getByTestId, queryByTestId } = render(
      <>
        <AdvancedSearchControls view={view} />
        <AdvancedSearchPanel view={view} />
      </>,
    );

    fireEvent.click(getByTestId("advanced-search-save-toggle"));
    fireEvent.change(getByTestId("advanced-search-save-name"), { target: { value: "Backend APIs" } });
    fireEvent.click(getByTestId("advanced-search-save"));

    const [saved] = savedSearches.all;

    expect(saved).toMatchObject({ name: "Backend APIs", viewKey: "v1/Pod", viewTitle: "Pods", routePath: "/pods" });
    expect(saved.conditions).toMatchObject([
      { field: "name", value: "api" },
      { field: "any", operator: "contains", value: "backend" },
    ]);
    expect(searchUrlParam.get()).toBe("");
    expect(queryByTestId("advanced-search-save-popover")).toBeNull();

    state.clear("v1/Pod");
    searchUrlParam.set("other");
    fireEvent.click(getByTestId("icon-for-saved-searches-menu"));
    fireEvent.click(getByTestId("saved-search-menu-item-Backend APIs"));

    expect(state.getConditions("v1/Pod")).toEqual(saved.conditions);
    expect(searchUrlParam.get()).toBe("");
  });

  it("offers to replace a saved search of the same name", () => {
    savedSearches.save({ name: "APIs", viewKey: "v1/Pod", viewTitle: "Pods", routePath: "/pods", conditions: [] });
    state.setConditions("v1/Pod", [condition("api")]);

    const { getByTestId } = render(<AdvancedSearchPanel view={view} />);

    fireEvent.click(getByTestId("advanced-search-save-toggle"));
    fireEvent.change(getByTestId("advanced-search-save-name"), { target: { value: "apis" } });

    expect(getByTestId("advanced-search-save").textContent).toBe("Replace");
  });

  it("renames and, once confirmed, deletes a saved search from the ★ menu", () => {
    savedSearches.save({
      name: "APIs",
      viewKey: "v1/Pod",
      viewTitle: "Pods",
      routePath: "/pods",
      conditions: [condition("api")],
    });

    const { getByTestId, queryByTestId } = render(<AdvancedSearchControls view={view} />);

    fireEvent.click(getByTestId("icon-for-saved-searches-menu"));
    fireEvent.click(getByTestId("saved-search-rename-APIs"));

    expect(confirmations).toHaveLength(1);

    const rename = render(<>{confirmations[0].message}</>);

    fireEvent.change(rename.getByTestId("saved-search-rename-input"), { target: { value: "Gateways" } });
    act(() => confirmations[0].ok?.());

    expect(savedSearches.all.map(({ name }) => name)).toEqual(["Gateways"]);
    // Renaming applies nothing.
    expect(state.getConditions("v1/Pod")).toEqual([]);

    if (!queryByTestId("saved-search-delete-Gateways")) {
      fireEvent.click(getByTestId("icon-for-saved-searches-menu"));
    }

    fireEvent.click(getByTestId("saved-search-delete-Gateways"));

    expect(savedSearches.all).toHaveLength(1);
    expect(confirmations).toHaveLength(2);

    confirmations[1].ok?.();

    expect(savedSearches.all).toEqual([]);
  });

  it("offers a command per saved search in the cluster frame that opens its list with its conditions", () => {
    const saved = savedSearches.save({
      name: "APIs",
      viewKey: "v1/Pod",
      viewTitle: "Pods",
      routePath: "/pods",
      conditions: [condition("api")],
    });
    const [command] = di.inject(savedSearchCommandsInjectable).get();
    const navigate = vi.fn();

    expect(command.title).toBe("Saved search: APIs (Pods)");
    expect(command.isActive?.({ entity: { kind: "KubernetesCluster" } as never })).toBe(true);

    command.action({ entity: {} as never, navigate });

    expect(state.getConditions("v1/Pod")).toEqual(saved.conditions);
    expect(navigate).toHaveBeenCalledWith("/pods");
  });
});
