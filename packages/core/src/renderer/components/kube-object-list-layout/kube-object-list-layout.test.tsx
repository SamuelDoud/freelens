/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Pod } from "@freelensapp/kube-object";
import { act } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DiContainer } from "@ogre-tools/injectable";
import "@testing-library/jest-dom/vitest";

import { podListLayoutColumnInjectionToken } from "@freelensapp/list-layout";
import appPathsStateInjectable from "../../../common/app-paths/app-paths-state.injectable";
import directoryForKubeConfigsInjectable from "../../../common/app-paths/directory-for-kube-configs/directory-for-kube-configs.injectable";
import directoryForUserDataInjectable from "../../../common/app-paths/directory-for-user-data/directory-for-user-data.injectable";
import { Cluster } from "../../../common/cluster/cluster";
import isTableColumnHiddenInjectable from "../../../features/user-preferences/common/is-table-column-hidden.injectable";
import hostedClusterInjectable from "../../cluster-frame-context/hosted-cluster.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import storesAndApisCanBeCreatedInjectable from "../../stores-apis-can-be-created.injectable";
import kubeSelectedUrlParamInjectable from "../kube-detail-params/kube-selected-url.injectable";
import toggleKubeDetailsPaneInjectable from "../kube-detail-params/toggle-details.injectable";
import { renderFor } from "../test-utils/renderFor";
import podStoreInjectable from "../workloads-pods/store.injectable";
import { KubeObjectListLayout } from "./index";

import type { RenderResult } from "@testing-library/react";

import type { DiRender } from "../test-utils/renderFor";
import type { PodStore } from "../workloads-pods/store";

describe("kube-object-list-layout", () => {
  let di: DiContainer;
  let render: DiRender;
  let podStore: PodStore;
  const selectedPath = observable.box("path");

  beforeEach(() => {
    selectedPath.set("path");
    di = getDiForUnitTesting();

    di.override(directoryForUserDataInjectable, () => "/some-user-store-path");
    di.override(directoryForKubeConfigsInjectable, () => "/some-kube-configs");
    di.override(storesAndApisCanBeCreatedInjectable, () => true);
    di.override(isTableColumnHiddenInjectable, () => () => false);

    di.override(
      hostedClusterInjectable,
      () =>
        new Cluster({
          contextName: "some-context-name",
          id: "some-cluster-id",
          kubeConfigPath: "/some-path-to-a-kubeconfig",
        }),
    );

    render = renderFor(di);

    di.override(subscribeStoresInjectable, () => vi.fn().mockImplementation(() => vi.fn()));
    di.override(kubeSelectedUrlParamInjectable, () => ({
      get: () => selectedPath.get(),
    }));
    di.override(toggleKubeDetailsPaneInjectable, () => null);
    di.override(appPathsStateInjectable, () => ({
      get: () => ({}),
    }));

    podStore = di.inject(podStoreInjectable);
  });

  describe("given pod store", () => {
    let result: RenderResult;

    it("renders", () => {
      result = render(
        <div>
          <KubeObjectListLayout
            className="Pods"
            store={podStore}
            tableId="workloads_pods"
            isConfigurable
            renderHeaderTitle="Pods"
            renderTableContents={(pod) => [<div key={pod.getName()}>{pod.getName()}</div>]}
            columns={di.injectMany(podListLayoutColumnInjectionToken)}
          />
        </div>,
      );

      expect(result.baseElement).toMatchSnapshot();
    });

    describe("given resourcename", () => {
      it("uses resourcename in search placeholder", () => {
        result = render(
          <div>
            <KubeObjectListLayout
              className="Pods"
              store={podStore}
              tableId="workloads_pods"
              isConfigurable
              renderHeaderTitle="Pods"
              renderTableContents={(pod) => [<div key={pod.getName()}>{pod.getName()}</div>]}
              resourceName="My Custom Items"
              searchFilters={[() => null]}
            />
          </div>,
        );

        expect(result.getByPlaceholderText("Search My Custom Items...")).toBeInTheDocument();
      });
    });
  });

  describe("when the store's items change", () => {
    const makePod = (name: string, resourceVersion = "1") =>
      new Pod({
        apiVersion: "v1",
        kind: "Pod",
        metadata: {
          name,
          resourceVersion,
          uid: name,
          selfLink: `/api/v1/pods/${name}`,
        },
        spec: { containers: [{ name: "c", image: "i" }] },
        status: { phase: "Running" },
      } as unknown as ConstructorParameters<typeof Pod>[0]);

    it("filters and sorts once per change, and not when only the selected item changes", () => {
      const names = ["c", "a", "b"].map((name) => makePod(name));
      const filterItems = vi.fn((items: Pod[]) => items);
      const sortByName = vi.fn((pod: Pod) => pod.getName());

      runInAction(() => {
        podStore.isLoaded = true;
        podStore.items.replace(names);
      });
      selectedPath.set("");

      render(
        <KubeObjectListLayout
          className="Pods"
          store={podStore}
          tableId="workloads_pods"
          renderHeaderTitle="Pods"
          renderTableHeader={[{ title: "Name", className: "name", sortBy: "name", id: "name" }]}
          renderTableContents={(pod) => [pod.getName()]}
          sortingCallbacks={{ name: sortByName }}
          filterItems={[filterItems]}
          tableProps={{ sortByDefault: { sortBy: "name", orderBy: "asc" }, sortSyncWithUrl: false }}
        />,
      );

      expect(sortByName).toHaveBeenCalledTimes(3);

      filterItems.mockClear();
      sortByName.mockClear();
      act(() => {
        runInAction(() => podStore.items.replace([...names, makePod("d")]));
      });

      expect(filterItems).toHaveBeenCalledTimes(1);
      expect(sortByName).toHaveBeenCalledTimes(4);

      filterItems.mockClear();
      sortByName.mockClear();
      act(() => selectedPath.set(names[0].selfLink));

      expect(filterItems).not.toHaveBeenCalled();
      expect(sortByName).not.toHaveBeenCalled();
    });
  });
});
