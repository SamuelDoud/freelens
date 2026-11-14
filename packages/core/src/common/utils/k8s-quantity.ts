/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

const suffixes = new Map<string, number>([
  ["n", 1e-9],
  ["u", 1e-6],
  ["m", 1e-3],
  ["", 1],
  ["k", 1e3],
  ["M", 1e6],
  ["G", 1e9],
  ["T", 1e12],
  ["P", 1e15],
  ["E", 1e18],
  ["Ki", 2 ** 10],
  ["Mi", 2 ** 20],
  ["Gi", 2 ** 30],
  ["Ti", 2 ** 40],
  ["Pi", 2 ** 50],
  ["Ei", 2 ** 60],
]);

const quantityRegex = /^([+-]?(?:\d+\.?\d*|\.\d+))(?:[eE]([+-]?\d+))?(n|u|m|k|M|G|T|P|E|Ki|Mi|Gi|Ti|Pi|Ei)?$/;

/**
 * The value of a Kubernetes quantity, such as `500m`, `2`, `1.5Gi`, `128M` or
 * `1e3`: cores for a CPU quantity, bytes for a memory one. `undefined` when it
 * is not a quantity.
 */
export function parseQuantity(value: string | number | undefined | null): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const match = quantityRegex.exec(value?.trim() ?? "");

  if (!match) {
    return undefined;
  }

  const [, digits, exponent, suffix = ""] = match;

  return Number(digits) * 10 ** Number(exponent ?? 0) * suffixes.get(suffix)!;
}

const trim = (value: number, digits: number) => String(Number(value.toFixed(digits)));

/** A number of cores the way Kubernetes writes it: `250m`, `1.5`, `2`. */
export function formatCpuQuantity(cores: number): string {
  if (cores > 0 && cores < 1) {
    return `${trim(cores * 1000, 1)}m`;
  }

  return trim(cores, 3);
}

const binaryUnits = ["Ki", "Mi", "Gi", "Ti", "Pi", "Ei"];

/** A number of bytes with a binary suffix: `512Mi`, `1.5Gi`. */
export function formatMemoryQuantity(bytes: number): string {
  let value = bytes;
  let unit = "";

  for (const next of binaryUnits) {
    if (value < 1024) {
      break;
    }

    value /= 1024;
    unit = next;
  }

  return `${trim(value, 2)}${unit}`;
}
