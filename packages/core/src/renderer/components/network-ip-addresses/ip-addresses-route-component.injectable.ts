/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import ipAddressesRouteInjectable from "../../../common/front-end-routing/routes/cluster/network/ip-addresses/ip-addresses-route.injectable";
import { routeSpecificComponentInjectionToken } from "../../routes/route-specific-component-injection-token";
import { IPAddresses } from "./ip-addresses";

const ipAddressesRouteComponentInjectable = getInjectable({
  id: "ip-addresses-route-component",

  instantiate: (di) => ({
    route: di.inject(ipAddressesRouteInjectable),
    Component: IPAddresses,
  }),

  injectionToken: routeSpecificComponentInjectionToken,
});

export default ipAddressesRouteComponentInjectable;
