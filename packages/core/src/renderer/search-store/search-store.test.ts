/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it } from "vitest";
import directoryForUserDataInjectable from "../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { getDiForUnitTesting } from "../getDiForUnitTesting";
import { SearchStore } from "./search-store";
import searchStoreInjectable from "./search-store.injectable";

const logs = [
  "1:M 30 Oct 2020 16:17:41.553 # Connection with replica 172.17.0.12:6379 lost",
  "1:M 30 Oct 2020 16:17:41.623 * Replica 172.17.0.12:6379 asks for synchronization",
  "1:M 30 Oct 2020 16:17:41.623 * Starting Partial resynchronization request from 172.17.0.12:6379 accepted. Sending 0 bytes of backlog starting from offset 14407.",
];

describe("search store tests", () => {
  let searchStore: SearchStore;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-directory-for-user-data");

    searchStore = di.inject(searchStoreInjectable);
  });

  it("does nothing with empty search query", () => {
    searchStore.onSearch([], "");
    expect(searchStore.occurrences).toEqual([]);
  });

  it("doesn't break if no text provided", () => {
    searchStore.onSearch(null, "replica");
    expect(searchStore.occurrences).toEqual([]);

    searchStore.onSearch([], "replica");
    expect(searchStore.occurrences).toEqual([]);
  });

  it("find 3 occurrences across 3 lines", () => {
    searchStore.onSearch(logs, "172");
    expect(searchStore.occurrences).toEqual([0, 1, 2]);
  });

  it("find occurrences within 1 line (case-insensitive)", () => {
    searchStore.onSearch(logs, "Starting");
    expect(searchStore.occurrences).toEqual([2, 2]);
  });

  it("sets overlay index equal to first occurrence", () => {
    searchStore.onSearch(logs, "Replica");
    expect(searchStore.activeOverlayIndex).toBe(0);
  });

  it("set overlay index to next occurrence", () => {
    searchStore.onSearch(logs, "172");
    searchStore.setNextOverlayActive();
    expect(searchStore.activeOverlayIndex).toBe(1);
  });

  it("sets overlay to last occurrence", () => {
    searchStore.onSearch(logs, "172");
    searchStore.setPrevOverlayActive();
    expect(searchStore.activeOverlayIndex).toBe(2);
  });

  it("gets line index where overlay is located", () => {
    searchStore.onSearch(logs, "synchronization");
    expect(searchStore.activeOverlayLine).toBe(1);
  });

  it("escapes string for using in regex", () => {
    const regex = SearchStore.escapeRegex("some.interesting-query\\#?()[]");

    expect(regex).toBe("some\\.interesting\\-query\\\\\\#\\?\\(\\)\\[\\]");
  });

  it("gets active find number", () => {
    searchStore.onSearch(logs, "172");
    searchStore.setNextOverlayActive();
    expect(searchStore.activeFind).toBe(2);
  });

  it("gets total finds number", () => {
    searchStore.onSearch(logs, "Starting");
    expect(searchStore.totalFinds).toBe(2);
  });

  describe("isActiveOverlay", () => {
    it("matches the first-index lookup for present and absent lines", () => {
      const lines = Array.from({ length: 200 }, (_, i) => (i % 7 === 0 || i % 11 === 0 ? "foo foo bar foo" : "x"));

      searchStore.onSearch(lines, "foo");

      const occurrences = [...searchStore.occurrences];

      for (let active = -1; active < occurrences.length; active += 13) {
        searchStore.activeOverlayIndex = active;

        for (let line = -2; line < 205; line++) {
          for (let occurrence = 0; occurrence < 4; occurrence++) {
            const first = occurrences.findIndex((item) => item === line);

            expect(searchStore.isActiveOverlay(line, occurrence)).toBe(first + occurrence === active);
          }
        }
      }
    });

    it("keeps the -1 + occurrence arithmetic for a line without occurrences", () => {
      searchStore.onSearch(["a", "b"], "zzz");
      expect(searchStore.isActiveOverlay(0, 0)).toBe(true);
      expect(searchStore.isActiveOverlay(0, 1)).toBe(false);
    });
  });
});
