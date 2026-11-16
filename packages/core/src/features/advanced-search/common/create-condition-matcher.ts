/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { parseQuantity } from "../../../common/utils/k8s-quantity";
import { isRelativeTimeOperator, takesNoValue } from "./conditions";
import { parseDuration } from "./duration";

import type {
  QuantitySearchCondition,
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
  if (!condition.value.trim() || takesNoValue(condition)) {
    return undefined;
  }

  if (condition.kind === "quantity") {
    return parseQuantity(condition.value) === undefined ? "Use a quantity such as 500m, 2, 512Mi or 1Gi" : undefined;
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
  takesNoValue(condition) || (Boolean(condition.value.trim()) && getConditionError(condition) === undefined);

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

  const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hours), Number(minutes), Number(seconds));

  // Date rolls an impossible day (February 31) over into the next month; the date the user wrote
  // has to be the one read. Only the day is compared: a time in a daylight-saving gap is real.
  if (date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day) || Number(minutes) > 59) {
    return Number.NaN;
  }

  if (Number(hours) > 23 || Number(seconds) > 59) {
    return Number.NaN;
  }

  return date.getTime();
}

type ValueTest = (value: string) => boolean;

const separators = /[-_]/g;

function createTextTest({ operator, value, loose }: TextSearchCondition): ValueTest {
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
      if (loose) {
        return (text) => {
          const lowered = text.toLowerCase();

          return lowered.includes(query) || lowered.replace(separators, "").includes(query);
        };
      }

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

type QuantityTest = (amount: number | undefined) => boolean;

function createQuantityTest({ operator, value }: QuantitySearchCondition): QuantityTest {
  if (operator === "isSet") {
    return (amount) => amount !== undefined;
  }

  const wanted = parseQuantity(value) as number;
  // Quantities written differently can stand for the same amount (1Gi and
  // 1024Mi, 0.5 and 500m); compare them without floating-point noise.
  const tolerance = Math.abs(wanted) * 1e-9;

  switch (operator) {
    case "moreThan":
      return (amount) => amount !== undefined && amount > wanted + tolerance;
    case "lessThan":
      return (amount) => amount !== undefined && amount < wanted - tolerance;
    case "exactly":
      return (amount) => amount !== undefined && Math.abs(amount - wanted) <= tolerance;
  }
}

const toTexts = (values: SearchFieldValue | readonly SearchFieldValue[]): string[] =>
  [values]
    .flat()
    .filter((value): value is string | number => value !== null && value !== undefined)
    .map(String);

/** Whether a condition, read without its `negate`, holds for an item. */
type ItemTest<I> = (item: I, now: number) => boolean;

const isTextOnNumberField = <I>(condition: SearchCondition, field: SearchField<I>) =>
  condition.kind === "text" && field.kind === "quantity";

function createItemTest<I>(condition: SearchCondition, field: SearchField<I>): ItemTest<I> | undefined {
  if (condition.kind === "text" && field.kind === "text") {
    const test = createTextTest(condition);

    return (item) => toTexts(field.getValues(item)).some(test);
  }

  // A field that was a text one (restarts) and is a number now: a search saved when it was text
  // reads the amount as the text it was, so that it finds what it found.
  if (condition.kind === "text" && field.kind === "quantity") {
    const test = createTextTest(condition);

    return (item) => {
      const amount = field.getQuantity(item);

      return amount !== undefined && test(String(amount));
    };
  }

  if (condition.kind === "quantity" && field.kind === "quantity") {
    const test = createQuantityTest(condition);

    return (item) => test(field.getQuantity(item));
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

/**
 * A key of what `createConditionMatcher` would compile out of these conditions: the conditions that
 * are in effect and that a field of the list can read, in order. Two sets of conditions with the
 * same key over the same fields compile to matchers that match the same items, so a list can keep
 * its matcher, and the items it filtered, when an edit leaves the key as it was (an empty condition
 * added, an unfinished quantity typed).
 */
export function getEffectiveConditionsKey<I>(
  conditions: readonly SearchCondition[],
  fields: readonly SearchField<I>[],
): string {
  const fieldsById = new Map(fields.map((field) => [field.id, field]));
  const effective: string[][] = [];

  for (const condition of conditions) {
    const field = fieldsById.get(condition.field);

    // A condition of another kind than its field's gets no test in createItemTest.
    if (
      !field ||
      (field.kind !== condition.kind && !isTextOnNumberField(condition, field)) ||
      !isConditionInEffect(condition)
    ) {
      continue;
    }

    effective.push([
      condition.field,
      condition.kind,
      condition.operator,
      condition.negate ? "1" : "0",
      condition.value,
      condition.kind === "text" && condition.loose ? "loose" : "",
    ]);
  }

  return JSON.stringify(effective);
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
