/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { action, computed } from "mobx";

import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { SavedSearch, SearchCondition } from "../common/conditions";

export interface SaveSearchRequest {
  readonly name: string;
  readonly viewKey: string;
  readonly viewTitle: string;
  readonly routePath: string;
  readonly conditions: readonly SearchCondition[];
}

/**
 * The saved searches, kept in the user preferences so that every cluster sees
 * the same ones. Each change writes a new array, which the user store persists.
 */
export class SavedSearches {
  constructor(private readonly state: UserPreferencesState) {}

  @computed get all(): readonly SavedSearch[] {
    return this.state.savedSearches ?? [];
  }

  forView(viewKey: string): SavedSearch[] {
    return this.all
      .filter((search) => search.viewKey === viewKey)
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  findByName(viewKey: string, name: string): SavedSearch | undefined {
    const wanted = name.trim().toLowerCase();

    return this.all.find((search) => search.viewKey === viewKey && search.name.trim().toLowerCase() === wanted);
  }

  /**
   * Saves a search, replacing the one of the same view with the same name.
   */
  @action
  save({ name, viewKey, viewTitle, routePath, conditions }: SaveSearchRequest): SavedSearch {
    const existing = this.findByName(viewKey, name);
    const saved: SavedSearch = {
      id: existing?.id ?? globalThis.crypto.randomUUID(),
      name: name.trim(),
      viewKey,
      viewTitle,
      routePath,
      conditions: conditions.map((condition) => ({ ...condition })),
      createdAt: existing?.createdAt ?? new Date().toISOString(),
    };

    this.state.savedSearches = existing
      ? this.all.map((search) => (search.id === existing.id ? saved : search))
      : [...this.all, saved];

    return saved;
  }

  @action
  rename(id: string, name: string) {
    this.state.savedSearches = this.all.map((search) => (search.id === id ? { ...search, name: name.trim() } : search));
  }

  @action
  remove(id: string) {
    this.state.savedSearches = this.all.filter((search) => search.id !== id);
  }
}
