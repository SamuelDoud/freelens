/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, observable } from "mobx";

import type { SearchCondition } from "../common/conditions";

const noConditions: readonly SearchCondition[] = [];

/**
 * The conditions of the advanced search of each list, and whether its panel is
 * open, by view key. They last for the session of the frame, so a search stays
 * in place while the user visits other lists; saved searches are what persists.
 */
export class AdvancedSearchState {
  private readonly conditionsByView = observable.map<string, readonly SearchCondition[]>({}, { deep: false });
  private readonly openPanels = observable.set<string>();

  getConditions(viewKey: string): readonly SearchCondition[] {
    return this.conditionsByView.get(viewKey) ?? noConditions;
  }

  @action
  setConditions(viewKey: string, conditions: readonly SearchCondition[]) {
    if (conditions.length === 0) {
      this.conditionsByView.delete(viewKey);
    } else {
      this.conditionsByView.set(viewKey, [...conditions]);
    }
  }

  @action
  addCondition(viewKey: string, condition: SearchCondition) {
    this.setConditions(viewKey, [...this.getConditions(viewKey), condition]);
  }

  @action
  replaceCondition(viewKey: string, condition: SearchCondition) {
    this.setConditions(
      viewKey,
      this.getConditions(viewKey).map((existing) => (existing.id === condition.id ? condition : existing)),
    );
  }

  @action
  removeCondition(viewKey: string, conditionId: string) {
    this.setConditions(
      viewKey,
      this.getConditions(viewKey).filter(({ id }) => id !== conditionId),
    );
  }

  @action
  clear(viewKey: string) {
    this.conditionsByView.delete(viewKey);
  }

  isPanelOpen(viewKey: string): boolean {
    return this.openPanels.has(viewKey);
  }

  @action
  setPanelOpen(viewKey: string, open: boolean) {
    if (open) {
      this.openPanels.add(viewKey);
    } else {
      this.openPanels.delete(viewKey);
    }
  }
}
