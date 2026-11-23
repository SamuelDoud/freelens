/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { ItemObject } from "@freelensapp/list-layout";

/** One container of a row: its name, the class of its status brick and the text of its tooltip. */
export type PodRowContainer = readonly [name: string, className: string, detail: string];

/** The 14 cells of a row as the rows service sends them, `id` first. */
export type PodRowCells = readonly [
  id: number,
  name: string,
  namespace: string,
  containers: readonly PodRowContainer[],
  restarts: number,
  owners: readonly (readonly [kind: string, name: string])[],
  node: string,
  qos: string,
  created: number,
  status: string,
  cpuRequest: number | null,
  cpuLimit: number | null,
  memoryRequest: number | null,
  memoryLimit: number | null,
];

export const podRowCell = {
  id: 0,
  name: 1,
  namespace: 2,
  containers: 3,
  restarts: 4,
  owners: 5,
  node: 6,
  qos: 7,
  created: 8,
  status: 9,
  cpuRequest: 10,
  cpuLimit: 11,
  memoryRequest: 12,
  memoryLimit: 13,
} as const;

/**
 * A pod as the Pods list shows it, from a row. It is replaced by a new object
 * when any of its cells changes, which is what the list's search text cache
 * and its row cache rely on.
 */
export class PodRowItem implements ItemObject {
  private creationMetadata?: { metadata: { creationTimestamp: string } };

  constructor(readonly cells: PodRowCells) {}

  getId() {
    return String(this.cells[podRowCell.id]);
  }

  getName() {
    return this.cells[podRowCell.name];
  }

  getNs() {
    return this.cells[podRowCell.namespace];
  }

  get containers() {
    return this.cells[podRowCell.containers];
  }

  get restarts() {
    return this.cells[podRowCell.restarts];
  }

  get owners() {
    return this.cells[podRowCell.owners];
  }

  get node() {
    return this.cells[podRowCell.node];
  }

  get qos() {
    return this.cells[podRowCell.qos];
  }

  get created() {
    return this.cells[podRowCell.created];
  }

  get status() {
    return this.cells[podRowCell.status];
  }

  /** What the details drawer is asked for: the URL of the pod, which its store loads in full. */
  get selfLink() {
    return `/api/v1/namespaces/${this.getNs()}/pods/${this.getName()}`;
  }

  /** In the shape `KubeObjectAge` reads. */
  get creationObject() {
    return (this.creationMetadata ??= {
      metadata: { creationTimestamp: new Date(this.created).toISOString() },
    });
  }

  /** The text the quick search looks in: only what the columns can show. */
  getSearchTexts(): string[] {
    return [
      this.getName(),
      this.getNs(),
      this.status,
      this.node,
      this.qos,
      ...this.owners.flatMap(([kind, name]) => [kind, name]),
      ...this.containers.map(([name]) => name),
    ];
  }
}
