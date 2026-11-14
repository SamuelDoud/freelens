/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export interface DiffLine {
  readonly kind: "same" | "added" | "removed";
  readonly text: string;
}

/**
 * A line diff of `before` against `after`: the lines both share in order
 * (their longest common subsequence) are `same`, the rest of `before` is
 * `removed` and the rest of `after` is `added`.
 */
export function diffLines(before: readonly string[], after: readonly string[]): DiffLine[] {
  const rows = before.length + 1;
  const cols = after.length + 1;
  // lengths[i * cols + j]: the common subsequence of before[i..] and after[j..]
  const lengths = new Uint32Array(rows * cols);

  for (let i = before.length - 1; i >= 0; i--) {
    for (let j = after.length - 1; j >= 0; j--) {
      lengths[i * cols + j] =
        before[i] === after[j]
          ? lengths[(i + 1) * cols + j + 1] + 1
          : Math.max(lengths[(i + 1) * cols + j], lengths[i * cols + j + 1]);
    }
  }

  const lines: DiffLine[] = [];
  let i = 0;
  let j = 0;

  while (i < before.length && j < after.length) {
    if (before[i] === after[j]) {
      lines.push({ kind: "same", text: before[i] });
      i++;
      j++;
    } else if (lengths[(i + 1) * cols + j] >= lengths[i * cols + j + 1]) {
      lines.push({ kind: "removed", text: before[i++] });
    } else {
      lines.push({ kind: "added", text: after[j++] });
    }
  }

  while (i < before.length) lines.push({ kind: "removed", text: before[i++] });
  while (j < after.length) lines.push({ kind: "added", text: after[j++] });

  return lines;
}
