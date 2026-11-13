/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { createConditionMatcher, getConditionError, parseLocalDateTime } from "./create-condition-matcher";
import { describeCondition } from "./describe-condition";
import { parseDuration } from "./duration";

import type { SearchCondition, SearchField, TextSearchOperator, TimeSearchOperator } from "./conditions";

interface Item {
  name: string;
  namespace: string;
  labels: string[];
  created?: number;
}

const fields: SearchField<Item>[] = [
  { id: "name", title: "Name", kind: "text", getValues: (item) => item.name },
  { id: "namespace", title: "Namespace", kind: "text", getValues: (item) => item.namespace },
  { id: "labels", title: "Labels", kind: "text", getValues: (item) => item.labels },
  { id: "age", title: "Age", kind: "time", getTime: (item) => item.created },
];

let nextId = 0;

const text = (field: string, operator: TextSearchOperator, value: string, negate = false): SearchCondition => ({
  id: String(nextId++),
  kind: "text",
  field,
  operator,
  value,
  negate,
});

const time = (operator: TimeSearchOperator, value: string, negate = false): SearchCondition => ({
  id: String(nextId++),
  kind: "time",
  field: "age",
  operator,
  value,
  negate,
});

const at = (value: string) => parseLocalDateTime(value);
const hour = 60 * 60 * 1000;
const now = at("2026-11-13T12:00");

const items: Item[] = [
  { name: "api-server", namespace: "default", labels: ["app=api", "tier=backend"], created: at("2026-11-01T09:30") },
  { name: "web-frontend", namespace: "default", labels: ["app=web"], created: at("2026-11-12T23:59") },
  { name: "coredns", namespace: "kube-system", labels: ["k8s-app=kube-dns"], created: at("2026-11-13T00:00") },
  { name: "API-gateway", namespace: "edge", labels: [], created: now - 30 * 60 * 1000 },
  { name: "no-timestamp", namespace: "edge", labels: [] },
];

const names = (conditions: SearchCondition[]) => {
  const matcher = createConditionMatcher(conditions, fields);

  return matcher ? items.filter((item) => matcher.matches(item, now)).map(({ name }) => name) : undefined;
};

