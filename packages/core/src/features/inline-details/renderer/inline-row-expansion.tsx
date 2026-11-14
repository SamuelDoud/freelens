/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { useLayoutEffect, useRef } from "react";
import styles from "./inline-details.module.scss";

import type { StrictReactNode } from "@freelensapp/utilities";

import type { ExpandedRows } from "./expanded-rows";

export interface InlineRowExpansionProps {
  rows: ExpandedRows;
  id: string;
  children: StrictReactNode;
}

/**
 * The room under an open row: as tall as the row's slide has reached, with the details measured
 * inside it, so that the list can make room for all of them without scrolling inside.
 */
export const InlineRowExpansion = observer(({ rows, id, children }: InlineRowExpansionProps) => {
  const content = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = content.current;

    if (!element) {
      return undefined;
    }

    const measure = () => rows.setMeasured(id, element.offsetHeight);

    measure();

    if (typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver(measure);

    observer.observe(element);

    return () => observer.disconnect();
  }, [rows, id]);

  return (
    <div className={styles.expansion} style={{ height: rows.extraHeight(id) }} data-testid={`inline-details-${id}`}>
      <div ref={content}>{children}</div>
    </div>
  );
});
