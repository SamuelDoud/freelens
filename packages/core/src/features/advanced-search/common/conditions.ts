/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * How a text condition compares the field's values with its own value. Every
 * comparison ignores case.
 */
export type TextSearchOperator = "exactly" | "startsWith" | "contains" | "regex";

/**
 * How a time condition compares the field's time with its own value:
 *
 * - `on`, `before` and `after` take a local date-time as `YYYY-MM-DDTHH:mm`.
 *   `on` matches the whole local calendar day of it.
 * - `olderThan` and `newerThan` take a duration such as `30m`, `2h` or `1d12h`,
 *   measured back from now.
 */
export type TimeSearchOperator = "on" | "before" | "after" | "olderThan" | "newerThan";

interface SearchConditionBase {
  /** Identifies the condition within its search, for editing it. */
  readonly id: string;
  /** The id of the field the condition reads. */
  readonly field: string;
  readonly value: string;
  /** When set, the condition holds for the items it would otherwise reject. */
  readonly negate: boolean;
}

export interface TextSearchCondition extends SearchConditionBase {
  readonly kind: "text";
  readonly operator: TextSearchOperator;
}

export interface TimeSearchCondition extends SearchConditionBase {
  readonly kind: "time";
  readonly operator: TimeSearchOperator;
}

export type SearchCondition = TextSearchCondition | TimeSearchCondition;

export type SearchFieldValue = string | number | null | undefined;

export interface TextSearchField<I> {
  readonly id: string;
  readonly title: string;
  readonly kind: "text";
  /** The texts of the field for an item. A condition holds when any of them matches. */
  readonly getValues: (item: I) => SearchFieldValue | readonly SearchFieldValue[];
}

export interface TimeSearchField<I> {
  readonly id: string;
  readonly title: string;
  readonly kind: "time";
  /** The time of the field for an item, in milliseconds since the epoch. */
  readonly getTime: (item: I) => number | null | undefined;
}

/**
 * A field of a list that advanced search can put conditions on.
 */
export type SearchField<I> = TextSearchField<I> | TimeSearchField<I>;

/**
 * A search the user saved to open again. It belongs to one kind of list, the
 * view key, and holds conditions only: the quick search text is saved as an
 * "Any field" condition.
 */
export interface SavedSearch {
  readonly id: string;
  readonly name: string;
  /** The list the search belongs to, `<apiVersionWithGroup>/<kind>` for kube lists. */
  readonly viewKey: string;
  /** The list's name at the time of saving, to show next to the search's name. */
  readonly viewTitle: string;
  /** The path of the list in the cluster frame, to navigate to when the search is opened. */
  readonly routePath: string;
  readonly conditions: readonly SearchCondition[];
  /** ISO 8601 */
  readonly createdAt: string;
}

export const textSearchOperators: readonly { readonly id: TextSearchOperator; readonly label: string }[] = [
  { id: "contains", label: "contains" },
  { id: "exactly", label: "exactly" },
  { id: "startsWith", label: "starts with" },
  { id: "regex", label: "matches regex" },
];

export const timeSearchOperators: readonly { readonly id: TimeSearchOperator; readonly label: string }[] = [
  { id: "before", label: "before" },
  { id: "after", label: "after" },
  { id: "on", label: "on" },
  { id: "olderThan", label: "older than" },
  { id: "newerThan", label: "newer than" },
];

/** The id of the field that stands for the texts the quick search looks at. */
export const anyFieldId = "any";

export const isRelativeTimeOperator = (operator: TimeSearchOperator) =>
  operator === "olderThan" || operator === "newerThan";

export const createConditionId = (): string => globalThis.crypto.randomUUID();
