/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ErrorBoundary } from "@freelensapp/error-boundary";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import kubeObjectDetailItemsInjectable from "../../../renderer/components/kube-object-details/kube-object-detail-items/kube-object-detail-items.injectable";
import { KubeObjectMenu } from "../../../renderer/components/kube-object-menu";
import styles from "./inline-details.module.scss";

import type { KubeObject } from "@freelensapp/kube-object";

import type { GetKubeObjectDetailItems } from "../../../renderer/components/kube-object-details/kube-object-detail-items/kube-object-detail-items.injectable";

export interface InlineDetailsPanelProps {
  object: KubeObject;
}

interface Dependencies {
  getDetailItems: GetKubeObjectDetailItems;
}

/** An object's details under its row: the same details and actions as the side panel's. */
const NonInjectedInlineDetailsPanel = observer(({ object, getDetailItems }: InlineDetailsPanelProps & Dependencies) => (
  <div className={styles.panel} data-testid="inline-details-panel">
    <div className={styles.toolbar}>
      <span className={styles.title}>{`${object.kind}: ${object.getName()}`}</span>
      <KubeObjectMenu object={object} toolbar={true} />
    </div>
    {getDetailItems(object).map((Component, index) => (
      // Keyed by the object, as in the side panel, so that no state leaks from one object to another.
      <ErrorBoundary key={`${object.getId()}-${index}`}>
        <Component object={object} />
      </ErrorBoundary>
    ))}
  </div>
));

export const InlineDetailsPanel = withInjectables<Dependencies, InlineDetailsPanelProps>(
  NonInjectedInlineDetailsPanel,
  {
    getProps: (di, props) => ({
      ...props,
      getDetailItems: di.inject(kubeObjectDetailItemsInjectable),
    }),
  },
);
