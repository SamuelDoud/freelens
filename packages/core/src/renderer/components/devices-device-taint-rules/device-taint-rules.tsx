/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { KubeObjectAge } from "../kube-object/age";
import { KubeObjectListLayout } from "../kube-object-list-layout";
import { SiblingsInTabLayout } from "../layout/siblings-in-tab-layout";
import { text } from "../resource-details/format";
import { WithTooltip } from "../with-tooltip";
import deviceTaintRuleStoreInjectable from "./store.injectable";

import type { DeviceTaintRuleStore } from "./store";

enum columnId {
  name = "name",
  taint = "taint",
  driver = "driver",
  age = "age",
}

interface Dependencies {
  store: DeviceTaintRuleStore;
}

const NonInjectedDeviceTaintRules = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="devices_devicetaintrules"
      className="DeviceTaintRules"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.taint]: (item) => item.getTaint(),
        [columnId.driver]: (item) => item.spec?.deviceSelector?.driver,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Device Taint Rules"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Taint", className: "taint", sortBy: columnId.taint, id: columnId.taint },
        { title: "Driver", className: "driver", sortBy: columnId.driver, id: columnId.driver },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.getTaint())}</WithTooltip>,
        <WithTooltip>{text(item.spec?.deviceSelector?.driver)}</WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const DeviceTaintRules = withInjectables<Dependencies>(NonInjectedDeviceTaintRules, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(deviceTaintRuleStoreInjectable),
  }),
});
