/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** A word for a POSIX shell: as it is, when that is safe, or in single quotes. */
export const shellQuote = (word: string): string =>
  /^[A-Za-z0-9_@%+=:,./-]+$/.test(word) ? word : `'${word.replace(/'/g, `'\\''`)}'`;

export const shellCommand = (words: readonly string[]) => words.map(shellQuote).join(" ");
