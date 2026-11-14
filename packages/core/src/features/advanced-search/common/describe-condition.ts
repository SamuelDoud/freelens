/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  isRelativeTimeOperator,
  quantitySearchOperators,
  takesNoValue,
  textSearchOperators,
  timeSearchOperators,
} from "./conditions";
import { parseLocalDateTime } from "./create-condition-matcher";

import type { SearchCondition } from "./conditions";

const operatorsOf = (condition: SearchCondition) => {
  switch (condition.kind) {
    case "text":
      return textSearchOperators;
    case "time":
      return timeSearchOperators;
    case "quantity":
      return quantitySearchOperators;
  }
};

const operatorLabel = (condition: SearchCondition) =>
  operatorsOf(condition).find(({ id }) => id === condition.operator)?.label ?? condition.operator;

function describeValue(condition: SearchCondition): string {
  if (condition.kind === "text") {
    return condition.operator === "regex" ? `/${condition.value}/` : `"${condition.value}"`;
  }

  if (condition.kind === "quantity") {
    return condition.value.trim();
  }

  if (isRelativeTimeOperator(condition.operator)) {
    return condition.value.trim();
  }

  const time = parseLocalDateTime(condition.value);

  if (Number.isNaN(time)) {
    return condition.value;
  }

  return new Date(time).toLocaleString(
    undefined,
    condition.operator === "on" ? { dateStyle: "medium" } : { dateStyle: "medium", timeStyle: "short" },
  );
}

/**
 * A one-line description of a condition, such as
 * `NOT Namespace exactly "kube-system"` or `Age older than 2h`.
 */
export function describeCondition(condition: SearchCondition, fieldTitle: string): string {
  const value = takesNoValue(condition) ? "" : ` ${describeValue(condition)}`;

  return `${condition.negate ? "NOT " : ""}${fieldTitle} ${operatorLabel(condition)}${value}`;
}
