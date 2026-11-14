/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./table-row.scss";

import { cssNames } from "@freelensapp/utilities";
import React from "react";

import type { CSSProperties } from "react";

export type TableRowElem<Item> = React.ReactElement<TableRowProps<Item>>;

export interface TableRowProps<Item> extends React.DOMAttributes<HTMLDivElement> {
  className?: string;
  selected?: boolean;
  style?: CSSProperties;
  /**
   * Should the inner `<TableCell>` be aligned to one line
   * `white-space: nowrap`
   */
  nowrap?: boolean;
  /**
   * data for sorting callback in `<Table sortable={}></Table>`
   */
  sortItem?: Item;
  /**
   * data for searching filters in `<Table searchable={}></Table>`
   */
  searchItem?: Item;
  disabled?: boolean;
  testId?: string;
  /**
   * Content shown under the row's cells, such as the details of its object. The row's handlers stay
   * on the cells: a click in the expansion is not a click on the row.
   */
  expansion?: React.ReactNode;
}

export class TableRow<Item> extends React.Component<TableRowProps<Item>> {
  render() {
    const { className, nowrap, selected, disabled, children, sortItem, searchItem, testId, expansion, ...rowProps } =
      this.props;
    const classNames = cssNames("TableRow", className, { selected, nowrap, disabled });

    if (expansion === undefined || expansion === null || expansion === false) {
      return (
        <div className={classNames} data-testid={testId} {...rowProps}>
          {children}
        </div>
      );
    }

    const { style, ...cellsProps } = rowProps;

    return (
      <div className="TableRowGroup" style={style}>
        <div className={cssNames(classNames, "expanded")} data-testid={testId} {...cellsProps}>
          {children}
        </div>
        {expansion}
      </div>
    );
  }
}
