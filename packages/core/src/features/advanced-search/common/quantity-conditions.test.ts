/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { createConditionMatcher, getConditionError, isConditionInEffect } from "./create-condition-matcher";
import { describeCondition } from "./describe-condition";
import { readSavedSearches } from "./saved-searches";

import type { QuantitySearchOperator, SearchCondition, SearchField } from "./conditions";

interface Item {
  name: string;
  cpuLimit?: number;
}

const fields: SearchField<Item>[] = [
  { id: "cpuLimit", title: "CPU limit", kind: "quantity", unit: "cpu", getQuantity: (item) => item.cpuLimit },
];

const items: Item[] = [
  { name: "small", cpuLimit: 0.25 },
  { name: "half", cpuLimit: 0.5 },
  { name: "big", cpuLimit: 2 },
  { name: "unbounded" },
];

const quantity = (operator: QuantitySearchOperator, value = "", negate = false): SearchCondition => ({
  id: `${operator}-${value}`,
  kind: "quantity",
  field: "cpuLimit",
  operator,
  value,
  negate,
});

const matching = (...conditions: SearchCondition[]) => {
  const matcher = createConditionMatcher(conditions, fields)!;

  return items.filter((item) => matcher.matches(item, 0)).map(({ name }) => name);
};

describe("quantity conditions", () => {
  it("compare amounts written in any unit", () => {
    expect(matching(quantity("moreThan", "300m"))).toEqual(["half", "big"]);
    expect(matching(quantity("lessThan", "1"))).toEqual(["small", "half"]);
    expect(matching(quantity("exactly", "0.5"))).toEqual(["half"]);
    expect(matching(quantity("exactly", "500m"))).toEqual(["half"]);
  });

  it("find the items with or without the amount", () => {
    expect(matching(quantity("isSet"))).toEqual(["small", "half", "big"]);
    expect(matching(quantity("isSet", "", true))).toEqual(["unbounded"]);
    expect(isConditionInEffect(quantity("isSet"))).toBe(true);
  });

  it("explain a value that is not a quantity", () => {
    expect(getConditionError(quantity("moreThan", "lots"))).toMatch(/quantity/);
    expect(getConditionError(quantity("moreThan", "2Gi"))).toBeUndefined();
  });

  it("describe themselves", () => {
    expect(describeCondition(quantity("moreThan", "500m"), "CPU limit")).toBe("CPU limit more than 500m");
    expect(describeCondition(quantity("isSet", "", true), "CPU limit")).toBe("NOT CPU limit is set");
  });

  it("are kept in saved searches", () => {
    const [saved] = readSavedSearches([
      {
        id: "s",
        name: "Big",
        viewKey: "v1/Pod",
        routePath: "/pods",
        conditions: [quantity("moreThan", "1"), { ...quantity("moreThan", "1"), operator: "bogus" }],
      },
    ]);

    expect(saved.conditions).toEqual([quantity("moreThan", "1")]);
  });
});
