/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * `JSON.parse` of a large list response (a page of 4,000 pods is about 19 MB)
 * blocks the thread for 50 to 80 ms. `parseJsonInSlices` returns the same
 * value as `JSON.parse`, but parses the `items` array of a list response in
 * batches of whole items and yields to the event loop between them, so no
 * single task runs long.
 *
 * It does not scan the text. It looks for where an item most likely starts
 * (the separator `},{"<first key of the first item>":` with `indexOf`) and
 * lets `JSON.parse` decide whether that guess is right: a batch is accepted
 * only if `JSON.parse` takes it as a complete array of items. Text is parsed
 * strictly left to right, so a prefix that parses as a complete array ends
 * between two items, whatever the guess was; a wrong guess (the separator
 * inside a string or a nested object) makes the batch fail and the next
 * candidate is tried. The text outside the items is parsed by `JSON.parse`
 * as well, with an empty array in place of the items, and the items are then
 * assigned to the key, which keeps its place among the keys. Numbers,
 * escapes, `__proto__` and key order therefore come out as from a single
 * call.
 *
 * Only a response of the shape `{...,"items":[...]}` with `items` as the last
 * key is sliced, which is what the Kubernetes API server sends. Anything
 * else, and anything that fails on the way, is parsed by one plain
 * `JSON.parse` call, which gives the result or throws the error it always
 * gave.
 */

/** Texts shorter than this are parsed in one call: it takes a few milliseconds. */
export const sliceThreshold = 1024 * 1024;

/** Text of the `items` array parsed per `JSON.parse` call, roughly. */
const batchSize = 256 * 1024;

/** Work done in one task before yielding, in milliseconds. */
const taskBudgetMs = 4;

/** Wrong guesses of a batch end tolerated before the plain call is used. */
const maxMisses = 16;

type Scheduler = { yield?: () => Promise<void> };

export function yieldToEventLoop(): Promise<void> {
  const scheduler = (globalThis as { scheduler?: Scheduler }).scheduler;

  if (typeof scheduler?.yield === "function") {
    return scheduler.yield();
  }

  if (typeof MessageChannel === "function") {
    return new Promise<void>((resolve) => {
      const { port1, port2 } = new MessageChannel();

      port1.onmessage = () => {
        port1.close();
        port2.close();
        resolve();
      };
      port2.postMessage(null);
    });
  }

  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

const itemsKey = '"items":[';

const firstKey = /^\{"[^"\\]+":/;

/**
 * Same result as `JSON.parse(text)` (and the same thrown error). Large list
 * responses are parsed in slices with yields between them; see the file
 * comment.
 */
export async function parseJsonInSlices(text: string): Promise<unknown> {
  if (text.length < sliceThreshold) {
    return JSON.parse(text);
  }

  try {
    const sliced = await parseListInSlices(text);

    if (sliced) {
      return sliced.value;
    }
  } catch {
    // Fall through to the plain call, which also throws what JSON.parse throws.
  }

  return JSON.parse(text);
}

async function parseListInSlices(text: string): Promise<{ value: unknown } | undefined> {
  const at = text.indexOf(itemsKey);

  if (at === -1) {
    return undefined;
  }

  const itemsStart = at + itemsKey.length;
  const tailStart = text.trimEnd().length - 2;

  if (tailStart <= itemsStart || !text.startsWith("]}", tailStart)) {
    return undefined;
  }

  const head = JSON.parse(`${text.slice(0, itemsStart)}]}`) as { items?: unknown };

  if (!Array.isArray(head.items) || head.items.length !== 0) {
    return undefined;
  }

  const items: unknown[] = [];
  const first = firstKey.exec(text.slice(itemsStart, itemsStart + 256));
  const separator = first ? `},${first[0]}` : undefined;
  let taskStart = performance.now();
  let start = itemsStart;
  let misses = 0;

  const parseBatch = (end: number) => {
    const batch = JSON.parse(`[${text.slice(start, end)}]`) as unknown[];

    // Empty after a comma is `[{},]`, which JSON.parse of the whole text rejects.
    if (batch.length === 0 && start > itemsStart) {
      throw new SyntaxError("Unexpected token ]");
    }

    for (let i = 0; i < batch.length; i += 1) {
      items.push(batch[i]);
    }
  };

  while (start < tailStart) {
    let from = start + batchSize;
    let end = tailStart;

    // The end of this batch: the first separator that makes it parse, or the
    // end of the items.
    for (;;) {
      const candidate = separator ? text.indexOf(separator, from) : -1;

      if (candidate === -1 || candidate >= tailStart) {
        parseBatch(tailStart);
        break;
      }

      try {
        parseBatch(candidate + 1);
        end = candidate + 1;
        break;
      } catch {
        misses += 1;

        if (misses > maxMisses) {
          return undefined;
        }

        from = candidate + 1;
      }
    }

    // Past the separator's `,`; at the end of the items this leaves the loop.
    start = end + 1;

    if (performance.now() - taskStart >= taskBudgetMs) {
      await yieldToEventLoop();
      taskStart = performance.now();
    }
  }

  head.items = items;

  return { value: head };
}
