/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/** A field as table or drawer text; nothing for a missing one. */
export const text = (value: unknown): string => (value === undefined || value === null ? "" : String(value));

export const yesNo = (value: boolean | undefined): string | undefined =>
  value === undefined ? undefined : value ? "Yes" : "No";
