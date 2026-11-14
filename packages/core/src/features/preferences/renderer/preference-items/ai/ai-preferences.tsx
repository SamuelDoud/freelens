/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Button } from "@freelensapp/button";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useState } from "react";
import { Checkbox } from "../../../../../renderer/components/checkbox";
import { Input } from "../../../../../renderer/components/input";
import { SubTitle } from "../../../../../renderer/components/layout/sub-title";
import { Select } from "../../../../../renderer/components/select";
import { defaultAiSystemPrompt } from "../../../../ai-chat/common/default-system-prompt";
import { modelsFor } from "../../../../ai-chat/common/models";
import { defaultAiChatPreferences, isOpenAiConfigured } from "../../../../ai-chat/common/preferences";
import {
  aiCliProviderIds,
  aiProviderIds,
  aiProviderLabels,
  isAiCliProviderId,
  openAiEfforts,
} from "../../../../ai-chat/common/providers";
import { modelOptions } from "../../../../ai-chat/renderer/ai-chat-view";
import aiDiscoveryMirrorInjectable from "../../../../ai-chat/renderer/discovery.injectable";
import userPreferencesStateInjectable from "../../../../user-preferences/common/state.injectable";
import styles from "./ai-preferences.module.scss";

import type { AiCliStatus } from "../../../../ai-chat/common/discovery";
import type { AiChatPreferences, AiProviderPreferences } from "../../../../ai-chat/common/preferences";
import type { AiCliProviderId, AiProviderId } from "../../../../ai-chat/common/providers";
import type { AiDiscoveryMirror } from "../../../../ai-chat/renderer/discovery.injectable";
import type { UserPreferencesState } from "../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
  discovery: AiDiscoveryMirror;
}

const parseModels = (text: string) => [...new Set(text.split("\n").map((line) => line.trim()))].filter(Boolean);

// The text is kept as typed, so that a new line can be started; the list is parsed from it.
const ModelsInput = ({ models, onChange }: { models: readonly string[]; onChange: (models: string[]) => void }) => {
  const [text, setText] = useState(models.join("\n"));

  return (
    <Input
      theme="round-black"
      multiLine
      rows={3}
      placeholder="One model per line"
      value={text}
      onChange={(value) => {
        setText(value);
        onChange(parseModels(value));
      }}
    />
  );
};

const pathKeys: Record<AiCliProviderId, "claudePath" | "codexPath" | "musePath"> = {
  claude: "claudePath",
  codex: "codexPath",
  muse: "musePath",
};

const describeStatus = (status: AiCliStatus) => {
  switch (status.state) {
    case "checking":
      return "Checking…";
    case "missing":
      return "Not installed";
    case "error":
      return `Could not be asked: ${status.error ?? "unknown error"}`;
    case "found":
      return [
        status.version,
        status.signedIn === false ? "not signed in" : status.signedIn ? "signed in" : undefined,
        `${status.models.length} model${status.models.length === 1 ? "" : "s"}`,
      ]
        .filter(Boolean)
        .join(" · ");
  }
};

