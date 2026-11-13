/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { anyFieldId, createConditionId, isRelativeTimeOperator } from "../common/conditions";

import type {
  SearchCondition,
  SearchField,
  TextSearchOperator,
  TimeSearchCondition,
  TimeSearchOperator,
} from "../common/conditions";

const pad = (value: number) => String(value).padStart(2, "0");

/** A time as the value of an `<input type="datetime-local">`, in local time. */
export function toLocalDateTimeInput(time: number): string {
  const date = new Date(time);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const defaultRelativeValue = "1d";

/**
 * A new, empty condition on a field: `contains` for text, `before` now for time.
 */
export function createCondition<I>(field: SearchField<I>, now: number, id = createConditionId()): SearchCondition {
  if (field.kind === "time") {
    return { id, kind: "time", field: field.id, operator: "before", value: toLocalDateTimeInput(now), negate: false };
  }

  return { id, kind: "text", field: field.id, operator: "contains", value: "", negate: false };
}

/**
 * The condition moved to another field. It keeps its operator and value when
 * the field is of the same kind, and starts over when it is not.
 */
export function withField<I>(condition: SearchCondition, field: SearchField<I>, now: number): SearchCondition {
  if (condition.kind === field.kind) {
    return { ...condition, field: field.id };
  }

  return { ...createCondition(field, now, condition.id), negate: condition.negate };
}

export function withTextOperator(condition: SearchCondition, operator: TextSearchOperator): SearchCondition {
  return condition.kind === "text" ? { ...condition, operator } : condition;
}

/**
 * The time condition with another operator. Switching between a date-time
 * (`on`, `before`, `after`) and a duration (`olderThan`, `newerThan`) resets
 * the value, which means something else on the other side.
 */
export function withTimeOperator(
  condition: SearchCondition,
  operator: TimeSearchOperator,
  now: number,
): TimeSearchCondition | SearchCondition {
  if (condition.kind !== "time") {
    return condition;
  }

  if (isRelativeTimeOperator(operator) === isRelativeTimeOperator(condition.operator)) {
    return { ...condition, operator };
  }

  return {
    ...condition,
    operator,
    value: isRelativeTimeOperator(operator) ? defaultRelativeValue : toLocalDateTimeInput(now),
  };
}

/** The condition that carries the quick search text into a saved search. */
export const quickSearchCondition = (text: string): SearchCondition => ({
  id: createConditionId(),
  kind: "text",
  field: anyFieldId,
  operator: "contains",
  value: text,
  negate: false,
});
