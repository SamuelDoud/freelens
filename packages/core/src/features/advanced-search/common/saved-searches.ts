/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { textSearchOperators, timeSearchOperators } from "./conditions";

import type { SavedSearch, SearchCondition } from "./conditions";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isString = (value: unknown): value is string => typeof value === "string";

function toCondition(value: unknown): SearchCondition | undefined {
  if (!isRecord(value) || !isString(value.id) || !isString(value.field) || !isString(value.value)) {
    return undefined;
  }

  const base = { id: value.id, field: value.field, value: value.value, negate: value.negate === true };

  if (value.kind === "text") {
    const operator = textSearchOperators.find(({ id }) => id === value.operator)?.id;

    return operator && { ...base, kind: "text", operator };
  }

  if (value.kind === "time") {
    const operator = timeSearchOperators.find(({ id }) => id === value.operator)?.id;

    return operator && { ...base, kind: "time", operator };
  }

  return undefined;
}

function toSavedSearch(value: unknown): SavedSearch | undefined {
  if (
    !isRecord(value) ||
    !isString(value.id) ||
    !isString(value.name) ||
    !isString(value.viewKey) ||
    !isString(value.routePath) ||
    !Array.isArray(value.conditions)
  ) {
    return undefined;
  }

  return {
    id: value.id,
    name: value.name,
    viewKey: value.viewKey,
    viewTitle: isString(value.viewTitle) ? value.viewTitle : value.viewKey,
    routePath: value.routePath,
    conditions: value.conditions.map(toCondition).filter((condition) => condition !== undefined),
    createdAt: isString(value.createdAt) ? value.createdAt : new Date(0).toISOString(),
  };
}

/**
 * The saved searches in a stored value, dropping entries that are not
 * well-formed and conditions with an unknown kind or operator, so that a hand
 * edit or a newer version of the store cannot break the lists.
 */
export function readSavedSearches(value: unknown): SavedSearch[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map(toSavedSearch).filter((search) => search !== undefined);
}