const NonInjectedAiPreferences = observer(({ state, discovery }: Dependencies) => {
  const preferences = state.aiChat ?? defaultAiChatPreferences;
  const discovered = discovery.get();
  const update = (changes: Partial<AiChatPreferences>) => {
    state.aiChat = { ...preferences, ...changes };
  };
  const updateProvider = (id: AiProviderId, changes: Partial<AiProviderPreferences>) =>
    update({ providers: { ...preferences.providers, [id]: { ...preferences.providers[id], ...changes } } });
  const label = (id: AiProviderId) => (id === "openai" ? preferences.openAiLabel : aiProviderLabels[id]);
  const endpoint = preferences.openAiEndpoint;
  const backends = aiProviderIds.filter((id) => id !== "openai" || isOpenAiConfigured(preferences));

  return (
    <div className={styles.aiPreferences} data-testid="ai-preferences">
      <section>
        <div className={styles.row}>
          <SubTitle title="Command-line agents" />
          <Button plain label="Refresh" data-testid="ai-refresh-discovery" onClick={() => void discovery.refresh()} />
        </div>
        {aiCliProviderIds.map((id) => (
          <div key={id} className={styles.cli} data-testid={`ai-cli-${id}`}>
            <div className={styles.cliName}>{aiProviderLabels[id]}</div>
            <div className={styles.cliStatus} data-testid={`ai-cli-status-${id}`}>
              {describeStatus(discovered[id])}
              {discovered[id].path && <span className={styles.path}>{discovered[id].path}</span>}
            </div>
            <Input
              theme="round-black"
              placeholder={`${id} (from the PATH)`}
              value={preferences[pathKeys[id]]}
              onChange={(value) => update({ [pathKeys[id]]: value })}
            />
          </div>
        ))}
        <small className="hint">
          Claude Code, Codex and Muse run as installed on this computer, signed in to your account as in a terminal.
          Freelens asks each for its models and efforts when it starts. In the chat they get only Freelens&apos;s tools:
          their own shell, file and web tools are switched off or sandboxed.
        </small>
      </section>

      <section>
        <SubTitle title="Defaults for new chats" />
        <Select
          id="ai-default-provider"
          themeName="lens"
          options={backends.map((id) => ({ value: id, label: label(id) }))}
          value={preferences.defaultProvider}
          onChange={(option) => {
            const provider = aiProviderIds.find((id) => id === option?.value);

            if (provider) update({ defaultProvider: provider });
          }}
        />
        {backends.map((id) => {
          const provider = preferences.providers[id];
          const models = modelsFor(id, isAiCliProviderId(id) ? discovered[id].models : [], provider.extraModels);
          const model = models.find((candidate) => candidate.id === provider.defaultModel) ?? models[0];
          const efforts = id === "openai" ? openAiEfforts : (model?.efforts ?? []);

          return (
            <div key={id} className={styles.row} data-testid={`ai-defaults-${id}`}>
              <span className={styles.backend}>{label(id)}</span>
              <Select
                id={`ai-default-model-${id}`}
                themeName="lens"
                isCreatable
                options={modelOptions(models, provider.defaultModel)}
                value={
                  provider.defaultModel || (models.some((candidate) => candidate.id === "default") ? "default" : "")
                }
                onChange={(option) =>
                  updateProvider(id, { defaultModel: option?.value === "default" ? "" : (option?.value ?? "") })
                }
              />
              <label className={styles.effort}>
                <span>Effort</span>
                <Select
                  id={`ai-default-effort-${id}`}
                  themeName="lens"
                  isDisabled={efforts.length === 0}
                  options={[
                    { value: "", label: "default" },
                    ...efforts.map((effort) => ({ value: effort, label: effort })),
                  ]}
                  value={efforts.includes(provider.defaultEffort) ? provider.defaultEffort : ""}
                  onChange={(option) => updateProvider(id, { defaultEffort: option?.value ?? "" })}
                />
              </label>
            </div>
          );
        })}
      </section>

      <section>
        <SubTitle title="OpenAI-compatible server" />
        <div className={styles.row}>
          <Select
            id="ai-openai-endpoint-kind"
            themeName="lens"
            options={[
              { value: "none", label: "Not set" },
              { value: "service", label: "A Service in the cluster" },
              { value: "url", label: "A URL" },
            ]}
            value={endpoint.kind}
            onChange={(option) =>
              update({
                openAiEndpoint:
                  option?.value === "url"
                    ? { kind: "url", url: "" }
                    : option?.value === "service"
                      ? { kind: "service", namespace: "", service: "", port: "" }
                      : { kind: "none" },
              })
            }
          />
          {endpoint.kind !== "none" && (
            <Input
              theme="round-black"
              placeholder="Name shown in the chat"
              value={preferences.openAiLabel}
              onChange={(openAiLabel) => update({ openAiLabel })}
            />
          )}
        </div>
        {endpoint.kind === "service" && (
          <div className={styles.row}>
            <Input
              theme="round-black"
              placeholder="Namespace"
              value={endpoint.namespace}
              onChange={(namespace) => update({ openAiEndpoint: { ...endpoint, namespace } })}
            />
            <Input
              theme="round-black"
              placeholder="Service"
              value={endpoint.service}
              onChange={(service) => update({ openAiEndpoint: { ...endpoint, service } })}
            />
            <Input
              theme="round-black"
              placeholder="Port"
              value={endpoint.port}
              onChange={(port) => update({ openAiEndpoint: { ...endpoint, port } })}
            />
          </div>
        )}
        {endpoint.kind === "url" && (
          <Input
            theme="round-black"
            placeholder="http://host:8000"
            value={endpoint.url}
            onChange={(url) => update({ openAiEndpoint: { kind: "url", url } })}
          />
        )}
        {endpoint.kind !== "none" && (
          <>
            <SubTitle title="Models of the server" />
            <ModelsInput
              models={preferences.providers.openai.extraModels}
              onChange={(extraModels) => updateProvider("openai", { extraModels })}
            />
          </>
        )}
        <small className="hint">
          Optional: a server with the OpenAI chat completions API and tool calling, such as llama.cpp, vLLM or Ollama. A
          Service is reached through the open cluster&apos;s API server with your credentials, so it needs no ingress.
        </small>
      </section>

      <section>
        <SubTitle title="Changes" />
        <Checkbox
          label="Ask before each change"
          value={preferences.askBeforeEachChange}
          onChange={(askBeforeEachChange) => update({ askBeforeEachChange })}
        />
        <small className="hint">
          The assistant can change the cluster only in a chat where you tick &quot;Allow changes&quot;; without it, it
          is not given the tools that change anything. With this option it also asks you to approve each change.
        </small>
      </section>

      <section>
        <SubTitle title="System prompt" />
        <Input
          theme="round-black"
          multiLine
          rows={12}
          maxRows={30}
          value={preferences.systemPrompt || defaultAiSystemPrompt}
          onChange={(text) => update({ systemPrompt: text.trim() === defaultAiSystemPrompt.trim() ? "" : text })}
        />
        <div className={styles.row}>
          <small className="hint">
            {preferences.systemPrompt ? "Your own system prompt." : "The built-in system prompt."} The chat adds the
            name of the open cluster to it.
          </small>
          <Button
            plain
            label="Reset to default"
            disabled={!preferences.systemPrompt}
            data-testid="ai-reset-system-prompt"
            onClick={() => update({ systemPrompt: "" })}
          />
        </div>
      </section>
    </div>
  );
});

export const AiPreferences = withInjectables<Dependencies>(NonInjectedAiPreferences, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
    discovery: di.inject(aiDiscoveryMirrorInjectable),
  }),
});
