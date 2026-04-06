/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { isObject } from "./type-narrowing";

export type IgnoredClassNames = number | symbol | Function;
export type IClassName = string | string[] | Record<string, any> | undefined | null | false | IgnoredClassNames;

export function cssNames(...classNames: IClassName[]): string {
  const parts: string[] = [];

  for (const className of classNames) {
    if (typeof className === "string") {
      const trimmed = className.trim();

      if (trimmed) parts.push(trimmed);
    } else if (Array.isArray(className)) {
      for (const name of className) {
        const trimmed = name.trim();

        if (trimmed) parts.push(trimmed);
      }
    } else if (isObject(className)) {
      const keys = Object.keys(className);

      for (const name of keys) {
        if (className[name]) {
          const trimmed = name.trim();

          if (trimmed) parts.push(trimmed);
        }
      }
    }
  }

  return parts.join(" ");
}
