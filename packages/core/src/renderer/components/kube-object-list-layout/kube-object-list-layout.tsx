/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./kube-object-list-layout.scss";

import { Icon } from "@freelensapp/icon";
import { kubeObjectListLayoutColumnInjectionToken } from "@freelensapp/list-layout";
import { TooltipPosition } from "@freelensapp/tooltip";
import { cssNames, hasTypedProperty, isDefined, isObject, isString } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { sortBy } from "es-toolkit/compat";
import { computed, observable, reaction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { getKubeObjectSearchFields } from "../../../features/advanced-search/renderer/kube-object-search-fields";
import { InlineDetailsPanel } from "../../../features/inline-details/renderer/inline-details-panel";
import userPreferencesStateInjectable from "../../../features/user-preferences/common/state.injectable";
import clusterFrameContextForNamespacedResourcesInjectable from "../../cluster-frame-context/for-namespaced-resources.injectable";
import subscribeStoresInjectable from "../../kube-watch-api/subscribe-stores.injectable";
import { ResourceKindMap, ResourceNames } from "../../utils/rbac";
import { ItemListLayout } from "../item-object-list/list-layout";
import kubeSelectedUrlParamInjectable from "../kube-detail-params/kube-selected-url.injectable";
import toggleKubeDetailsPaneInjectable from "../kube-detail-params/toggle-details.injectable";
import { KubeObjectMenu } from "../kube-object-menu";
import { MenuControls } from "../menu";
import { NamespaceSelectFilter } from "../namespaces/namespace-select-filter";
import { getCellOrder } from "./cell-order";

import type { KubeApi } from "@freelensapp/kube-api";
import type { KubeJsonApiDataFor, KubeObject } from "@freelensapp/kube-object";
import type { GeneralKubeObjectListLayoutColumn, SpecificKubeListLayoutColumn } from "@freelensapp/list-layout";
import type { Disposer } from "@freelensapp/utilities";

import type { IComputedValue } from "mobx";

import type { SearchField } from "../../../features/advanced-search/common/conditions";
import type { AdvancedSearchView } from "../../../features/advanced-search/renderer/advanced-search-panel";
import type { UserPreferencesState } from "../../../features/user-preferences/common/state.injectable";
import type { ClusterContext } from "../../cluster-frame-context/cluster-frame-context";
import type { SubscribableStore, SubscribeStores } from "../../kube-watch-api/kube-watch-api";
import type { PageParam } from "../../navigation/page-param";
import type { ItemListLayoutProps, ItemListStore } from "../item-object-list/list-layout";
import type { ToggleKubeDetailsPane } from "../kube-detail-params/toggle-details.injectable";

export type KubeItemListStore<K extends KubeObject> = ItemListStore<K, false> &
  SubscribableStore & {
    getByPath: (path: string) => K | undefined;
    readonly contextItems: K[];
  };

export interface KubeObjectListLayoutProps<
  K extends KubeObject,
  _ extends KubeApi<K, D>,
  D extends KubeJsonApiDataFor<K>,
> extends Omit<ItemListLayoutProps<K, false>, "getItems" | "dependentStores" | "preloadStores"> {
  items?: K[];
  getItems?: () => K[];
  store: KubeItemListStore<K>;
  dependentStores?: SubscribableStore[];
  subscribeStores?: boolean;

  /**
   * Customize resource name for e.g. search input ("Search <ResourceName>..."")
   * If not provided, ResourceNames is used instead with a fallback to resource kind.
   */
  resourceName?: string;
  columns?: SpecificKubeListLayoutColumn<K>[];

  /**
   * Fields of this kind that advanced search can put conditions on, besides the
   * name, namespace, age, labels, annotations and owners every list has.
   */
  searchFields?: SearchField<K>[];
}

interface Dependencies {
  clusterFrameContext: ClusterContext;
  subscribeToStores: SubscribeStores;
  kubeSelectedUrlParam: PageParam<string>;
  toggleKubeDetailsPane: ToggleKubeDetailsPane;
  generalColumns: GeneralKubeObjectListLayoutColumn[];
  preferences: UserPreferencesState;
}

const matchesApiFor = (api: SubscribableStore["api"]) => (column: GeneralKubeObjectListLayoutColumn) =>
  column.kind === api.kind &&
  (isString(api.apiVersionWithGroup) ? [column.apiVersion].flat().includes(api.apiVersionWithGroup) : true);

const getLoadErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    if (error.cause) {
      return `${error.message}: ${getLoadErrorMessage(error.cause)}`;
    }

    return error.message;
  }

  if (isObject(error) && hasTypedProperty(error, "message", isString)) {
    return error.message;
  }

  return `${String(error)}`;
};

@observer
class NonInjectedKubeObjectListLayout<
  K extends KubeObject,
  A extends KubeApi<K, D>,
  D extends KubeJsonApiDataFor<K>,
