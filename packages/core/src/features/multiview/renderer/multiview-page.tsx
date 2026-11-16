/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Icon } from "@freelensapp/icon";
import { cssNames } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { computed, reaction } from "mobx";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import clusterFrameHandlerInjectable from "../../../renderer/components/cluster-manager/cluster-frame-handler.injectable";
import { ClusterStatus } from "../../../renderer/components/cluster-manager/cluster-status";
import routePathParametersInjectable from "../../../renderer/routes/route-path-parameters.injectable";
import requestClusterActivationInjectable from "../../cluster/activation/renderer/request-activation.injectable";
import getClusterByIdInjectable from "../../cluster/storage/common/get-by-id.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { multiViewLayouts, paneRects } from "../common/multiview";
import multiViewRouteInjectable from "../common/multiview-route.injectable";
import navigateToMultiViewSettingsInjectable from "../common/navigate-to-multiview-settings.injectable";
import styles from "./multiview-page.module.scss";
import pressedClusterFrameInjectable from "./pressed-cluster-frame.injectable";
import { startFramesInOrder } from "./start-frames-in-order";

import type { IComputedValue, IObservableValue } from "mobx";

import type { ClusterFrameHandler } from "../../../renderer/components/cluster-manager/cluster-frame-handler";
import type { RequestClusterActivation } from "../../cluster/activation/common/request-token";
import type { GetClusterById } from "../../cluster/storage/common/get-by-id.injectable";
import type { MultiView } from "../common/multiview";
import type { NavigateToMultiViewSettings } from "../common/navigate-to-multiview-settings.injectable";

interface Dependencies {
  multiview: IComputedValue<MultiView | undefined>;
  clusterFrames: ClusterFrameHandler;
  getClusterById: GetClusterById;
  requestClusterActivation: RequestClusterActivation;
  navigateToSettings: NavigateToMultiViewSettings;
  pressedClusterFrame: IObservableValue<string | undefined>;
}

/** The height of a pane's title bar, which the multiview draws over the gap above its frame */
const titleHeight = 26;

/** How long a pane's frame may take to load before the next one starts */
const frameStartTimeoutMs = 60_000;

/**
 * Several clusters at once. Each cluster's own frame shows in its pane, as it
 * does on its own page; the pane last clicked is the active one, which what
 * follows the visible cluster (menus, the AI chat) goes by.
 */
const NonInjectedMultiViewPage = observer(
  ({
    multiview,
    clusterFrames,
    getClusterById,
    requestClusterActivation,
    navigateToSettings,
    pressedClusterFrame,
  }: Dependencies) => {
    const view = multiview.get();
    const [active, setActive] = useState<string>();
    const clusterIds = view?.clusterIds ?? [];
    const rects = paneRects(clusterIds.length, view?.layout ?? "columns");
    const key = `${view?.id}:${view?.layout}:${clusterIds.join(",")}`;

    useEffect(() => {
      if (!view) {
        return undefined;
      }

      let cancelled = false;

      void startFramesInOrder(
        clusterIds,
        { clusterFrames, getClusterById, requestClusterActivation },
        () => cancelled,
        frameStartTimeoutMs,
      );

      clusterFrames.setVisibleClusters(
        clusterIds.map((clusterId, index) => ({ clusterId, rect: rects[index] })),
        titleHeight,
      );
      setActive(clusterIds[0]);

      return () => {
        cancelled = true;
        clusterFrames.clearVisibleCluster();
      };
      // The key stands for the multiview, its layout and its clusters.
    }, [key]);

    useEffect(() => {
      clusterFrames.setActivePane(active ?? null);
    }, [active, clusterFrames]);

    // A press in a pane's frame makes it the active pane.
    useEffect(
      () =>
        reaction(
          () => pressedClusterFrame.get(),
          (id) => id && clusterIds.includes(id) && setActive(id),
        ),
      [key],
    );

    if (!view) {
      return (
        <div className={styles.missing} data-testid="multiview-missing">
          This multiview no longer exists.
        </div>
      );
    }

    const layoutLabel = multiViewLayouts.find(({ id }) => id === view.layout)?.label;

    return (
      <div className={styles.page} data-testid="multiview-page">
        {clusterIds.map((clusterId, index) => {
          const cluster = getClusterById(clusterId);
          const rect = rects[index];
          const ready = cluster?.ready.get() && cluster.available.get() && clusterFrames.hasLoadedView(clusterId);

          return (
            <div
              key={clusterId}
              className={cssNames(styles.pane, { [styles.active]: active === clusterId })}
              style={{ left: `${rect.left}%`, top: `${rect.top}%`, width: `${rect.width}%`, height: `${rect.height}%` }}
              data-testid={`multiview-pane-${index}`}
            >
              <div
                className={styles.title}
                style={{ height: titleHeight }}
                onMouseDown={() => setActive(clusterId)}
                data-testid={`multiview-pane-title-${index}`}
              >
                <span className={styles.name}>{cluster?.name.get() ?? `Removed cluster ${clusterId}`}</span>
                {index === 0 && (
                  <span className={styles.tools}>
                    <span className={styles.viewName}>{`${view.name} · ${layoutLabel}`}</span>
                    <Icon
                      material="edit"
                      small
                      interactive
                      tooltip="Edit this multiview"
                      data-testid="multiview-edit"
                      onClick={() => navigateToSettings(view.id)}
                    />
                  </span>
                )}
              </div>
              {cluster && !ready && (
                <div className={styles.status}>
                  <ClusterStatus cluster={cluster} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  },
);

export const MultiViewPage = withInjectables<Dependencies>(NonInjectedMultiViewPage, {
  getProps: (di) => {
    const pathParameters = di.inject(routePathParametersInjectable, di.inject(multiViewRouteInjectable));
    const state = di.inject(userPreferencesStateInjectable);

    return {
      multiview: computed(() => state.multiviews.find((view) => view.id === pathParameters.get().multiviewId)),
      clusterFrames: di.inject(clusterFrameHandlerInjectable),
      getClusterById: di.inject(getClusterByIdInjectable),
      requestClusterActivation: di.inject(requestClusterActivationInjectable),
      navigateToSettings: di.inject(navigateToMultiViewSettingsInjectable),
      pressedClusterFrame: di.inject(pressedClusterFrameInjectable),
    };
  },
});