describe("createConditionMatcher", () => {
  it("returns no matcher without a condition in effect", () => {
    expect(names([])).toBeUndefined();
    expect(names([text("name", "contains", "  ")])).toBeUndefined();
    expect(names([text("name", "regex", "(")])).toBeUndefined();
    expect(names([text("unknown-field", "contains", "api")])).toBeUndefined();
  });

  it.each([
    ["exactly", "coredns", ["coredns"]],
    ["exactly", "CoreDNS", ["coredns"]],
    ["exactly", "core", []],
    ["startsWith", "api", ["api-server", "API-gateway"]],
    ["contains", "end", ["web-frontend"]],
    ["regex", "^(api|web)-", ["api-server", "web-frontend", "API-gateway"]],
  ] as const)("matches %s %j ignoring case", (operator, value, expected) => {
    expect(names([text("name", operator, value)])).toEqual(expected);
  });

  it("negates a condition", () => {
    expect(names([text("namespace", "exactly", "default", true)])).toEqual(["coredns", "API-gateway", "no-timestamp"]);
  });

  it("matches a multi-valued field when any value matches, and its negation when none does", () => {
    expect(names([text("labels", "startsWith", "app=")])).toEqual(["api-server", "web-frontend"]);
    expect(names([text("labels", "exactly", "tier=backend", true)])).toEqual([
      "web-frontend",
      "coredns",
      "API-gateway",
      "no-timestamp",
    ]);
  });

  it("combines conditions on one field with OR, fields with AND, and negations always with AND", () => {
    expect(
      names([
        text("name", "startsWith", "api"),
        text("name", "startsWith", "web"),
        text("namespace", "exactly", "default"),
      ]),
    ).toEqual(["api-server", "web-frontend"]);

    expect(
      names([
        text("name", "contains", "a"),
        text("name", "contains", "e"),
        text("name", "contains", "gateway", true),
        text("name", "contains", "timestamp", true),
      ]),
    ).toEqual(["api-server", "web-frontend", "coredns"]);
  });

  it("ignores an invalid condition rather than rejecting every item", () => {
    expect(names([text("name", "regex", "[unclosed"), text("namespace", "exactly", "edge")])).toEqual([
      "API-gateway",
      "no-timestamp",
    ]);
  });

  it("compares times before and after a local date-time", () => {
    expect(names([time("before", "2026-11-12T23:59")])).toEqual(["api-server"]);
    expect(names([time("after", "2026-11-12T23:59")])).toEqual(["coredns", "API-gateway"]);
  });

  it("matches the whole local calendar day for on", () => {
    expect(names([time("on", "2026-11-12T08:15")])).toEqual(["web-frontend"]);
    expect(names([time("on", "2026-11-13T23:00")])).toEqual(["coredns", "API-gateway"]);
  });

  it("measures relative times back from now and reports that it reads the clock", () => {
    expect(names([time("newerThan", "1h")])).toEqual(["API-gateway"]);
    expect(names([time("olderThan", "1d")])).toEqual(["api-server"]);
    expect(createConditionMatcher([time("olderThan", "1d")], fields)?.usesClock).toBe(true);
    expect(createConditionMatcher([time("before", "2026-11-12T00:00")], fields)?.usesClock).toBe(false);

    const matcher = createConditionMatcher([time("newerThan", "1h")], fields);
    const gateway = items[3];

    expect(matcher?.matches(gateway, now)).toBe(true);
    expect(matcher?.matches(gateway, now + hour)).toBe(false);
  });

  it("matches an item without a time by negated time conditions only", () => {
    expect(names([time("olderThan", "1w", true)])).toContain("no-timestamp");
    expect(names([time("olderThan", "1w")])).not.toContain("no-timestamp");
  });

  it("ignores a condition whose kind does not fit its field", () => {
    expect(names([{ ...time("before", "2026-11-12T00:00"), field: "name" }])).toBeUndefined();
  });
});

describe("getConditionError", () => {
  it("reports an invalid regex, duration or date, and accepts an empty value", () => {
    expect(getConditionError(text("name", "regex", "(a"))).toBeDefined();
    expect(getConditionError(time("olderThan", "2 days"))).toBeDefined();
    expect(getConditionError(time("before", "yesterday"))).toBeDefined();
    expect(getConditionError(text("name", "regex", ""))).toBeUndefined();
    expect(getConditionError(time("olderThan", "1d12h"))).toBeUndefined();
  });
});

describe("parseDuration", () => {
  it.each([
    ["90s", 90_000],
    ["30m", 30 * 60_000],
    ["2h", 2 * hour],
    ["1d12h", 36 * hour],
    [" 1W ", 7 * 24 * hour],
    ["1.5h", 1.5 * hour],
  ])("reads %j", (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });

  it.each(["", "0m", "2", "h", "2 days", "-1h", "1h-"])("rejects %j", (input) => {
    expect(parseDuration(input)).toBeUndefined();
  });
});

describe("parseLocalDateTime", () => {
  it("reads a date alone as the start of the local day", () => {
    expect(parseLocalDateTime("2026-11-13")).toBe(new Date(2026, 10, 13).getTime());
    expect(parseLocalDateTime("2026-11-13T07:05")).toBe(new Date(2026, 10, 13, 7, 5).getTime());
    expect(parseLocalDateTime("13/11/2026")).toBeNaN();
  });
});

describe("describeCondition", () => {
  it("describes text and relative conditions", () => {
    expect(describeCondition(text("namespace", "exactly", "kube-system", true), "Namespace")).toBe(
      'NOT Namespace exactly "kube-system"',
    );
    expect(describeCondition(text("name", "regex", "^api"), "Name")).toBe("Name matches regex /^api/");
    expect(describeCondition(time("olderThan", "2h"), "Age")).toBe("Age older than 2h");
  });
});
