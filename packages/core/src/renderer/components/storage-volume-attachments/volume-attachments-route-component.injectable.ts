/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import volumeAttachmentsRouteInjectable from "../../../common/front-end-routing/routes/cluster/storage/volume-attachments/volume-attachments-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { VolumeAttachments } from "./volume-attachments";

const volumeAttachmentsRouteComponentInjectable = getInjectable({
  id: "volume-attachments-route-component",

  instantiate: (di) => ({
    route: di.inject(volumeAttachmentsRouteInjectable),
    Component: VolumeAttachments,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default volumeAttachmentsRouteComponentInjectable;
