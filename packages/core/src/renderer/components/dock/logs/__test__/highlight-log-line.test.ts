/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { AnsiUp } from "ansi_up";
import { describe, expect, it } from "vitest";
import { SearchStore } from "../../../../search-store/search-store";
import { markMatches, overlayMarkersToHtml } from "../highlight-log-line";

const tagged = "2026-01-01T00:00:00Z \u001B[38;5;30m[pod-a]\u001B[0m started 38 workers";
const render = (line: string, query: string, active = -1) =>
  overlayMarkersToHtml(new AnsiUp().ansi_to_html(markMatches(line, query, (n) => n === active) ?? line));

describe("highlighting in a line with color codes", () => {
  it("does not find a query inside an escape sequence, and finds the same as the search counts", () => {
    const store = new SearchStore();

    store.onSearch([tagged], "38");

    expect(store.totalFinds).toBe(1);
    expect(render(tagged, "38")).toContain('<span class="overlay">38</span> workers');
    expect(render(tagged, "38").match(/class="overlay"/g)).toHaveLength(1);
  });

  it("finds a query that spans a color code, in the text as it is seen", () => {
    const store = new SearchStore();

    store.onSearch([tagged], "z [pod");

    expect(store.totalFinds).toBe(1);
    expect(render(tagged, "z [pod").match(/class="overlay"/g)).toHaveLength(2);
  });

  it("marks the active match", () => {
    expect(render("a b a", "a", 1)).toBe('<span class="overlay">a</span> b <span class="overlay active">a</span>');
  });

  it("finds nothing in a line without a match", () => {
    expect(markMatches("abc", "x", () => false)).toBeUndefined();
  });
});

describe("the search store", () => {
  it("clears the active match when a later search finds nothing", () => {
    const store = new SearchStore();

    store.onSearch(["a", "a", "a"], "a");
    store.setNextOverlayActive();
    store.onSearch(["a", "a", "a"], "zzz");

    expect(store.activeOverlayIndex).toBe(-1);
    expect(store.activeFind).toBe(0);
  });
});