> extends React.Component<KubeObjectListLayoutProps<K, A, D> & Dependencies> {
  static defaultProps = {
    subscribeStores: true,
  };

  private readonly disposers: (() => void)[] = [];
  private readonly loadErrors = observable.array<string>();
  private readonly menuControls = new Map<string, MenuControls>();

  // The selected item is looked up in a computed over the store and the URL param it was made for,
  // not this.props, which mobx-react 9 forbids inside a derivation. The list renders again only when
  // the item itself changes, not on every change of the store's items.
  private selectedItemMemo?: {
    store: KubeItemListStore<K>;
    kubeSelectedUrlParam: PageParam<string>;
    value: IComputedValue<K | undefined>;
  };

  get selectedItem(): K | undefined {
    const { store, kubeSelectedUrlParam } = this.props;
    let memo = this.selectedItemMemo;

    if (!memo || memo.store !== store || memo.kubeSelectedUrlParam !== kubeSelectedUrlParam) {
      memo = this.selectedItemMemo = {
        store,
        kubeSelectedUrlParam,
        value: computed(() => {
          const path = kubeSelectedUrlParam.get();

          // No path selects nothing: no need to look through the items for it.
          return path ? store.getByPath(path) : undefined;
        }),
      };
    }

    return memo.value.get();
  }

  // The same views and getter for the same inputs, so that what is handed down does not look new on
  // every render.
  private defaultViewMemo?: {
    api: KubeItemListStore<K>["api"];
    resourceName: string;
    searchFields?: SearchField<K>[];
    view: AdvancedSearchView<K>;
  };

  private getItemsMemo?: { items?: K[]; store: KubeItemListStore<K>; getItems: () => K[] };

  componentDidMount() {
    const { store, dependentStores = [], subscribeStores, clusterFrameContext } = this.props;
    const stores = Array.from(new Set([store, ...dependentStores]));
    const reactions: Disposer[] = [
      reaction(
        // Read from the captured context, not this.props: mobx-react 9 forbids
        // reading this.props inside a derivation (this reaction's data function).
        () => clusterFrameContext.contextNamespaces.slice(),
        () => {
          // clear load errors
          this.loadErrors.length = 0;
        },
      ),
    ];

    if (subscribeStores) {
      reactions.push(
        this.props.subscribeToStores(stores, {
          onLoadFailure: (error) => {
            this.loadErrors.push(getLoadErrorMessage(error));
          },
        }),
      );
    }

    this.disposers.push(...reactions);
  }

  componentWillUnmount() {
    this.disposers.forEach((dispose) => dispose());
  }

  renderLoadErrors() {
    if (this.loadErrors.length === 0) {
      return null;
    }

    return (
      <Icon
        material="warning"
        className="load-error"
        tooltip={{
          children: (
            <>
              {this.loadErrors.map((error, index) => (
                <p key={index}>{error}</p>
              ))}
            </>
          ),
          preferredPositions: TooltipPosition.BOTTOM,
        }}
      />
    );
  }

  private registerControls = (id: string) => (controls: MenuControls) => {
    this.menuControls.set(id, controls);
  };

  private getDefaultView(resourceName: string): AdvancedSearchView<K> {
    const { store, searchFields } = this.props;
    const memo = this.defaultViewMemo;

    if (memo && memo.api === store.api && memo.resourceName === resourceName && memo.searchFields === searchFields) {
      return memo.view;
    }

    const view: AdvancedSearchView<K> = {
      viewKey: `${store.api.apiVersionWithGroup}/${store.api.kind}`,
      viewTitle: resourceName,
      fields: [...getKubeObjectSearchFields<K>(store.api.isNamespaced), ...(searchFields ?? [])],
    };

    this.defaultViewMemo = { api: store.api, resourceName, searchFields, view };

    return view;
  }

  private getItemsOf(items: K[] | undefined, store: KubeItemListStore<K>): () => K[] {
    const memo = this.getItemsMemo;

    if (memo && memo.items === items && memo.store === store) {
      return memo.getItems;
    }

    // Read captured locals, not this.props: ItemListLayout invokes getItems
    // from within its own derivation, where mobx-react 9 forbids this.props.
    const getItems = () => items || store.contextItems;

    this.getItemsMemo = { items, store, getItems };

    return getItems;
  }

  render() {
    const {
      className,
      customizeHeader,
      store,
      items,
      dependentStores,
      toggleKubeDetailsPane: toggleDetails,
      onDetails,
      renderTableContents,
      renderTableHeader,
      columns,
      generalColumns,
      sortingCallbacks = {},
      customizeTableRowProps,
      searchFields = [],
      advancedSearch,
      ...layoutProps
    } = this.props;
    const resourceName = this.props.resourceName || ResourceNames[ResourceKindMap[store.api.kind]] || store.api.kind;
    const advancedSearchView = advancedSearch ?? this.getDefaultView(resourceName);
    const targetColumns = [...(columns ?? []), ...generalColumns.filter(matchesApiFor(store.api))];

    void dependentStores;

    targetColumns.forEach((col) => {
      if (col.sortingCallBack) {
        sortingCallbacks[col.id] = col.sortingCallBack;
      }
    });

    // The order of the cells depends on how many of them the list gives and on the columns, not on the
    // item, so it is worked out once for each count and not for every row.
    const priorityOrders = new Map<number, number[]>();
    const getPriorityOrder = (contentCount: number) => {
      let order = priorityOrders.get(contentCount);

      if (!order) {
        order = getCellOrder(
          contentCount,
          targetColumns.map((col) => col.priority),
        );
        priorityOrders.set(contentCount, order);
      }

      return order;
    };

    const headers = sortBy(
      [...(renderTableHeader || []).map((header, index) => ({ priority: 20 - index, header })), ...targetColumns],
      (v) => -v.priority,
    ).map((col) => col.header);

    const getTableRowCustomizations = (item: K) => {
      const id = `menu-actions-for-kube-object-menu-for-${item.getId()}`;
      const baseProps = customizeTableRowProps?.(item) ?? {};

      return {
        id,
        ...baseProps,
        onContextMenu: (evt: React.MouseEvent<HTMLDivElement>) => {
          baseProps.onContextMenu?.(evt);

          const controls = this.menuControls.get(id);

          if (!controls) {
            return;
          }

          evt.preventDefault();
          evt.stopPropagation();

          const cursorPosition = { x: evt.clientX, y: evt.clientY };
          const contextTarget = evt.currentTarget as HTMLElement;

          for (const [otherId, otherControls] of this.menuControls.entries()) {
            if (otherId !== id) {
              otherControls.close();
            }
          }

          requestAnimationFrame(() => {
            controls.open({ cursorPosition, contextTarget });
          });
        },
      };
    };

    return (
      <ItemListLayout<K, false>
        className={cssNames("KubeObjectListLayout", className)}
        store={store}
        getItems={this.getItemsOf(items, store)}
        preloadStores={false} // loading handled in kubeWatchApi.subscribeStores()
        detailsItem={this.selectedItem}
        customizeHeader={[
          ({ filters, searchProps, info, ...headerPlaceHolders }) => ({
            filters: (
              <>
                {filters}
                {store.api.isNamespaced && (
                  <NamespaceSelectFilter id="kube-object-list-layout-namespace-select-input" />
                )}
              </>
            ),
            searchProps: {
              ...searchProps,
              placeholder: `Search ${resourceName}...`,
            },
            info: (
              <>
                {info}
                {this.renderLoadErrors()}
              </>
            ),
            ...headerPlaceHolders,
          }),
          ...[customizeHeader].filter(isDefined).flat(),
        ]}
        renderItemMenu={(item) => (
          <KubeObjectMenu
            id={item.getId()}
            object={item}
            onMenuReady={this.registerControls(`menu-actions-for-kube-object-menu-for-${item.getId()}`)}
          />
        )}
        onDetails={onDetails ?? ((item) => toggleDetails(item.selfLink))}
        inlineDetails={{
          render: (item) => <InlineDetailsPanel object={item} />,
          rowClickExpands: () => this.props.preferences.rowClickAction === "expand",
        }}
        sortingCallbacks={sortingCallbacks}
        renderTableHeader={headers}
        renderTableContents={(item) => {
          const contents = [...renderTableContents(item), ...targetColumns.map((col) => col.content(item))];

          return getPriorityOrder(contents.length - targetColumns.length).map((position) => contents[position]);
        }}
        spinnerTestId="kube-object-list-layout-spinner"
        advancedSearch={advancedSearchView}
        {...layoutProps}
        customizeTableRowProps={getTableRowCustomizations}
      />
    );
  }
}

export const KubeObjectListLayout = withInjectables<
  Dependencies,
  KubeObjectListLayoutProps<
    KubeObject,
    KubeApi<KubeObject, KubeJsonApiDataFor<KubeObject>>,
    KubeJsonApiDataFor<KubeObject>
  >
>(NonInjectedKubeObjectListLayout, {
  getProps: (di, props) => ({
    ...props,
    clusterFrameContext: di.inject(clusterFrameContextForNamespacedResourcesInjectable),
    subscribeToStores: di.inject(subscribeStoresInjectable),
    kubeSelectedUrlParam: di.inject(kubeSelectedUrlParamInjectable),
    toggleKubeDetailsPane: di.inject(toggleKubeDetailsPaneInjectable),
    generalColumns: di.injectMany(kubeObjectListLayoutColumnInjectionToken),
    preferences: di.inject(userPreferencesStateInjectable),
  }),
}) as <K extends KubeObject, A extends KubeApi<K, D>, D extends KubeJsonApiDataFor<K> = KubeJsonApiDataFor<K>>(
  props: KubeObjectListLayoutProps<K, A, D>,
) => React.ReactElement;
