/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { parseJsonInSlices, sliceThreshold } from "@freelensapp/json-api";
import { describe, expect, it, vi } from "vitest";

const pod = (i: number, extra: Record<string, unknown> = {}) => ({
  metadata: {
    name: `pod-${i}`,
    namespace: `ns-${i % 7}`,
    uid: `uid-${i}`,
    labels: { app: `app-${i % 3}`, "pod-template-hash": "5b6fcb5d48" },
    managedFields: [{ manager: "kubelet", fieldsV1: { "f:metadata": { "f:labels": { ".": {} } } } }],
  },
  spec: {
    containers: [
      { name: "a", image: "nginx:1.25", ports: [{ containerPort: 80 }] },
      { name: "b", image: "busybox", env: [{ name: "X", value: "y" }] },
    ],
  },
  status: { phase: "Running", restarts: i, ratio: 0.1 + i / 3 },
  ...extra,
});

const trickyItem = (i: number) =>
  JSON.stringify({
    metadata: { name: `p${i}`, annotations: { x: 'ends like },{"metadata":', y: '},{"metadata":' } },
    spec: { template: { metadata: { name: "t" } } },
    more: [{ k: 1 }, { metadata: 2 }],
  });

const listText = (items: string[], before = '"kind":"PodList","apiVersion":"v1","metadata":{"resourceVersion":"1"}') =>
  `{${before},"items":[${items.join(",")}]}`;

/** A text over the threshold, made of items from `make`. */
const bigList = (make: (i: number) => string, before?: string) => {
  const items: string[] = [];
  let size = 0;

  for (let i = 0; size < sliceThreshold * 1.5; i += 1) {
    const item = make(i);

    items.push(item);
    size += item.length;
  }

  return listText(items, before);
};

const expectSameAsJsonParse = async (text: string) => {
  const expected = JSON.parse(text);
  const actual = await parseJsonInSlices(text);

  expect(actual).toEqual(expected);
  // toEqual ignores key order and does not tell -0 from 0
  expect(JSON.stringify(actual)).toBe(JSON.stringify(expected));
  expect(Object.keys(actual as object)).toEqual(Object.keys(expected));
  expect(Object.is((actual as any).items[0]?.status?.zero, -0)).toBe(Object.is(expected.items[0]?.status?.zero, -0));
};

describe("parseJsonInSlices", () => {
  it("parses a large pod list like JSON.parse", async () => {
    await expectSameAsJsonParse(bigList((i) => JSON.stringify(pod(i))));
  });

  it("really parses in slices, also past a separator inside a nested array", async () => {
    for (const make of [(i: number) => JSON.stringify(pod(i)), trickyItem]) {
      const text = bigList(make);
      const parse = vi.spyOn(JSON, "parse");

      await parseJsonInSlices(text);

      // the head, then one call per batch, and no plain call of the whole text
      expect(parse.mock.calls.length).toBeGreaterThan(3);
      expect(parse.mock.calls.every(([input]) => String(input).length < text.length)).toBe(true);
      parse.mockRestore();
    }
  });

  it("parses a text below the threshold like JSON.parse", async () => {
    await expectSameAsJsonParse(listText([JSON.stringify(pod(1)), JSON.stringify(pod(2))]));
  });

  it("keeps numbers, -0, unicode escapes, escaped quotes and backslashes", async () => {
    const odd = (i: number) =>
      `{"metadata":{"name":"p${i}","annotations":{"a":"\\u00e9\\ud83d\\ude00\\"\\\\","b":"\\\\\\\\"}},"status":{"zero":-0,"big":12345678901234567890,"exp":1e400,"small":1.5E-7,"int":${i}}}`;

    await expectSameAsJsonParse(bigList(odd));
  });

  it("keeps __proto__ and constructor keys as own properties", async () => {
    const text = bigList(
      (i) => `{"metadata":{"name":"p${i}","labels":{"__proto__":{"polluted":true},"constructor":"x"}}}`,
    );
    const actual = (await parseJsonInSlices(text)) as { items: { metadata: { labels: object } }[] };

    expect(Object.hasOwn(actual.items[0].metadata.labels, "__proto__")).toBe(true);
    expect(({} as any).polluted).toBeUndefined();
    await expectSameAsJsonParse(text);
  });

  it("is not fooled by the item separator inside strings and nested objects", async () => {
    await expectSameAsJsonParse(bigList(trickyItem));
  });

  it("handles items that are not objects", async () => {
    await expectSameAsJsonParse(bigList((i) => (i % 2 ? `${i}` : `"s${i}"`)));
  });

  it("handles other keys after, before and around the items", async () => {
    const make = (i: number) => JSON.stringify(pod(i));

    await expectSameAsJsonParse(bigList(make, '"items2":1,"kind":"X","metadata":{"items":[1,2]},"zz":"\\"items\\":["'));
  });

  it("falls back for items that are not the last key, and for duplicate keys", async () => {
    const items = bigList((i) => JSON.stringify(pod(i)));

    await expectSameAsJsonParse(`${items.slice(0, -1)},"after":1}`);
    await expectSameAsJsonParse(`${items.slice(0, -1)},"items":[1]}`);
  });

  it("parses pretty-printed JSON and an empty list", async () => {
    const pretty = JSON.stringify({ kind: "PodList", items: Array.from({ length: 4000 }, (_, i) => pod(i)) }, null, 2);

    await expectSameAsJsonParse(pretty);
    await expectSameAsJsonParse(`{"kind":"PodList","metadata":{"pad":"${"x".repeat(sliceThreshold)}"},"items":[]}`);
  });

  it("throws what JSON.parse throws for broken text", async () => {
    const text = bigList((i) => JSON.stringify(pod(i)));
    const broken = [
      text.slice(0, -1),
      text.replace("},{", "}{"),
      text.replace("},{", "},,{"),
      `${text.slice(0, -3)},]}`,
      text.replace('"status":{"phase":"Running"', '"status":{"phase":Running'),
      `${text}x`,
    ];

    for (const input of broken) {
      let expected: unknown;

      try {
        JSON.parse(input);
      } catch (error) {
        expected = error;
      }

      expect(expected).toBeDefined();
      await expect(parseJsonInSlices(input)).rejects.toThrow((expected as Error).message);
    }
  });

  it("yields to the event loop while parsing a large list", async () => {
    let ticks = 0;
    const timer = setInterval(() => {
      ticks += 1;
    }, 0);
    const text = bigList((i) => JSON.stringify(pod(i)));

    await parseJsonInSlices(text);
    clearInterval(timer);

    expect(ticks).toBeGreaterThan(0);
  });
});
