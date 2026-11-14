/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import volumeAttributesClassesRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/volume-attributes-classes/volume-attributes-classes-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { VolumeAttributesClasses } from "./volume-attributes-classes";

const volumeAttributesClassesRouteComponentInjectable = getInjectable({
  id: "volume-attributes-classes-route-component",

  instantiate: (di) => ({
    route: di.inject(volumeAttributesClassesRouteInjectable),
    Component: VolumeAttributesClasses,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default volumeAttributesClassesRouteComponentInjectable;
