/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "../pods.scss";
import "../../kube-object-list-layout/kube-object-list-layout.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import { useEffect, useMemo } from "react";
import { ItemListLayout } from "../../item-object-list/list-layout";
import kubeSelectedUrlParamInjectable from "../../kube-detail-params/kube-selected-url.injectable";
import toggleKubeDetailsPaneInjectable from "../../kube-detail-params/toggle-details.injectable";
import { SiblingsInTabLayout } from "../../layout/siblings-in-tab-layout";
import { NamespaceSelectFilter } from "../../namespaces/namespace-select-filter";
import { podResourceColumnIds } from "../columns/pods-resource-column";
import { podRowColumns } from "./pod-row-columns";
import podRowStoreInjectable from "./pod-row-store.injectable";

import type { PageParam } from "../../../navigation/page-param";
import type { ListLayoutSearchFilter } from "../../item-object-list/list-layout";
import type { ToggleKubeDetailsPane } from "../../kube-detail-params/toggle-details.injectable";
import type { TableSortCallbacks } from "../../table";
import type { PodRowItem } from "./pod-row-item";
import type { PodRowStore } from "./pod-row-store";

interface Dependencies {
  store: PodRowStore;
  kubeSelectedUrlParam: PageParam<string>;
  toggleKubeDetailsPane: ToggleKubeDetailsPane;
}

const sortingCallbacks: TableSortCallbacks<PodRowItem> = Object.fromEntries(
  podRowColumns.map((column) => [column.id, column.sortingCallBack]),
);
const renderTableHeader = podRowColumns.map((column) => column.header);
const defaultHiddenTableColumns = ["ip", "node", "qos", ...podResourceColumnIds];

// The same array on every render keeps the text the list searches in. The quick search covers only what
// the columns show: name, namespace, status, node, QoS, owners and container names.
const searchFilters: ListLayoutSearchFilter<PodRowItem>[] = [(item) => item.getSearchTexts()];

const renderTableContents = (item: PodRowItem) => podRowColumns.map((column) => column.content(item));

/**
 * The Pods list of the experimental rows path: the same list layout, table,
 * namespace filter, sorting and details drawer, over rows from the rows
 * service instead of `Pod` objects from the pod store.
 */
const NonInjectedPodsRows = observer(({ store, kubeSelectedUrlParam, toggleKubeDetailsPane }: Dependencies) => {
  useEffect(() => store.start(), [store]);

  const detailsItem = useMemo(
    () => computed(() => store.getByPath(kubeSelectedUrlParam.get())),
    [store, kubeSelectedUrlParam],
  );

  return (
    <SiblingsInTabLayout>
      <ItemListLayout<PodRowItem, false>
        className="KubeObjectListLayout Pods"
        store={store}
        getItems={store.getContextItems}
        preloadStores={false}
        tableId="workloads_pods"
        isConfigurable
        isSelectable={false}
        defaultHiddenTableColumns={defaultHiddenTableColumns}
        columnsAddedLater={podResourceColumnIds}
        searchFilters={searchFilters}
        searchFiltersArePure
        renderHeaderTitle="Pods"
        renderTableHeader={renderTableHeader}
        renderTableContents={renderTableContents}
        sortingCallbacks={sortingCallbacks}
        detailsItem={detailsItem.get()}
        onDetails={(item) => toggleKubeDetailsPane(item.selfLink)}
        spinnerTestId="kube-object-list-layout-spinner"
        customizeHeader={({ filters, searchProps, info, ...headerPlaceHolders }) => ({
          filters: (
            <>
              {filters}
              <NamespaceSelectFilter id="kube-object-list-layout-namespace-select-input" />
            </>
          ),
          searchProps: { ...searchProps, placeholder: "Search Pods..." },
          info: <span data-testid="rows-list-count">{info}</span>,
          ...headerPlaceHolders,
        })}
      />
    </SiblingsInTabLayout>
  );
});

export const PodsRows = withInjectables<Dependencies>(NonInjectedPodsRows, {
  getProps: (di) => ({
    store: di.inject(podRowStoreInjectable),
    kubeSelectedUrlParam: di.inject(kubeSelectedUrlParamInjectable),
    toggleKubeDetailsPane: di.inject(toggleKubeDetailsPaneInjectable),
  }),
});
