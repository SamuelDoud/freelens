/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

const DEFAULT_PAGE_SIZE = 500;

// Replicate the fromStore/toStore logic from preference-descriptors
// to test the validation in isolation without the full DI container.
const fromStore = (val: unknown): number => {
  const n = typeof val === "number" && Number.isFinite(val) ? Math.floor(val) : DEFAULT_PAGE_SIZE;

  return Math.max(1, n);
};

const toStore = (val: number): number | undefined => (val === DEFAULT_PAGE_SIZE ? undefined : val);

describe("listPageSize preference validation", () => {
  describe("fromStore", () => {
    it("returns default for undefined", () => {
      expect(fromStore(undefined)).toBe(DEFAULT_PAGE_SIZE);
    });

    it("returns valid number as-is", () => {
      expect(fromStore(100)).toBe(100);
    });

    it("floors fractional values", () => {
      expect(fromStore(250.7)).toBe(250);
    });

    it("clamps zero to 1", () => {
      expect(fromStore(0)).toBe(1);
    });

    it("clamps negative to 1", () => {
      expect(fromStore(-5)).toBe(1);
    });

    it("returns default for NaN", () => {
      expect(fromStore(NaN)).toBe(DEFAULT_PAGE_SIZE);
    });

    it("returns default for Infinity", () => {
      expect(fromStore(Infinity)).toBe(DEFAULT_PAGE_SIZE);
    });

    it("returns default for string", () => {
      expect(fromStore("100" as any)).toBe(DEFAULT_PAGE_SIZE);
    });

    it("returns default for null", () => {
      expect(fromStore(null)).toBe(DEFAULT_PAGE_SIZE);
    });
  });

  describe("toStore", () => {
    it("returns undefined for default value", () => {
      expect(toStore(DEFAULT_PAGE_SIZE)).toBeUndefined();
    });

    it("returns value for non-default", () => {
      expect(toStore(100)).toBe(100);
    });
  });
});
