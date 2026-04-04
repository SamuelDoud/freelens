import { nodeEnvInjectionToken } from "@freelensapp/core/main";
import { getInjectable } from "@ogre-tools/injectable";
import { app } from "electron";

export const nodeEnvInjectable = getInjectable({
  id: "node-env",
  instantiate: () => process.env.NODE_ENV || (app.isPackaged ? "production" : "development"),
  injectionToken: nodeEnvInjectionToken,
});
