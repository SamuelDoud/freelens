/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ItemObject } from "@freelensapp/list-layout";

import type { ListLayoutSearchFilter } from "./list-layout";

type Kind = "plain" | "stripped";

const hasSeparator = /[-_]/;

// One string per item for the filters it was read with, of the kind the current query needs: a
// query with a dash or an underscore only matches the plain text, one without matches exactly when
// the text without those characters contains it. Switching kinds starts the cache over, so memory
// stays at one flat string per live item. Entries go with the item they belong to, and a watch
// event makes a new object, so a changed item is read again.
const textCaches = new WeakMap<readonly object[], { kind: Kind; byItem: WeakMap<object, string> }>();

function getSearchText<I extends ItemObject>(
  item: I,
  filters: readonly ListLayoutSearchFilter<I>[],
  kind: Kind,
): string {
  let cache = textCaches.get(filters);

  if (!cache || cache.kind !== kind) {
    cache = { kind, byItem: new WeakMap() };
    textCaches.set(filters, cache);
  }

  let text = cache.byItem.get(item);

  if (text === undefined) {
    text = filters
      .flatMap((getTexts) => [getTexts(item)].flat())
      .map((value) => String(value).toLowerCase())
      .join("\0");

    if (kind === "stripped") {
      // split and join give a flat string, where replace keeps a tree of pieces that takes twice the memory.
      text = text.split(/[-_]/).join("");
    }

    cache.byItem.set(item, text);
  }

  return text;
}

/**
 * The items that `createSearchMatcher(search)` accepts a value of, for any of the texts of the
 * filters, found in the cached text of each item. Only for filters that read nothing but their
 * item: the text is kept until the item is replaced.
 */
export function filterBySearchText<I extends ItemObject>(
  items: I[],
  filters: readonly ListLayoutSearchFilter<I>[],
  search: string,
): I[] {
  const query = search.toLowerCase();
  // A query with a separator can only match the plain text; one without, the text without them.
  const kind: Kind = hasSeparator.test(query) ? "plain" : "stripped";

  return items.filter((item) => getSearchText(item, filters, kind).includes(query));
}

/** Whether the cache can answer for this query: a text joined with NUL cannot tell a NUL in the query. */
export const canSearchByText = (search: string) => !search.includes("\0");
