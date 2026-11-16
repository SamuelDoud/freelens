/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it, vi } from "vitest";
import { mapLinesIncremental } from "../map-lines-incremental";

import type { MappedLines } from "../map-lines-incremental";

// A small deterministic generator, so that a failure can be reproduced.
function createRandom(seed: number) {
  let state = seed;

  return (limit: number) => {
    state = (state * 1664525 + 1013904223) >>> 0;

    return state % limit;
  };
}

describe("mapLinesIncremental", () => {
  it("maps every line the first time", () => {
    const map = vi.fn((line: string) => line.toUpperCase());

    expect(mapLinesIncremental(undefined, ["a", "b"], map).output).toEqual(["A", "B"]);
    expect(map).toHaveBeenCalledTimes(2);
  });

  it("maps only the new lines when lines are added at the bottom", () => {
    const map = vi.fn((line: string) => line.toUpperCase());
    const first = mapLinesIncremental(undefined, ["a", "b"], map);

    map.mockClear();

    const second = mapLinesIncremental(first, ["a", "b", "c"], map);

    expect(second.output).toEqual(["A", "B", "C"]);
    expect(map).toHaveBeenCalledTimes(1);
  });

  it("keeps the lines that are left when lines are dropped at the top", () => {
    const map = vi.fn((line: string) => line.toUpperCase());
    const first = mapLinesIncremental(undefined, ["a", "b", "c"], map);

    map.mockClear();

    expect(mapLinesIncremental(first, ["b", "c", "d"], map).output).toEqual(["B", "C", "D"]);
    expect(map).toHaveBeenCalledTimes(1);
  });

  it("returns the same state for the same source", () => {
    const source = ["a"];
    const first = mapLinesIncremental(undefined, source, (line) => line);

    expect(mapLinesIncremental(first, source, () => "never")).toBe(first);
  });

  it("handles empty sources", () => {
    const first = mapLinesIncremental(undefined, ["a"], (line) => line);

    expect(mapLinesIncremental(first, [], (line) => line).output).toEqual([]);
    expect(mapLinesIncremental(undefined, [], (line) => line).output).toEqual([]);
    expect(mapLinesIncremental({ source: [], output: [] }, ["a"], (line) => line).output).toEqual(["a"]);
  });

  it("equals a plain map for random logs that drop, gain, repeat and replace lines", () => {
    const random = createRandom(7);
    const map = (line: string) => `<${line}>`;

    for (let round = 0; round < 300; round += 1) {
      // Few distinct lines, so that the first line often occurs again.
      const makeLine = () => `line ${random(6)}`;
      let source = Array.from({ length: random(40) }, makeLine);
      let state: MappedLines<string, string> | undefined = mapLinesIncremental(undefined, source, map);

      for (let poll = 0; poll < 10; poll += 1) {
        const kind = random(4);

        if (kind === 0) {
          source = [...source.slice(random(source.length + 1)), ...Array.from({ length: random(10) }, makeLine)];
        } else if (kind === 1) {
          source = Array.from({ length: random(40) }, makeLine);
        } else if (kind === 2) {
          source = [...Array.from({ length: random(10) }, makeLine), ...source];
        } else {
          source = [...source];
          source[random(source.length + 1)] = makeLine();
        }

        state = mapLinesIncremental(state, source, map);

        expect(state.output).toEqual(source.map(map));
      }
    }
  });
});
