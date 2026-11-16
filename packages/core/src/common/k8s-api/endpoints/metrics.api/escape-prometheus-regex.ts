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

/**
 * The pod-template-hash that a ReplicaSet name carries: a 32-bit hash written in the safe alphabet,
 * up to 10 characters, fewer when the hash is small. The alphabet has no vowels, so the next word of
 * a sibling's name ("api-gateway-…") cannot pass for it.
 */
export const podTemplateHash = "[bcdfghjklmnpqrstvwxz2456789]{1,10}";
