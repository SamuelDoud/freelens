/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { isRelativeTimeOperator } from "./conditions";
import { parseDuration } from "./duration";

import type {
  SearchCondition,
  SearchField,
  SearchFieldValue,
  TextSearchCondition,
  TimeSearchCondition,
} from "./conditions";

/**
 * What is wrong with a condition's value, or `undefined` when it can be used.
 * An empty value is not an error: the condition is just not in effect yet.
 */
export function getConditionError(condition: SearchCondition): string | undefined {
  if (!condition.value.trim()) {
    return undefined;
  }

  if (condition.kind === "text") {
    if (condition.operator === "regex") {
      try {
        new RegExp(condition.value, "i");
      } catch (error) {
        return error instanceof Error ? error.message : "Invalid regular expression";
      }
    }

    return undefined;
  }

  if (isRelativeTimeOperator(condition.operator)) {
    return parseDuration(condition.value) === undefined ? "Use a duration such as 30m, 2h, 3d or 1w" : undefined;
  }

  return Number.isNaN(parseLocalDateTime(condition.value)) ? "Pick a date and time" : undefined;
}

/**
 * Whether a condition takes part in the search: it has a value and the value is valid.
 */
export const isConditionInEffect = (condition: SearchCondition) =>
  Boolean(condition.value.trim()) && getConditionError(condition) === undefined;

/**
 * Reads `YYYY-MM-DDTHH:mm[:ss]` as local time. A date alone is also read as the
 * start of that local day, where `Date` would read it as UTC.
 */
export function parseLocalDateTime(value: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());

  if (!match) {
    return Number.NaN;
  }

  const [, year, month, day, hours = "0", minutes = "0", seconds = "0"] = match;

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hours),
    Number(minutes),
    Number(seconds),
  ).getTime();
}

type ValueTest = (value: string) => boolean;

function createTextTest({ operator, value }: TextSearchCondition): ValueTest {
  if (operator === "regex") {
    const expression = new RegExp(value, "i");

    return (text) => expression.test(text);
  }

  const query = value.toLowerCase();

  switch (operator) {
    case "exactly":
      return (text) => text.toLowerCase() === query;
    case "startsWith":
      return (text) => text.toLowerCase().startsWith(query);
    case "contains":
      return (text) => text.toLowerCase().includes(query);
  }
}

type TimeTest = (time: number, now: number) => boolean;

function createTimeTest({ operator, value }: TimeSearchCondition): TimeTest {
  if (operator === "olderThan" || operator === "newerThan") {
    const duration = parseDuration(value) as number;

    return operator === "olderThan" ? (time, now) => now - time > duration : (time, now) => now - time < duration;
  }

  const picked = parseLocalDateTime(value);

  switch (operator) {
    case "before":
      return (time) => time < picked;
    case "after":
      return (time) => time > picked;
    case "on": {
      const date = new Date(picked);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const nextDayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1).getTime();

      return (time) => time >= dayStart && time < nextDayStart;
    }
  }
}

const toTexts = (values: SearchFieldValue | readonly SearchFieldValue[]): string[] =>
  [values]
    .flat()
    .filter((value): value is string | number => value !== null && value !== undefined)
    .map(String);

/** Whether a condition, read without its `negate`, holds for an item. */
type ItemTest<I> = (item: I, now: number) => boolean;

function createItemTest<I>(condition: SearchCondition, field: SearchField<I>): ItemTest<I> | undefined {
  if (condition.kind === "text" && field.kind === "text") {
    const test = createTextTest(condition);

    return (item) => toTexts(field.getValues(item)).some(test);
  }

  if (condition.kind === "time" && field.kind === "time") {
    const test = createTimeTest(condition);

    return (item, now) => {
      const time = field.getTime(item);

      return typeof time === "number" && !Number.isNaN(time) && test(time, now);
    };
  }

  return undefined;
}

export interface SearchMatcher<I> {
  /** Whether the matcher reads the clock, so it has to be run again as time passes. */
  readonly usesClock: boolean;
  readonly matches: (item: I, now: number) => boolean;
}

/**
 * Compiles the conditions of a search into one test of an item, or returns
 * `undefined` when no condition is in effect.
 *
 * Conditions on the same field combine as "any of the positive ones and none
 * of the negated ones"; the fields combine with AND. Conditions that are empty,
 * invalid, or name a field the list does not have, are left out.
 */
export function createConditionMatcher<I>(
  conditions: readonly SearchCondition[],
  fields: readonly SearchField<I>[],
): SearchMatcher<I> | undefined {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const groups = new Map<string, { positive: ItemTest<I>[]; negative: ItemTest<I>[] }>();
  let usesClock = false;

  for (const condition of conditions) {
    const field = fieldsById.get(condition.field);

    if (!field || !isConditionInEffect(condition)) {
      continue;
    }

    const test = createItemTest(condition, field);

    if (!test) {
      continue;
    }

    if (condition.kind === "time" && isRelativeTimeOperator(condition.operator)) {
      usesClock = true;
    }

    let group = groups.get(condition.field);

    if (!group) {
      group = { positive: [], negative: [] };
      groups.set(condition.field, group);
    }

    (condition.negate ? group.negative : group.positive).push(test);
  }

  if (groups.size === 0) {
    return undefined;
  }

  const fieldTests = [...groups.values()];

  return {
    usesClock,
    matches: (item, now) =>
      fieldTests.every(
        ({ positive, negative }) =>
          (positive.length === 0 || positive.some((test) => test(item, now))) &&
          !negative.some((test) => test(item, now)),
      ),
  };
}
