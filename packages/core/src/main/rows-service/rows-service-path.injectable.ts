/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import bundledBinaryPathInjectable from "../../common/utils/bundled-binary-path.injectable";

/**
 * The prototype rows service, built by `freelens/rows-service/build.sh` into
 * the bundled binaries next to the proxy, kubectl and helm.
 */
const rowsServicePathInjectable = getInjectable({
  id: "rows-service-path",
  instantiate: (di) => di.inject(bundledBinaryPathInjectable, "freelens-rows"),
});

export default rowsServicePathInjectable;
