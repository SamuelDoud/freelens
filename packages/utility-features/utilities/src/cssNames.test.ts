/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { cssNames } from "./cssNames";
import { iter } from "./iter";
import { object } from "./object";
import { isObject } from "./type-narrowing";

import type { IClassName } from "./cssNames";

// The generator chain cssNames was built on before.
function reference(...classNames: IClassName[]): string {
  const classNamesEnabled = new Map<string, boolean>();

  for (const className of classNames) {
    if (typeof className === "string") {
      classNamesEnabled.set(className, true);
    } else if (Array.isArray(className)) {
      for (const name of className) {
        classNamesEnabled.set(name, true);
      }
    } else if (isObject(className)) {
      for (const [name, value] of object.entries(className)) {
        classNamesEnabled.set(name, Boolean(value));
      }
    }
  }

  return iter
    .chain(classNamesEnabled.entries())
    .filter(([, isActive]) => isActive)
    .filterMap(([className]) => className.trim())
    .join(" ");
}

describe("cssNames", () => {
  it.each<IClassName[]>([
    [],
    ["a"],
    ["a", "b", "a"],
    ["a b", " c ", ""],
    ["a", { a: false, b: true }],
    [{ a: false }, "a"],
    [{ b: 1, c: 0, d: "x", e: null, f: undefined }],
    ["a", ["b", "c"], { d: true }, undefined, null, false, 5, Symbol("s"), () => "x"],
    [["a", "a "], "a"],
    ["  ", { " ": true }, ["  "]],
    [{ 1: true, b: true, 0: true }],
    ["z", "a", { m: true }, "a"],
  ])("gives what it gave before for %j", (...classNames) => {
    expect(cssNames(...classNames)).toBe(reference(...classNames));
  });

  it("puts a name where it was first given, with the last value deciding", () => {
    expect(cssNames("a", "b", { a: false }, "c")).toBe("b c");
    expect(cssNames("a", "b", { a: false }, "a")).toBe("a b");
  });

  it("gives the same for random mixes", () => {
    let seed = 5;
    const next = () => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;

      return seed / 4294967296;
    };
    const names = ["a", "b", " c", "d ", "", "e f", "g"];
    const pick = () => names[Math.floor(next() * names.length)];

    for (let round = 0; round < 500; round++) {
      const args: IClassName[] = Array.from({ length: Math.floor(next() * 6) }, () => {
        const kind = next();

        if (kind < 0.3) return pick();
        if (kind < 0.5) return [pick(), pick()];
        if (kind < 0.8) return { [pick()]: next() < 0.5, [pick()]: next() < 0.5 };

        return next() < 0.5 ? undefined : false;
      });

      expect(cssNames(...args)).toBe(reference(...args));
    }
  });
});
