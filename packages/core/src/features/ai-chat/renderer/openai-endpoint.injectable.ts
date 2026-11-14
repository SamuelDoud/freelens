/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { requestFromChannelInjectionToken } from "@freelensapp/messaging";
import { getInjectable } from "@ogre-tools/injectable";
import apiKubeInjectable from "../../../renderer/k8s/api-kube.injectable";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { aiHttpGetChannel, aiHttpPostChannel } from "../common/channels";
import { defaultAiChatPreferences } from "../common/preferences";

import type { AiOpenAiEndpoint } from "../common/preferences";

// A local model can take minutes to answer a long conversation.
const requestTimeoutMs = 10 * 60 * 1000;

export interface AiOpenAiEndpointClient {
  postChat: (body: Record<string, unknown>, signal: AbortSignal) => Promise<unknown>;
  listModels: () => Promise<string[]>;
}

/** The API path of the server, without the trailing slash. */
export const openAiBasePath = (endpoint: AiOpenAiEndpoint) =>
  endpoint.kind === "service"
    ? `/api/v1/namespaces/${encodeURIComponent(endpoint.namespace)}/services/${encodeURIComponent(endpoint.service)}:${encodeURIComponent(endpoint.port)}/proxy/v1`
    : `${endpoint.url.replace(/\/+$/, "").replace(/\/v1$/, "")}/v1`;

const parseResponse = (status: number, text: string) => {
  let body: unknown = text;

  try {
    body = JSON.parse(text);
  } catch {
    // Not JSON: an error page, kept as text.
  }

  if (status >= 400) {
    throw new Error(
      `The model server answered ${status}: ${String(typeof body === "string" ? body : JSON.stringify(body)).slice(0, 500)}`,
    );
  }

  return body;
};

/**
 * The OpenAI-compatible server: a Service is reached through the cluster's API proxy with the
 * user's credentials, a URL from the main process.
 */
const aiOpenAiEndpointInjectable = getInjectable({
  id: "ai-chat-openai-endpoint",
  instantiate: (di): AiOpenAiEndpointClient => {
    const apiKube = di.inject(apiKubeInjectable);
    const requestFromChannel = di.inject(requestFromChannelInjectionToken);
    const state = di.inject(userPreferencesStateInjectable);
    const endpoint = () => (state.aiChat ?? defaultAiChatPreferences).openAiEndpoint;

    return {
      postChat: async (body, signal) => {
        const current = endpoint();
        const path = `${openAiBasePath(current)}/chat/completions`;

        if (current.kind === "service") {
          return apiKube.post(path, { data: body as never }, { signal });
        }

        const result = await requestFromChannel(aiHttpPostChannel, { url: path, body, timeoutMs: requestTimeoutMs });

        if (!result.ok) {
          throw new Error(result.error);
        }

        return parseResponse(result.status, result.text);
      },
      listModels: async () => {
        const current = endpoint();
        const path = `${openAiBasePath(current)}/models`;
        const response = (
          current.kind === "service"
            ? await apiKube.get(path)
            : await requestFromChannel(aiHttpGetChannel, { url: path, timeoutMs: 15000 }).then((result) => {
                if (!result.ok) throw new Error(result.error);

                return parseResponse(result.status, result.text);
              })
        ) as { data?: { id?: unknown }[] };

        return (response?.data ?? []).map((model) => model.id).filter((id): id is string => typeof id === "string");
      },
    };
  },
});

export default aiOpenAiEndpointInjectable;
