/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Button } from "@freelensapp/button";
import { withInjectables } from "@ogre-tools/injectable-react";
import { computed, runInAction } from "mobx";
import { observer } from "mobx-react";
import { useState } from "react";
import navigateToCatalogInjectable from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import { Checkbox } from "../../../renderer/components/checkbox";
import { Input } from "../../../renderer/components/input";
import { SettingLayout } from "../../../renderer/components/layout/setting-layout";
import { SubTitle } from "../../../renderer/components/layout/sub-title";
import navigateInjectable from "../../../renderer/navigation/navigate.injectable";
import routePathParametersInjectable from "../../../renderer/routes/route-path-parameters.injectable";
import clustersInjectable from "../../cluster/storage/common/clusters.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { multiViewLayouts, multiViewPath, newMultiViewId } from "../common/multiview";
import multiViewSettingsRouteInjectable from "../common/multiview-settings-route.injectable";

import type { IComputedValue } from "mobx";

import type { Cluster } from "../../../common/cluster/cluster";
import type { NavigateToCatalog } from "../../../common/front-end-routing/routes/catalog/navigate-to-catalog.injectable";
import type { Navigate } from "../../../renderer/navigation/navigate.injectable";
import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { MultiView, MultiViewLayout } from "../common/multiview";

interface Dependencies {
  multiviewId: IComputedValue<string | undefined>;
  state: UserPreferencesState;
  clusters: IComputedValue<Cluster[]>;
  navigate: Navigate;
  navigateToCatalog: NavigateToCatalog;
}

interface Draft {
  name: string;
  clusterIds: string[];
  layout: MultiViewLayout;
  iconText: string;
  iconBackground: string;
}

const MultiViewForm = observer(
  ({
    existing,
    clusters,
    onSave,
    onDelete,
  }: {
    existing: MultiView | undefined;
    clusters: Cluster[];
    onSave: (draft: Draft) => void;
    onDelete?: () => void;
  }) => {
    const [draft, setDraft] = useState<Draft>({
      name: existing?.name ?? "",
      clusterIds: [...(existing?.clusterIds ?? [])],
      layout: existing?.layout ?? "columns",
      iconText: existing?.iconText ?? "",
      iconBackground: existing?.iconBackground ?? "",
    });
    const update = (change: Partial<Draft>) => setDraft({ ...draft, ...change });
    const toggleCluster = (id: string, checked: boolean) =>
      update({
        clusterIds: checked ? [...draft.clusterIds, id] : draft.clusterIds.filter((clusterId) => clusterId !== id),
      });
    const problem = !draft.name.trim()
      ? "Give it a name."
      : draft.clusterIds.length < 2
        ? "Pick at least two clusters."
        : undefined;

    return (
      <div className="flex flex-col gap-5" data-testid="multiview-settings">
        <h2>{existing ? `Edit ${existing.name}` : "New multiview"}</h2>
        <p className="text-secondary">
          A multiview shows several clusters at once, each in its own pane. It is pinned and opened like a cluster.
        </p>
        <section>
          <SubTitle title="Name" />
          <Input
            theme="round-black"
            data-testid="multiview-name"
            value={draft.name}
            placeholder="Production"
            onChange={(name) => update({ name })}
          />
        </section>
        <section>
          <SubTitle title="Clusters" />
          <small className="hint">The panes follow the order in which the clusters are picked.</small>
          <div className="flex flex-col gap-2 mt-2">
            {clusters.map((cluster) => {
              const position = draft.clusterIds.indexOf(cluster.id);

              return (
                <Checkbox
                  key={cluster.id}
                  data-testid={`multiview-cluster-${cluster.id}`}
                  label={position >= 0 ? `${position + 1}. ${cluster.name.get()}` : cluster.name.get()}
                  value={position >= 0}
                  onChange={(checked) => toggleCluster(cluster.id, checked)}
                />
              );
            })}
          </div>
        </section>
        <section>
          <SubTitle title="Layout" />
          <div className="flex flex-row gap-2">
            {multiViewLayouts.map(({ id, label }) => (
              <Button
                key={id}
                data-testid={`multiview-layout-${id}`}
                label={label}
                primary={draft.layout === id}
                outlined={draft.layout !== id}
                onClick={() => update({ layout: id })}
              />
            ))}
          </div>
        </section>
        <section className="flex flex-row gap-6 items-end">
          <div className="grow">
            <SubTitle title="Icon text" />
            <Input
              theme="round-black"
              data-testid="multiview-icon-text"
              value={draft.iconText}
              placeholder="The layout's icon"
              maxLength={40}
              onChange={(iconText) => update({ iconText })}
            />
          </div>
          <label className="flex flex-row items-center gap-2">
            <span>Background</span>
            <input
              type="color"
              data-testid="multiview-icon-background"
              value={draft.iconBackground || "#3d90ce"}
              onChange={(event) => update({ iconBackground: event.target.value })}
            />
          </label>
        </section>
        <div className="flex flex-row gap-3 items-center">
          <Button
            primary
            data-testid="multiview-save"
            label={existing ? "Save" : "Create"}
            disabled={Boolean(problem)}
            onClick={() => onSave(draft)}
          />
          {onDelete && <Button accent data-testid="multiview-delete" label="Delete" onClick={onDelete} />}
          {problem && <span className="text-secondary">{problem}</span>}
        </div>
      </div>
    );
  },
);

const NonInjectedMultiViewSettings = observer(
  ({ multiviewId, state, clusters, navigate, navigateToCatalog }: Dependencies) => {
    const id = multiviewId.get();
    const existing = id && id !== newMultiViewId ? state.multiviews.find((view) => view.id === id) : undefined;

    const save = (draft: Draft) => {
      const view: MultiView = {
        id: existing?.id ?? globalThis.crypto.randomUUID().slice(0, 8),
        name: draft.name.trim(),
        clusterIds: draft.clusterIds,
        layout: draft.layout,
        ...(draft.iconText.trim() ? { iconText: draft.iconText.trim() } : {}),
        ...(draft.iconBackground ? { iconBackground: draft.iconBackground } : {}),
      };

      runInAction(() => {
        state.multiviews = existing
          ? state.multiviews.map((other) => (other.id === view.id ? view : other))
          : [...state.multiviews, view];
      });
      navigate(multiViewPath(view.id));
    };

    const remove = () => {
      runInAction(() => {
        state.multiviews = state.multiviews.filter((view) => view.id !== existing?.id);
      });
      navigateToCatalog();
    };

    return (
      <SettingLayout>
        {/* Keyed by the multiview, so that the form starts over for another one */}
        <MultiViewForm
          key={existing?.id ?? newMultiViewId}
          existing={existing}
          clusters={clusters.get()}
          onSave={save}
          onDelete={existing ? remove : undefined}
        />
      </SettingLayout>
    );
  },
);

export const MultiViewSettings = withInjectables<Dependencies>(NonInjectedMultiViewSettings, {
  getProps: (di) => {
    const pathParameters = di.inject(routePathParametersInjectable, di.inject(multiViewSettingsRouteInjectable));

    return {
      multiviewId: computed(() => pathParameters.get().multiviewId),
      state: di.inject(userPreferencesStateInjectable),
      clusters: di.inject(clustersInjectable),
      navigate: di.inject(navigateInjectable),
      navigateToCatalog: di.inject(navigateToCatalogInjectable),
    };
  },
});
