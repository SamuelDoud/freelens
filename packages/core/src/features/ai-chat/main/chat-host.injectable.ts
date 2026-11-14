/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { loggerInjectionToken } from "@freelensapp/logger";
import { sendMessageToChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import { runInAction } from "mobx";
import clusterFramesInjectable from "../../../common/cluster-frames.injectable";
import k8sRequestInjectable from "../../../main/k8s-request.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { aiChatClosedChannel, aiChatStateChannel, aiToolCallChannel } from "../common/channels";
import { defaultAiChatPreferences } from "../common/preferences";
import { AiChatHost } from "./chat-host";
import aiChatWindowInjectable from "./chat-window.injectable";
import aiCliDiscoveryInjectable from "./cli-discovery.injectable";
import aiCliTurnsInjectable from "./cli-turns.injectable";
import { aiHttpRequest } from "./http-request";
import aiMcpServerInjectable from "./mcp-server.injectable";
import aiMuseSessionsInjectable from "./muse-sessions.injectable";

// A local model can take minutes to answer a long conversation.
const openAiTimeoutMs = 10 * 60 * 1000;

const aiChatHostInjectable = getInjectable({
  id: "ai-chat-host",
  instantiate: (di) => {
    const state = di.inject(userPreferencesStateInjectable);
    const sendMessageToChannel = di.inject(sendMessageToChannelInjectionToken);
    const clusterFrames = di.inject(clusterFramesInjectable);
    const k8sRequest = di.inject(k8sRequestInjectable);
    const logger = di.inject(loggerInjectionToken);
    const preferences = () => state.aiChat ?? defaultAiChatPreferences;
    // Injected on use: the MCP server and the window call back into the host.
    const mcpServer = () => di.inject(aiMcpServerInjectable);
    const chatWindow = () => di.inject(aiChatWindowInjectable);

    const host: AiChatHost = new AiChatHost({
      preferences,
      updatePreferences: (changes) =>
        runInAction(() => {
          state.aiChat = { ...preferences(), ...changes };
        }),
      resolveCommand: (provider) => di.inject(aiCliDiscoveryInjectable).resolveCommand(provider),
      cliTurns: di.inject(aiCliTurnsInjectable),
      muse: di.inject(aiMuseSessionsInjectable),
      mcpUrlFor: (chatId) => mcpServer().urlFor(chatId),
      mcpToken: () => mcpServer().token,
      hasClusterFrame: (clusterId) => clusterFrames.has(clusterId),
      sendSnapshot: (snapshot) => sendMessageToChannel(aiChatStateChannel, snapshot),
      sendClosed: (chatId) => sendMessageToChannel(aiChatClosedChannel, { chatId }),
      sendToolCall: (call) => sendMessageToChannel(aiToolCallChannel, call),
      postOpenAi: async (clusterId, body, signal) => {
        const endpoint = preferences().openAiEndpoint;

        if (endpoint.kind === "service") {
          // Through the cluster's proxy, with the user's credentials: the server needs no ingress.
          return k8sRequest(
            { id: clusterId },
            `/api/v1/namespaces/${encodeURIComponent(endpoint.namespace)}/services/${encodeURIComponent(endpoint.service)}:${encodeURIComponent(endpoint.port)}/proxy/v1/chat/completions`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              timeout: openAiTimeoutMs,
              signal,
            },
          );
        }

        if (endpoint.kind === "url") {
          const base = endpoint.url.replace(/\/+$/, "").replace(/\/v1$/, "");
          const result = await aiHttpRequest(
            `${base}/v1/chat/completions`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal },
            openAiTimeoutMs,
          );

          if (!result.ok) {
            throw new Error(result.error);
          }

          if (result.status >= 400) {
            throw new Error(`The model server answered ${result.status}: ${result.text.slice(0, 500)}`);
          }

          return JSON.parse(result.text) as unknown;
        }

        throw new Error("No OpenAI-compatible server is set up: set one in Preferences → AI.");
      },
      openWindow: (chatId, title) =>
        chatWindow().open(chatId, title, (closedChatId) => host.windowClosed(closedChatId)),
      closeWindow: (chatId) => chatWindow().close(chatId),
      logInfo: (message) => logger.info(message),
    });

    return host;
  },
});

export default aiChatHostInjectable;
