/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { DeviceClassApi } from "@freelensapp/kube-api";
import type { DeviceClass } from "@freelensapp/kube-object";

export class DeviceClassStore extends KubeObjectStore<DeviceClass, DeviceClassApi> {}
