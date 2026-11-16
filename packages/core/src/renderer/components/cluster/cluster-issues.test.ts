/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { indexFirstWarningById } from "./cluster-issues";

describe("indexFirstWarningById", () => {
  it("gives for every id the warning that find by id gives, for ids that repeat", () => {
    let state = 9;
    const random = (limit: number) => {
      state = (state * 1664525 + 1013904223) >>> 0;

      return state % limit;
    };

    for (let round = 0; round < 200; round += 1) {
      const fixed = Array.from({ length: random(60) }, (_, order) => {
        const id = `uid-${random(15)}`;

        return { order, getId: () => id };
      });
      const index = indexFirstWarningById(fixed);

      for (const warning of fixed) {
        expect(index.get(warning.getId())).toBe(fixed.find((other) => other.getId() == warning.getId()));
      }

      expect(index.has("not-there")).toBe(false);
    }
  });
});
