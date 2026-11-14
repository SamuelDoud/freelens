/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import assert from "node:assert";
import { onceDefined } from "@freelensapp/utilities";
import { action, observable, when } from "mobx";
import { getClusterFrameUrl } from "../../../common/utils";

import type { Logger } from "@freelensapp/logger";
import type { Disposer } from "@freelensapp/utilities";

import type { ClusterId } from "../../../common/cluster-types";
import type { GetClusterById } from "../../../features/cluster/storage/common/get-by-id.injectable";
import type { PaneRect } from "../../../features/multiview/common/multiview";

export interface LensView {
  isLoaded: boolean;
  frame: HTMLIFrameElement;
}

interface Dependencies {
  readonly logger: Logger;
  getClusterById: GetClusterById;
  emitClusterVisibility: (clusterId: ClusterId | null) => void;
  /** Tells the frames which clusters are shown, for those not shown to pause the work done for the eye */
  emitShownClusters: (clusterIds: ClusterId[]) => void;
}

export class ClusterFrameHandler {
  private readonly views = observable.map<string, LensView>();

  constructor(protected readonly dependencies: Dependencies) {}

  public hasLoadedView(clusterId: string): boolean {
    return Boolean(this.views.get(clusterId)?.isLoaded);
  }

  @action
  public initView(clusterId: ClusterId) {
    const cluster = this.dependencies.getClusterById(clusterId);

    if (!cluster) {
      this.dependencies.logger.warn(`[LENS-VIEW]: not initializing view; unknown clusterId="${clusterId}"`);

      return;
    }

    const parentElem = document.getElementById("lens-views");

    assert(parentElem, "DOM with #lens-views must be present");

    if (this.views.has(clusterId)) {
      return;
    }

    this.dependencies.logger.info(`[LENS-VIEW]: init dashboard, clusterId=${clusterId}`);
    const iframe = document.createElement("iframe");

    iframe.id = `cluster-frame-${cluster.id}`;
    // Shown once its cluster is ready, by whatever asked for it to be visible
    iframe.classList.add("hidden");
    iframe.name = cluster.contextName.get();
    iframe.setAttribute("src", getClusterFrameUrl(clusterId));
    iframe.setAttribute("allow", "clipboard-read; clipboard-write");
    iframe.addEventListener(
      "load",
      action(() => {
        this.dependencies.logger.info(`[LENS-VIEW]: frame for clusterId=${clusterId} has loaded`);
        const view = this.views.get(clusterId);

        assert(view, `view for ${clusterId} MUST still exist here`);
        view.isLoaded = true;
      }),
      { once: true },
    );
    this.views.set(clusterId, { frame: iframe, isLoaded: false });
    parentElem.appendChild(iframe);

    this.dependencies.logger.info(`[LENS-VIEW]: waiting cluster to be ready, clusterId=${clusterId}`);

    const dispose = when(
      () => cluster.ready.get(),
      () => this.dependencies.logger.info(`[LENS-VIEW]: cluster is ready, clusterId=${clusterId}`),
    );

    when(
      // cluster.disconnect is set to `false` when the cluster starts to connect
      () => !cluster.disconnected.get(),
      () => {
        when(
          () => {
            const cluster = this.dependencies.getClusterById(clusterId);

            return Boolean(!cluster || (cluster.disconnected.get() && this.views.get(clusterId)?.isLoaded));
          },
          () => {
            this.dependencies.logger.info(`[LENS-VIEW]: remove dashboard, clusterId=${clusterId}`);
            this.views.delete(clusterId);

            // Must only remove iframe from DOM after it unloads old code. Else it crashes
            iframe.addEventListener("load", () => parentElem.removeChild(iframe), {
              once: true,
            });

            // This causes the old code to be unloaded.
            iframe.setAttribute("src", "");

            dispose();
          },
        );
      },
    );
  }

  private prevVisibleClusterChange?: Disposer;

  /** Undoes the panes of a multiview: frames fill the area again, one at a time. */
  private resetPanes() {
    document.getElementById("lens-views")?.classList.remove("multiview");

    for (const { frame } of this.views.values()) {
      frame.style.removeProperty("left");
      frame.style.removeProperty("top");
      frame.style.removeProperty("width");
      frame.style.removeProperty("height");
    }
  }

  /**
   * Shows several clusters at once, each in its pane: `panes` gives each
   * cluster's place in percent of the area, below a title bar of
   * `titleHeight` pixels that the multiview draws itself.
   */
  public setVisibleClusters(panes: { clusterId: ClusterId; rect: PaneRect }[], titleHeight: number): void {
    this.prevVisibleClusterChange?.();
    this.resetPanes();
    this.dependencies.emitShownClusters(panes.map(({ clusterId }) => clusterId));
    document.getElementById("lens-views")?.classList.add("multiview");

    for (const { frame: view } of this.views.values()) {
      view.classList.add("hidden");
    }

    const disposers = panes.map(({ clusterId, rect }) => {
      const cluster = this.dependencies.getClusterById(clusterId);

      return onceDefined(
        () => {
          const view = this.views.get(clusterId);

          return cluster?.available.get() && cluster.ready.get() && view?.isLoaded ? view : undefined;
        },
        (view: LensView) => {
          const gap = 2;

          view.frame.style.left = `calc(${rect.left}% + ${gap}px)`;
          view.frame.style.top = `calc(${rect.top}% + ${titleHeight}px)`;
          view.frame.style.width = `calc(${rect.width}% - ${2 * gap}px)`;
          view.frame.style.height = `calc(${rect.height}% - ${titleHeight + gap}px)`;
          view.frame.classList.remove("hidden");
        },
      );
    });

    this.prevVisibleClusterChange = () => disposers.forEach((dispose) => dispose());
  }

  /** The cluster whose pane has the focus in a multiview, for what follows the visible cluster */
  public setActivePane(clusterId: ClusterId | null): void {
    this.dependencies.emitClusterVisibility(clusterId);
  }

  public setVisibleCluster(clusterId: ClusterId | null): void {
    // Clear the previous when ASAP
    this.prevVisibleClusterChange?.();
    this.resetPanes();
    this.dependencies.emitShownClusters(clusterId ? [clusterId] : []);

    this.dependencies.logger.info(`[LENS-VIEW]: refreshing iframe views, visible cluster id=${clusterId}`);
    this.dependencies.emitClusterVisibility(null);

    for (const { frame: view } of this.views.values()) {
      view.classList.add("hidden");
    }

    const cluster = clusterId ? this.dependencies.getClusterById(clusterId) : undefined;

    if (cluster && clusterId) {
      this.prevVisibleClusterChange = onceDefined(
        () => {
          const view = this.views.get(clusterId);

          if (cluster.available.get() && cluster.ready.get() && view?.isLoaded) {
            return view;
          }

          return undefined;
        },
        (view: LensView) => {
          this.dependencies.logger.info(`[LENS-VIEW]: cluster id=${clusterId} should now be visible`);
          view.frame.classList.remove("hidden");
          view.frame.focus();
          this.dependencies.emitClusterVisibility(clusterId);
        },
      );
    }
  }

  public clearVisibleCluster() {
    this.setVisibleCluster(null);
  }
}
