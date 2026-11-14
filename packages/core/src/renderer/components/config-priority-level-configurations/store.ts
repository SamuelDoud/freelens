/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { PriorityLevelConfigurationApi } from "@freelensapp/kube-api";
import type { PriorityLevelConfiguration } from "@freelensapp/kube-object";

export class PriorityLevelConfigurationStore extends KubeObjectStore<
  PriorityLevelConfiguration,
  PriorityLevelConfigurationApi
> {}
