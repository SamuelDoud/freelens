/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Spinner } from "@freelensapp/spinner";
import { getInjectable } from "@ogre-tools/injectable";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { kubeObjectStoreInjectionToken } from "../../../common/k8s-api/api-manager/kube-object-store-token";
import { statusBarItemInjectionToken } from "./status-bar-item-injection-token";

const ApiActivityStatus = observer(({ stores }: { stores: { isLoading: boolean; api: { apiBase: string } }[] }) => {
  const loading = stores.filter((s) => s.isLoading);

  if (loading.length === 0) return null;

  const label =
    loading.length === 1
      ? `Syncing ${loading[0].api.apiBase.split("/").pop()}...`
      : `Syncing ${loading.length} resources...`;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, opacity: 0.8 }}>
      <Spinner singleColor={false} />
      <span>{label}</span>
    </div>
  );
});

const apiActivityStatusInjectable = getInjectable({
  id: "api-activity-status-bar-item",

  instantiate: (di) => {
    const stores = di.injectMany(kubeObjectStoreInjectionToken);

    const Component = () => <ApiActivityStatus stores={stores} />;

    return {
      component: Component,
      position: "right" as const,
      visible: computed(() => stores.some((s) => s.isLoading)),
    };
  },

  injectionToken: statusBarItemInjectionToken,
});

export default apiActivityStatusInjectable;
