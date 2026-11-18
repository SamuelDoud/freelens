/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getConvertedParts } from "@freelensapp/utilities";
import { kebabCase } from "es-toolkit";
import { Badge } from "../../badge";
import { KubeObjectAge } from "../../kube-object/age";
import { NamespaceSelectBadge } from "../../namespaces/namespace-select-badge";
import { StatusBrick } from "../../status-brick";
import { WithTooltip } from "../../with-tooltip";
import { COLUMN_PRIORITY } from "../columns/column-priority";
import { formatPodResource } from "../columns/pods-resource-column";
import { podRowCell } from "./pod-row-item";

import type { TableCellProps } from "@freelensapp/list-layout";
import type { StrictReactNode } from "@freelensapp/utilities";

import type { PodResourceColumnId } from "../columns/pods-resource-column";
import type { PodRowItem } from "./pod-row-item";

export interface PodRowColumn {
  id: string;
  priority: number;
  header: TableCellProps;
  content: (item: PodRowItem) => StrictReactNode | TableCellProps;
  sortingCallBack: (item: PodRowItem) => undefined | string | number | (string | number)[];
}

const header = (id: string, title: string, className = id): TableCellProps => ({
  title,
  className,
  sortBy: id,
  id,
});

const resourceColumn = (id: PodResourceColumnId, title: string, priority: number, cell: number): PodRowColumn => ({
  id,
  priority,
  header: header(id, title),
  content: (item) => formatPodResource(id, (item.cells[cell] as number | null) ?? undefined) ?? "—",
  // Pods without the amount sort first, as in the Pods list
  sortingCallBack: (item) => (item.cells[cell] as number | null) ?? -1,
});

/**
 * The columns of the Pods list that a row can fill, with the headers, ids,
 * priorities and sort keys of the list that is built from full pods. Missing:
 * the warning, ports, IP, CPU and memory usage and logs columns.
 */
const unsortedColumns: PodRowColumn[] = [
  {
    id: "name",
    priority: COLUMN_PRIORITY.NAME,
    header: header("name", "Name"),
    content: (item) => <WithTooltip>{item.getName()}</WithTooltip>,
    sortingCallBack: (item) => getConvertedParts(item.getName()),
  },
  {
    id: "namespace",
    priority: COLUMN_PRIORITY.NAMESPACE,
    header: header("namespace", "Namespace"),
    content: (item) => <NamespaceSelectBadge key="namespace" namespace={item.getNs()} />,
    sortingCallBack: (item) => item.getNs(),
  },
  {
    id: "containers",
    priority: COLUMN_PRIORITY.CONTAINERS,
    header: header("containers", "Containers"),
    content: (item) => (
      <>
        {item.containers.map(([name, className, detail]) => (
          <StatusBrick
            key={name}
            className={className}
            tooltip={{
              formatters: { tableView: true, nowrap: true },
              children: detail ? (
                <div className="title">
                  {name} <span className="text-secondary">{detail}</span>
                </div>
              ) : (
                <></>
              ),
            }}
          />
        ))}
      </>
    ),
    sortingCallBack: (item) => item.containers.length,
  },
  resourceColumn("cpuRequest", "CPU request", COLUMN_PRIORITY.CPU_REQUEST, podRowCell.cpuRequest),
  resourceColumn("cpuLimit", "CPU limit", COLUMN_PRIORITY.CPU_LIMIT, podRowCell.cpuLimit),
  resourceColumn("memoryRequest", "Memory request", COLUMN_PRIORITY.MEMORY_REQUEST, podRowCell.memoryRequest),
  resourceColumn("memoryLimit", "Memory limit", COLUMN_PRIORITY.MEMORY_LIMIT, podRowCell.memoryLimit),
  {
    id: "restarts",
    priority: COLUMN_PRIORITY.RESTARTS,
    header: header("restarts", "Restarts"),
    content: (item) => item.restarts,
    sortingCallBack: (item) => item.restarts,
  },
  {
    id: "owners",
    priority: COLUMN_PRIORITY.OWNERS,
    header: header("owners", "Controlled By"),
    // The row has the kind and name of an owner, not the API version a link needs
    content: (item) =>
      item.owners.map(([kind, name]) => (
        <Badge flat key={name} className="owner" tooltip={name}>
          {kind}
        </Badge>
      )),
    sortingCallBack: (item) => item.owners.map(([kind]) => kind),
  },
  {
    id: "node",
    priority: COLUMN_PRIORITY.NODE,
    header: header("node", "Node"),
    content: (item) => <WithTooltip>{item.node}</WithTooltip>,
    sortingCallBack: (item) => item.node,
  },
  {
    id: "qos",
    priority: COLUMN_PRIORITY.QOS,
    header: header("qos", "QoS"),
    content: (item) => item.qos,
    sortingCallBack: (item) => item.qos,
  },
  {
    id: "age",
    priority: COLUMN_PRIORITY.AGE,
    header: header("age", "Age"),
    content: (item) => <KubeObjectAge key="age" object={item.creationObject} />,
    sortingCallBack: (item) => -item.created,
  },
  {
    id: "status",
    priority: COLUMN_PRIORITY.STATUS,
    header: header("status", "Status"),
    content: (item) => ({ title: item.status, className: kebabCase(item.status) }),
    sortingCallBack: (item) => item.status,
  },
];

export const podRowColumns: PodRowColumn[] = unsortedColumns.sort((a, b) => b.priority - a.priority);
