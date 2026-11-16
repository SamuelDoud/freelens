/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import {
  createCondition,
  quickSearchCondition,
  toLocalDateTimeInput,
  withField,
  withTextOperator,
  withTimeOperator,
} from "./condition-editing";

import type { SearchField } from "../common/conditions";

const name: SearchField<unknown> = { id: "name", title: "Name", kind: "text", getValues: () => "" };
const namespace: SearchField<unknown> = { id: "namespace", title: "Namespace", kind: "text", getValues: () => "" };
const age: SearchField<unknown> = { id: "age", title: "Age", kind: "time", getTime: () => 0 };
const now = new Date(2026, 10, 13, 9, 5).getTime();

describe("condition editing", () => {
  it("starts a text condition with contains and a time condition with before now", () => {
    expect(createCondition(name, now, "a")).toEqual({
      id: "a",
      kind: "text",
      field: "name",
      operator: "contains",
      value: "",
      negate: false,
    });
    expect(createCondition(age, now, "b")).toMatchObject({
      kind: "time",
      operator: "before",
      value: "2026-11-13T09:05",
    });
  });

  it("keeps operator and value on a field of the same kind and starts over on another kind, keeping NOT", () => {
    const condition = { ...withTextOperator(createCondition(name, now, "a"), "regex"), value: "^api", negate: true };

    expect(withField(condition, namespace, now)).toEqual({ ...condition, field: "namespace" });
    expect(withField(condition, age, now)).toMatchObject({ id: "a", kind: "time", field: "age", negate: true });
  });

  it("resets the value only when switching between a date-time and a duration", () => {
    const before = createCondition(age, now, "a");

    expect(withTimeOperator(before, "after", now)).toMatchObject({ operator: "after", value: "2026-11-13T09:05" });
    expect(withTimeOperator(before, "olderThan", now)).toMatchObject({ operator: "olderThan", value: "1d" });

    const older = { ...withTimeOperator(before, "olderThan", now), value: "3h" };

    expect(withTimeOperator(older, "newerThan", now)).toMatchObject({ operator: "newerThan", value: "3h" });
  });

  it("formats a time for a datetime-local input", () => {
    expect(toLocalDateTimeInput(new Date(2026, 0, 2, 3, 4).getTime())).toBe("2026-01-02T03:04");
  });

  it("saves the quick search loose, and drops that when the operator stops being contains", () => {
    const quick = quickSearchCondition("nginx");

    expect(quick).toMatchObject({ field: "any", operator: "contains", loose: true });
    expect(withTextOperator(quick, "contains")).toMatchObject({ loose: true });
    expect(withTextOperator(quick, "exactly")).not.toHaveProperty("loose");
    expect(createCondition(name, now, "a")).not.toHaveProperty("loose");
  });
});
