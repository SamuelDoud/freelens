/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./table.scss";

import assert from "node:assert";
import { cssNames, isDefined } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import autoBindReact from "auto-bind/react";
import { computed } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { VirtualList } from "../virtual-list";
import orderByUrlParamInjectable from "./order-by-url-param.injectable";
import sortByUrlParamInjectable from "./sort-by-url-param.injectable";
import { applyHeldPositions, getSorted } from "./sorting";
import { TableHead } from "./table-head";
import tableModelInjectable from "./table-model/table-model.injectable";
import { TableRow } from "./table-row";

import type { ItemObject } from "@freelensapp/list-layout";
import type { StrictReactNode } from "@freelensapp/utilities";

import type { IComputedValue } from "mobx";

import type { PageParam } from "../../navigation/page-param";
import type { TableCellElem } from "./table-cell";
import type { TableHeadElem } from "./table-head";
import type { TableModel } from "./table-model/table-model";
import type { TableRowElem, TableRowProps } from "./table-row";

export type TableSortBy = string;
export type TableOrderBy = "asc" | "desc";
export interface TableSortParams {
  sortBy: TableSortBy;
  orderBy: TableOrderBy;
}
export type TableSortCallback<Item> = (data: Item) => undefined | string | number | (string | number)[];
export type TableSortCallbacks<Item> = Record<string, TableSortCallback<Item>>;

export interface TableProps<Item> extends React.DOMAttributes<HTMLDivElement> {
  /**
   * Used for persisting sort order and visible columns
   */
  tableId?: string;
  /**
   * The raw data for the table
   */
  items?: Item[];
  /**
   * Optional addition class names for the root HTML element
   */
  className?: string;
  /**
   * Setup auto-sizing for all columns (flex: 1 0)
   */
  autoSize?: boolean;
  /**
   * Highlight rows on hover
   */
  selectable?: boolean;
  /**
   * Use scrollbar if content is bigger than parent's height
   */
  scrollable?: boolean;
  /**
   * @deprecated Unused
   */
  storageKey?: string;
  /**
   * Define sortable callbacks for every column in `<TableHead><TableCell sortBy="someCol"></TableCell></TableHead>`
   * @sortItem argument in the callback is an object, provided in `<TableRow sortItem={someColDataItem}></TableRow>`
   */
  sortable?: TableSortCallbacks<Item>;
  /**
   * sorting state is managed globally from url params
   */
  sortSyncWithUrl?: boolean;
  /**
   * default sorting params
   */
  sortByDefault?: Partial<TableSortParams>;
  /**
   * callback on sort change
   *
   * Default: global sync with url
   */
  onSort?: (params: TableSortParams) => void;
  /**
   * This is shown when {@link TableProps.items} is empty
   */
  noItems?: StrictReactNode;
  /**
   * Allows to scroll list to selected item
   */
  selectedItemId?: string;

  /**
   * Use virtual list component to render only visible rows. By default uses a
   * auto sizer to fill available height
   */
  virtual?: boolean;
  /**
   * Only used when virtual is true. Sets the virtual list to be a fixed height.
   * Needed when used in contexts that already have a parent component that
   * is `overflow-y: scroll`,
   */
  virtualHeight?: number;
  /**
   * Row padding in pixels
   */
  rowPadding?: number;
  /**
   * Row line height in pixels
   */
  rowLineHeight?: number;
  customRowHeights?: (item: Item, lineHeight: number, paddings: number) => number;
  /**
   * Room to add under a few rows, by item id, on top of what `customRowHeights` gives. It is read
   * while rendering, so a change of an observable it reads updates the heights without the rest of
   * the table being worked out again.
   */
  extraRowHeights?: () => ReadonlyMap<string, number>;
  /**
   * Keep the rows where they are: while it is set, the order the rows had when it was set holds,
   * new rows come after them, and only a sort the user chooses reorders them.
   */
  holdOrder?: boolean;
  getTableRow?: (uid: string) => React.ReactElement<TableRowProps<Item>> | undefined | null;
  renderRow?: (item: Item, index: number) => React.ReactElement<TableRowProps<Item>> | undefined | null;
}

interface Dependencies {
  model: TableModel;
  sortByUrlParam: PageParam<string>;
  orderByUrlParam: PageParam<string>;
}

@observer
class NonInjectedTable<Item extends ItemObject> extends React.Component<TableProps<Item> & Dependencies> {
  static defaultProps: TableProps<any> = {
    scrollable: true,
    autoSize: true,
    rowPadding: 8,
    rowLineHeight: 17,
    sortSyncWithUrl: true,
    customRowHeights: (item, lineHeight, paddings) => lineHeight + paddings,
  };

  constructor(props: TableProps<Item> & Dependencies) {
    super(props);
    autoBindReact(this);
  }

  componentDidMount() {
    const { sortable, tableId } = this.props;

    if (sortable && !tableId) {
      console.error("Table must have props.tableId if props.sortable is specified");
    }
  }

  // Plain getters (not @computed): they read this.props, which mobx-react 9
  // forbids inside a derivation. Read from render, reactivity is preserved by
  // the observer render reaction.
  get isSortable() {
    const { sortable, tableId } = this.props;

    return Boolean(sortable && tableId);
  }

