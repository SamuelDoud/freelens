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
  /** The clock, for how long a frame has been hidden */
  now?: () => number;
  /** Tells the main process that the frame of a cluster has been taken out, so that it stops looking for it */
  emitFrameRemoved?: (clusterId: ClusterId) => void;
}

type Shown =
  | { readonly kind: "one"; readonly clusterId: ClusterId }
  | {
      readonly kind: "many";
      readonly panes: { clusterId: ClusterId; rect: PaneRect }[];
      readonly titleHeight: number;
    };

export interface HiddenView {
  readonly clusterId: ClusterId;
  /** When the frame stopped being shown, in milliseconds */
  readonly hiddenSince: number;
}

export class ClusterFrameHandler {
  private readonly views = observable.map<string, LensView>();
  /** The clusters shown now, in the one view or the panes of a multiview */
  private shown = new Set<ClusterId>();
  /** Since when each loaded frame that is not shown has been hidden; the frames shown have no entry */
  private readonly hiddenSince = new Map<ClusterId, number>();
  /** What ends the watching of a frame for its cluster going away */
  private readonly stopWatching = new Map<ClusterId, () => void>();
  /** What was last asked to be shown, to show again a frame that has been replaced */
  private lastShown?: Shown;

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

    if (!this.shown.has(clusterId)) {
      this.hiddenSince.set(clusterId, this.now());
    }

    parentElem.appendChild(iframe);

    this.dependencies.logger.info(`[LENS-VIEW]: waiting cluster to be ready, clusterId=${clusterId}`);

    const dispose = when(
      () => cluster.ready.get(),
      () => this.dependencies.logger.info(`[LENS-VIEW]: cluster is ready, clusterId=${clusterId}`),
    );

    let stopInner: (() => void) | undefined;
    const stopOuter = when(
      // cluster.disconnect is set to `false` when the cluster starts to connect
      () => !cluster.disconnected.get(),
      () => {
        stopInner = when(
          () => {
            const cluster = this.dependencies.getClusterById(clusterId);

            return Boolean(!cluster || (cluster.disconnected.get() && this.views.get(clusterId)?.isLoaded));
          },
          () => {
            this.dependencies.logger.info(`[LENS-VIEW]: remove dashboard, clusterId=${clusterId}`);
            this.removeView(clusterId, iframe, parentElem);
            dispose();
          },
        );
      },
    );

    if (this.views.has(clusterId)) {
      this.stopWatching.set(clusterId, () => {
        stopOuter();
        stopInner?.();
        dispose();
      });
    }
  }

  private now() {
    return (this.dependencies.now ?? Date.now)();
  }

  private removeView(clusterId: ClusterId, iframe: HTMLIFrameElement, parentElem: HTMLElement, gone = false) {
    this.views.delete(clusterId);
    this.hiddenSince.delete(clusterId);
    this.stopWatching.delete(clusterId);
    this.dependencies.emitFrameRemoved?.(clusterId);

    if (gone) {
      // Its renderer process is gone: there is no old code to unload.
      iframe.removeAttribute("id");
      iframe.remove();

      return;
    }

    // The frame lingers until it has unloaded, and a new one of the cluster may start before that
    iframe.removeAttribute("id");

    // Must only remove iframe from DOM after it unloads old code. Else it crashes
    iframe.addEventListener("load", () => parentElem.removeChild(iframe), {
      once: true,
    });

    // This causes the old code to be unloaded.
    iframe.setAttribute("src", "");
  }

  /** Notes which clusters are shown, and since when each of the others has been hidden */
  private markShown(clusterIds: ClusterId[]) {
    this.shown = new Set(clusterIds);

    const now = this.now();

    for (const clusterId of this.views.keys()) {
      if (this.shown.has(clusterId)) {
        this.hiddenSince.delete(clusterId);
      } else if (!this.hiddenSince.has(clusterId)) {
        this.hiddenSince.set(clusterId, now);
      }
    }
  }

  /** The loaded frames that are not shown, with since when */
  public getHiddenViews(): HiddenView[] {
    return [...this.hiddenSince]
      .filter(([clusterId]) => this.views.get(clusterId)?.isLoaded)
      .map(([clusterId, hiddenSince]) => ({ clusterId, hiddenSince }));
  }

  /**
   * Unloads the frame of a cluster that is not shown, freeing everything it
   * holds. The cluster stays connected; showing it again creates the frame
   * anew. Returns whether there was a hidden frame to unload.
   */
  @action
  public evictView(clusterId: ClusterId): boolean {
    const view = this.views.get(clusterId);
    const parentElem = document.getElementById("lens-views");

    if (!view || !view.isLoaded || this.shown.has(clusterId) || !parentElem) {
      return false;
    }

    this.dependencies.logger.info(`[LENS-VIEW]: evict hidden dashboard, clusterId=${clusterId}`);
    this.stopWatching.get(clusterId)?.();
    this.removeView(clusterId, view.frame, parentElem);

    return true;
  }

  /**
   * Replaces the frame of a cluster whose renderer process has crashed or been
   * killed, for a new one on the same cluster: at once when the cluster is
   * shown, else when it is next shown. Returns whether there was a frame.
   */
  @action
  public restartView(clusterId: ClusterId): boolean {
    const view = this.views.get(clusterId);
    const parentElem = document.getElementById("lens-views");

    if (!view || !view.isLoaded || !parentElem) {
      return false;
    }

    this.dependencies.logger.warn(`[LENS-VIEW]: the frame of clusterId=${clusterId} is gone, replacing it`);
    this.stopWatching.get(clusterId)?.();
    this.removeView(clusterId, view.frame, parentElem, true);

    if (this.shown.has(clusterId) && this.lastShown) {
      this.initView(clusterId);

      if (this.lastShown.kind === "one") {
        this.setVisibleCluster(this.lastShown.clusterId);
      } else {
        this.setVisibleClusters(this.lastShown.panes, this.lastShown.titleHeight);
      }
    }

    return true;
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
    this.lastShown = { kind: "many", panes, titleHeight };
    this.markShown(panes.map(({ clusterId }) => clusterId));
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
    this.lastShown = clusterId ? { kind: "one", clusterId } : undefined;
    this.markShown(clusterId ? [clusterId] : []);
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
