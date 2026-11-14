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
import volumeAttributesClassStoreInjectable from "./store.injectable";

import type { VolumeAttributesClassStore } from "./store";

enum columnId {
  name = "name",
  driver = "driver",
  parameters = "parameters",
  age = "age",
}

interface Dependencies {
  store: VolumeAttributesClassStore;
}

const NonInjectedVolumeAttributesClasses = observer(({ store }: Dependencies) => (
  <SiblingsInTabLayout>
    <KubeObjectListLayout
      isConfigurable
      tableId="storage_volumeattributesclasses"
      className="VolumeAttributesClasses"
      store={store}
      sortingCallbacks={{
        [columnId.name]: (item) => item.getName(),
        [columnId.driver]: (item) => item.driverName,
        [columnId.age]: (item) => -item.getCreationTimestamp(),
      }}
      searchFilters={[(item) => item.getSearchFields()]}
      renderHeaderTitle="Volume Attributes Classes"
      renderTableHeader={[
        { title: "Name", className: "name", sortBy: columnId.name, id: columnId.name },
        { title: "Driver", className: "driver", sortBy: columnId.driver, id: columnId.driver },
        { title: "Parameters", className: "parameters", id: columnId.parameters },
        { title: "Age", className: "age", sortBy: columnId.age, id: columnId.age },
      ]}
      renderTableContents={(item) => [
        <WithTooltip>{item.getName()}</WithTooltip>,
        <WithTooltip>{text(item.driverName)}</WithTooltip>,
        <WithTooltip>
          {text(
            Object.entries(item.parameters)
              .map(([key, value]) => `${key}=${value}`)
              .join(", "),
          )}
        </WithTooltip>,
        <KubeObjectAge key="age" object={item} />,
      ]}
    />
  </SiblingsInTabLayout>
));

export const VolumeAttributesClasses = withInjectables<Dependencies>(NonInjectedVolumeAttributesClasses, {
  getProps: (di, props) => ({
    ...props,
    store: di.inject(volumeAttributesClassStoreInjectable),
  }),
});