  get sortParams() {
    const modelParams = this.props.tableId ? this.props.model.getSortParams(this.props.tableId) : {};

    return Object.assign({}, this.props.sortByDefault, modelParams);
  }

  renderHead() {
    const { children } = this.props;
    const content = React.Children.toArray(children) as (TableRowElem<Item> | TableHeadElem)[];
    const headElem = content.find((elem) => elem.type === TableHead);

    if (!headElem) {
      return null;
    }

    if (this.isSortable) {
      const columns = React.Children.toArray(headElem.props.children) as TableCellElem[];

      return React.cloneElement(headElem, {
        children: columns.map((elem) => {
          if (elem.props.checkbox) {
            return elem;
          }
          const title =
            elem.props.title ||
            // copy cell content to title if it's a string
            // usable if part of TableCell's content is hidden when there is not enough space
            (typeof elem.props.children === "string" ? elem.props.children : undefined);

          return React.cloneElement(elem, {
            title,
            _sort: this.sort,
            _sorting: this.sortParams,
            _nowrap: headElem.props.nowrap,
          });
        }),
      });
    }

    return headElem;
  }

  // The positions the rows had when the order was held, how many positions there are, and the sort
  // they had then.
  private heldOrder?: { positions: Map<string, number>; length: number; sort: string };

  /** The items in the held order: the ones it knows at their place, the others after them. */
  private applyHeldOrder(sortedItems: Item[], hold: boolean, sort: string): Item[] {
    if (!hold) {
      this.heldOrder = undefined;

      return sortedItems;
    }

    if (!this.heldOrder || this.heldOrder.sort !== sort) {
      this.heldOrder = {
        positions: new Map(sortedItems.map((item, index) => [item.getId(), index])),
        length: sortedItems.length,
        sort,
      };

      return sortedItems;
    }

    const { positions, length } = this.heldOrder;

    return applyHeldPositions(sortedItems, positions, length);
  }

  // The last sort of the items by a column, for getSorted to start from.
  private lastSorted?: { sort: string; items: Item[] };

  // The order of the items and the heights of their rows are worked out once for the same input,
  // not on every render, and inside a computed so that an observable a sort callback or a height
  // callback reads (the metrics of the usage sorts) still makes them current. A computed must not
  // read this.props with mobx-react 9, so each one captures the values it needs.
  private orderMemo?: {
    items: Item[];
    sortable: boolean;
    sortBy?: string;
    orderBy?: string;
    callback?: TableSortCallback<Item>;
    hold: boolean;
    value: IComputedValue<Item[]>;
  };

  private heightsMemo?: {
    ordered: Item[];
    customRowHeights: NonNullable<TableProps<Item>["customRowHeights"]>;
    rowLineHeight: number;
    rowPadding: number;
    value: IComputedValue<number[]>;
    indexes?: { first: Map<string, number>; repeated: Map<string, number[]> };
  };

  private getOrderedItems(items: Item[]): Item[] {
    const sortable = this.isSortable;
    const { sortBy, orderBy } = this.sortParams;
    const callback = sortBy ? this.props.sortable?.[sortBy] : undefined;
    const hold = Boolean(this.props.holdOrder);
    const memo = this.orderMemo;

    if (
      !memo ||
      memo.items !== items ||
      memo.sortable !== sortable ||
      memo.sortBy !== sortBy ||
      memo.orderBy !== orderBy ||
      memo.callback !== callback ||
      memo.hold !== hold
    ) {
      const sort = `${sortBy}\0${orderBy}`;
      const value = computed(() => {
        const defined = items.filter(isDefined);

        if (!sortable && !hold) {
          return defined;
        }

        let sorted = defined;

        if (sortable && sortBy && orderBy) {
          // After a watch flush most items are the ones of the last sort, still in order: merge them
          // with the new ones instead of sorting everything again. Same result, found faster.
          const previous = this.lastSorted?.sort === sort ? this.lastSorted.items : undefined;

          sorted = getSorted(defined, callback, orderBy as TableOrderBy, previous);
          this.lastSorted = { sort, items: sorted };
        }

        return this.applyHeldOrder(sorted, hold, sort);
      });

      this.orderMemo = { items, sortable, sortBy, orderBy, callback, hold, value };
    }

    return this.orderMemo!.value.get();
  }

