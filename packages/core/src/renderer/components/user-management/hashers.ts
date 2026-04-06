/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { Subject } from "@freelensapp/kube-object";

export function hashSubject(subject: Subject): string {
  return `${subject.kind}\0${subject.name}\0${subject.namespace ?? ""}\0${subject.apiGroup ?? ""}`;
}
