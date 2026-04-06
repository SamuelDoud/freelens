/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

const pluralCache = new Map<string, string>();

/**
 * Make plural form for resource Kind
 */
export function lowerAndPluralize(str: string) {
  let result = pluralCache.get(str);

  if (result !== undefined) return result;

  const lowerStr = str.toLowerCase();

  if (lowerStr.endsWith("y")) {
    result = lowerStr.replace(/y$/, "ies");
  } else if (
    lowerStr.endsWith("s") ||
    lowerStr.endsWith("x") ||
    lowerStr.endsWith("z") ||
    lowerStr.endsWith("ch") ||
    lowerStr.endsWith("sh")
  ) {
    result = lowerStr + "es";
  } else {
    result = lowerStr + "s";
  }

  pluralCache.set(str, result);

  return result;
}
