/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { KubeObject } from "@freelensapp/kube-object";

import type { SearchField } from "../common/conditions";

const parseTime = (timestamp: string | undefined) => (timestamp ? new Date(timestamp).getTime() : undefined);

/**
 * The fields every list of kube objects can search: name, namespace (for
 * namespaced kinds), age, labels, annotations and owners.
 */
export function getKubeObjectSearchFields<K extends KubeObject>(isNamespaced: boolean): SearchField<K>[] {
  return [
    { id: "name", title: "Name", kind: "text", getValues: (object) => object.getName() },
    ...(isNamespaced
      ? [{ id: "namespace", title: "Namespace", kind: "text", getValues: (object) => object.getNs() } as SearchField<K>]
      : []),
    {
      id: "age",
      title: "Age (created)",
      kind: "time",
      getTime: (object) => parseTime(object.metadata.creationTimestamp),
    },
    { id: "labels", title: "Labels (key=value)", kind: "text", getValues: (object) => object.getLabels() },
    {
      id: "annotations",
      title: "Annotations (key=value)",
      kind: "text",
      getValues: (object) => object.getAnnotations(),
    },
    {
      id: "owner",
      title: "Owner (Kind/name)",
      kind: "text",
      getValues: (object) => object.getOwnerRefs().map(({ kind, name }) => `${kind}/${name}`),
    },
  ];
}
