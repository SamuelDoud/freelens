/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

const unitMilliseconds = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
} as const;

const wholeDuration = /^(?:\d+(?:\.\d+)?[smhdw])+$/;
const durationPart = /(\d+(?:\.\d+)?)([smhdw])/g;

/**
 * Parses a duration such as `90s`, `30m`, `2h`, `3d`, `1w` or a sum of them
 * (`1d12h`), ignoring case and whitespace. Returns the duration in
 * milliseconds, or `undefined` for anything else, a zero duration included.
 */
export function parseDuration(text: string): number | undefined {
  const compact = text.replace(/\s+/g, "").toLowerCase();

  if (!wholeDuration.test(compact)) {
    return undefined;
  }

  let total = 0;

  for (const [, amount, unit] of compact.matchAll(durationPart)) {
    total += Number(amount) * unitMilliseconds[unit as keyof typeof unitMilliseconds];
  }

  return total > 0 ? total : undefined;
}
