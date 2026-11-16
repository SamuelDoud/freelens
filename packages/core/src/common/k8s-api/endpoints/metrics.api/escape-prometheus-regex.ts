/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * An object name as a literal in a regular expression that goes into a PromQL
 * string. The backslash is doubled because PromQL reads the escapes of the
 * string before it reads the expression, and `\.` is not one of them. Names
 * of Kubernetes objects hold dots, which a plain regular expression reads as
 * any character.
 */
export const escapePrometheusRegex = (name: string): string => name.replace(/[.+*?^$()[\]{}|\\]/g, "\\\\$&");

/** The characters of the pod-template-hash that a ReplicaSet name carries: 8 to 10 of the safe alphabet. */
export const podTemplateHash = "[bcdfghjklmnpqrstvwxz2456789]{8,10}";
