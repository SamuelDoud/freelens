/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export interface MappedLines<In, Out> {
  source: readonly In[];
  output: Out[];
}

// How many places of the previous source are tried as the start of the lines
// kept: the first line can occur more than once, such as a repeated message.
const maxCandidates = 16;

/**
 * Maps the lines with `map`, reusing the output of the lines the previous call
 * mapped and that the new source still has. The tab of a log drops lines at its
 * top and gains lines at its bottom, so what the two sources share is a run:
 * the new source starts at some line of the previous one and goes on
 * identically up to the end of one of them.
 *
 * `map` must be pure for the result to equal `source.map(map)`. Every reused
 * line is compared with `===`, so a wrong guess of where the run starts costs
 * only the work of mapping the lines it did not match.
 *
 * The caller keeps the returned state, outside any observable, and passes it to
 * the next call.
 */
export function mapLinesIncremental<In, Out>(
  previous: MappedLines<In, Out> | undefined,
  source: readonly In[],
  map: (line: In) => Out,
): MappedLines<In, Out> {
  if (previous?.source === source) {
    return previous;
  }

  const output: Out[] = [];
  let reused = 0;
  let offset = 0;

  if (previous && source.length > 0 && previous.source.length > 0) {
    const previousSource = previous.source;
    const first = source[0];
    let candidates = 0;

    for (let at = previousSource.indexOf(first); at !== -1 && candidates < maxCandidates; ) {
      candidates += 1;

      const limit = Math.min(source.length, previousSource.length - at);
      let length = 1;

      while (length < limit && source[length] === previousSource[at + length]) {
        length += 1;
      }

      if (length > reused) {
        reused = length;
        offset = at;
      }

      if (length === limit) {
        break;
      }

      at = previousSource.indexOf(first, at + 1);
    }
  }

  if (previous) {
    for (let index = 0; index < reused; index += 1) {
      output.push(previous.output[offset + index]);
    }
  }

  for (let index = reused; index < source.length; index += 1) {
    output.push(map(source[index]));
  }

  return { source, output };
}
