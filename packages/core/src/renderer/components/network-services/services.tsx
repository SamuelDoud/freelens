/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./services.scss";

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React from "react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { NamespaceSelectBadge } from "../namespaces/namespace-select-badge";
import { WithTooltip } from "../with-tooltip";
import serviceStoreInjectable from "./store.injectable";

import type { Service } from "@freelensapp/kube-object";

import type { SearchField } from "../../../features/advanced-search/common/conditions";
import type { ServiceStore } from "./store";

enum columnId {
  name = "name",
  namespace = "namespace",
  type = "type",
  clusterIp = "cluster-ip",
  externalIp = "external-ip",
  ports = "port",
  age = "age",
  status = "status",
}

const serviceSearchFields: SearchField<Service>[] = [
  { id: "type", title: "Type", kind: "text", getValues: (service) => service.getType() },
  { id: "clusterIP", title: "Cluster IP", kind: "text", getValues: (service) => service.getClusterIps() },
  { id: "externalIP", title: "External IP", kind: "text", getValues: (service) => service.getExternalIps() },
  {
    id: "ports",
    title: "Ports",
    kind: "text",
    getValues: (service) => service.getPorts().map((port) => port.toString()),
  },
  { id: "selector", title: "Selector (key=value)", kind: "text", getValues: (service) => service.getSelector() },
];

const formatExternalIps = (service: Service) => {
  const externalIps = service.getExternalIps();

  if (externalIps.length > 0) {
    return externalIps.join(", ");
  }

  if (service.spec?.externalName) {
    return service.spec.externalName;
  }

  return "-";
};

interface Dependencies {
  serviceStore: ServiceStore;
}

@observer
class NonInjectedServices extends React.Component<Dependencies> {
  render() {
    return (
      <SiblingsInTabLayout>
        <KubeObjectListLayout
          isConfigurable
          tableId="network_services"
          className="Services"
          store={this.props.serviceStore}
          sortingCallbacks={{
            [columnId.name]: (service) => service.getName(),
            [columnId.namespace]: (service) => service.getNs(),
            [columnId.ports]: (service) => service.spec.ports?.[0]?.port,
            [columnId.clusterIp]: (service) => service.getClusterIp(),
            [columnId.type]: (service) => service.getType(),
            [columnId.age]: (service) => -service.getCreationTimestamp(),
            [columnId.status]: (service) => service.getStatus(),
          }}
          searchFields={serviceSearchFields}
          searchFilters={[
            (service) => service.getSearchFields(),
            (service) => service.getSelector().join(" "),
            (service) => service.getPorts().join(" "),
          ]}
          renderHeaderTitle="Services"
          renderTableHeader={[
            { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
            { title: "Namespace", className: "namespace", sortBy: columnId.namespace, id: columnId.namespace },
            { title: "Type", className: "type", sortBy: columnId.type, id: columnId.type },
            { title: "Cluster IP", className: "clusterIp", sortBy: columnId.clusterIp, id: columnId.clusterIp },
            { title: "External IP", className: "externalIp", id: columnId.externalIp },
            { title: "Ports", className: "ports", sortBy: columnId.ports, id: columnId.ports },
            { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
            { title: "Status", className: "status", sortBy: columnId.status, id: columnId.status },
          ]}
          renderTableContents={(service) => [
            <WithTooltip>{service.getName()}</WithTooltip>,
            <NamespaceSelectBadge key="namespace" namespace={service.getNs()} />,
            service.getType(),
            <WithTooltip>{service.getClusterIp()}</WithTooltip>,
            <WithTooltip>{formatExternalIps(service)}</WithTooltip>,
            <WithTooltip>{service.getPorts().join(", ")}</WithTooltip>,
            <KubeObjectAge key="age" object={service} />,
            { title: service.getStatus(), className: service.getStatus().toLowerCase() },
          ]}
        />
      </SiblingsInTabLayout>
    );
  }
}

export const Services = withInjectables<Dependencies>(NonInjectedServices, {
  getProps: (di, props) => ({
    ...props,
    serviceStore: di.inject(serviceStoreInjectable),
  }),
});