  private getRowHeights(
    ordered: Item[],
    customRowHeights: NonNullable<TableProps<Item>["customRowHeights"]>,
    rowLineHeight: number,
    rowPadding: number,
  ): number[] {
    let memo = this.heightsMemo;

    if (
      !memo ||
      memo.ordered !== ordered ||
      memo.customRowHeights !== customRowHeights ||
      memo.rowLineHeight !== rowLineHeight ||
      memo.rowPadding !== rowPadding
    ) {
      const value = computed(() => ordered.map((item) => customRowHeights(item, rowLineHeight, rowPadding * 2)));

      memo = this.heightsMemo = { ordered, customRowHeights, rowLineHeight, rowPadding, value };
    }

    const base = memo.value.get();
    const extras = this.props.extraRowHeights?.();

    if (!extras || extras.size === 0) {
      return base;
    }

    if (!memo.indexes) {
      const first = new Map<string, number>();
      const repeated = new Map<string, number[]>();

      ordered.forEach((item, index) => {
        const id = item.getId();

        if (!first.has(id)) {
          first.set(id, index);
        } else {
          const others = repeated.get(id);

          if (others) {
            others.push(index);
          } else {
            repeated.set(id, [index]);
          }
        }
      });
      memo.indexes = { first, repeated };
    }

    const { first, repeated } = memo.indexes;
    const heights = base.slice();

    for (const [id, extra] of extras) {
      const index = first.get(id);

      if (index === undefined) {
        continue;
      }

      heights[index] += extra;

      for (const other of repeated.get(id) ?? []) {
        heights[other] += extra;
      }
    }

    return heights;
  }

  getSorted(rawItems: Item[]) {
    const { sortBy, orderBy } = this.sortParams;

    if (!sortBy || !orderBy) {
      return rawItems;
    }

    return getSorted(rawItems, this.props.sortable?.[sortBy], orderBy);
  }

  protected onSort({ sortBy, orderBy }: TableSortParams) {
    assert(this.props.tableId);
    this.props.model.setSortParams(this.props.tableId, { sortBy, orderBy });
    const { sortSyncWithUrl, onSort } = this.props;

    if (sortSyncWithUrl) {
      this.props.sortByUrlParam.set(sortBy);
      this.props.orderByUrlParam.set(orderBy);
    }

    onSort?.({ sortBy, orderBy });
  }

  sort(colName: TableSortBy) {
    const { sortBy, orderBy } = this.sortParams;
    const sameColumn = sortBy == colName;
    const newSortBy: TableSortBy = colName;
    const newOrderBy: TableOrderBy = !orderBy || !sameColumn || orderBy === "desc" ? "asc" : "desc";

    this.onSort({
      sortBy: String(newSortBy),
      orderBy: newOrderBy,
    });
  }

  private getContent() {
    const { items = [], renderRow, children } = this.props;
    const content = React.Children.toArray(children) as (TableRowElem<Item> | TableHeadElem)[];

    if (renderRow) {
      content.push(...items.map(renderRow).filter(isDefined));
    }

    return content;
  }

  renderRows() {
    const {
      noItems,
      virtual,
      customRowHeights,
      rowLineHeight,
      rowPadding,
      items = [],
      getTableRow,
      selectedItemId,
      className,
      virtualHeight,
    } = this.props;
    const content = this.getContent();
    let rows: React.ReactElement<TableRowProps<Item>>[] = content.filter((elem) => elem.type === TableRow);
    let sortedItems: Item[];

    if (!this.props.holdOrder) {
      this.heldOrder = undefined;
    }

    if (!rows.length) {
      sortedItems = this.getOrderedItems(items);
    } else {
      sortedItems = rows.map((row) => row.props.sortItem).filter(isDefined);

      if (this.isSortable || this.props.holdOrder) {
        const sort = `${this.sortParams.sortBy}\0${this.sortParams.orderBy}`;

        sortedItems = this.applyHeldOrder(
          this.isSortable ? this.getSorted(sortedItems) : sortedItems,
          Boolean(this.props.holdOrder),
          sort,
        );

        // Index the rows once instead of scanning them for every item.
        // First row wins for a repeated sortItem, as Array.find did.
        const rowsBySortItem = new Map<Item, React.ReactElement<TableRowProps<Item>>>();

        for (const row of rows) {
          const { sortItem } = row.props;

          if (sortItem && !rowsBySortItem.has(sortItem)) {
            rowsBySortItem.set(sortItem, row);
          }
        }

        rows = sortedItems.map((item) => rowsBySortItem.get(item)).filter(isDefined);
      }
    }

    if (!rows.length && !items.length && noItems) {
      return noItems;
    }

    if (virtual) {
      assert(customRowHeights && rowLineHeight && rowPadding);
      const rowHeights = this.getRowHeights(sortedItems, customRowHeights, rowLineHeight, rowPadding);

      return (
        <VirtualList
          items={sortedItems}
          rowHeights={rowHeights}
          getRow={getTableRow}
          selectedItemId={selectedItemId}
          className={className}
          fixedHeight={virtualHeight}
        />
      );
    }

    return rows;
  }

  render() {
    const { selectable, scrollable, autoSize, virtual, className } = this.props;
    const classNames = cssNames("Table flex flex-col", className, {
      selectable,
      scrollable,
      sortable: this.isSortable,
      autoSize,
      virtual,
    });

    return (
      <div className={classNames}>
        {this.renderHead()}
        {this.renderRows()}
      </div>
    );
  }
}

export const Table = withInjectables<Dependencies, TableProps<ItemObject>>(NonInjectedTable, {
  getProps: (di, props) => ({
    ...props,
    model: di.inject(tableModelInjectable),
    orderByUrlParam: di.inject(orderByUrlParamInjectable),
    sortByUrlParam: di.inject(sortByUrlParamInjectable),
  }),
}) as <Item>(props: TableProps<Item>) => React.ReactElement;
