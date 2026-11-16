/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { SearchStore } from "../../../search-store/search-store";

// Private-use characters that stand for the overlay tags until the line is converted to HTML.
const openOverlay = "";
const openActiveOverlay = "";
const closeOverlay = "";

/**
 * Marks the matches of a query in a line that holds color escape sequences.
 * The matches are found in the text without the sequences, as the search
 * counts them, and are mapped back to it: a match that spans a sequence is
 * closed before it and opened again after it, so that no sequence is split
 * and the tags stay nested in the colors.
 *
 * @param isActive whether the n-th match of the line is the active one
 * @returns the line with markers, or undefined when it has no match
 */
export function markMatches(
  line: string,
  query: string,
  isActive: (occurrence: number) => boolean,
): string | undefined {
  const parts = line.split(/(\u001B\[[\d;]*m)/);
  const text = parts.filter((_, index) => index % 2 === 0).join("");
  const regex = new RegExp(SearchStore.escapeRegex(query), "gi");
  const matches: { start: number; end: number }[] = [];

  for (let match = regex.exec(text); match; match = regex.exec(text)) {
    if (match[0] === "") {
      regex.lastIndex += 1;
      continue;
    }

    matches.push({ start: match.index, end: match.index + match[0].length });
  }

  if (matches.length === 0) {
    return undefined;
  }

  let result = "";
  let offset = 0;

  parts.forEach((part, index) => {
    if (index % 2 === 1) {
      result += part;

      return;
    }

    const partEnd = offset + part.length;
    let cursor = offset;

    matches.forEach((match, occurrence) => {
      const start = Math.max(match.start, offset);
      const end = Math.min(match.end, partEnd);

      if (start >= end) {
        return;
      }

      result += part.slice(cursor - offset, start - offset);
      result += `${isActive(occurrence) ? openActiveOverlay : openOverlay}${part.slice(start - offset, end - offset)}${closeOverlay}`;
      cursor = end;
    });

    result += part.slice(cursor - offset);
    offset = partEnd;
  });

  return result;
}

/** Turns the markers of `markMatches`, kept intact by the HTML conversion, into the overlay tags. */
export function overlayMarkersToHtml(html: string): string {
  return html
    .replaceAll(openOverlay, '<span class="overlay">')
    .replaceAll(openActiveOverlay, '<span class="overlay active">')
    .replaceAll(closeOverlay, "</span>");
}
