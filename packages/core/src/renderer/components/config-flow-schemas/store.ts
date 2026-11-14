/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObjectStore } from "../../../common/k8s-api/kube-object.store";

import type { FlowSchemaApi } from "@freelensapp/kube-api";
import type { FlowSchema } from "@freelensapp/kube-object";

export class FlowSchemaStore extends KubeObjectStore<FlowSchema, FlowSchemaApi> {}
