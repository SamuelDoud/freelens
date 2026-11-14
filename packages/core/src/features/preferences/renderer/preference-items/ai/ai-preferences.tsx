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
import { defaultAiChatPreferences } from "../../../../ai-chat/common/preferences";
import { aiProviderEfforts, aiProviderIds, defaultAiProviderLabels } from "../../../../ai-chat/common/providers";
import userPreferencesStateInjectable from "../../../../user-preferences/common/state.injectable";
import styles from "./ai-preferences.module.scss";

import type { AiChatPreferences, AiProviderPreferences } from "../../../../ai-chat/common/preferences";
import type { AiProviderId } from "../../../../ai-chat/common/providers";
import type { UserPreferencesState } from "../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
}

const parseModels = (text: string) => [...new Set(text.split("\n").map((line) => line.trim()))].filter(Boolean);

// The text is kept as typed, so that a new line can be started; the list is parsed from it.
const ModelsInput = ({
  models,
  placeholder,
  onChange,
}: {
  models: readonly string[];
  placeholder: string;
  onChange: (models: string[]) => void;
}) => {
  const [text, setText] = useState(models.join("\n"));

  return (
    <Input
      theme="round-black"
      multiLine
      rows={3}
      placeholder={placeholder}
      value={text}
      onChange={(value) => {
        setText(value);
        onChange(parseModels(value));
      }}
    />
  );
};

const NonInjectedAiPreferences = observer(({ state }: Dependencies) => {
  const preferences = state.aiChat ?? defaultAiChatPreferences;
  const update = (changes: Partial<AiChatPreferences>) => {
    state.aiChat = { ...preferences, ...changes };
  };
  const updateProvider = (id: AiProviderId, changes: Partial<AiProviderPreferences>) =>
    update({ providers: { ...preferences.providers, [id]: { ...preferences.providers[id], ...changes } } });
  const label = (id: AiProviderId) => (id === "openai" ? preferences.openAiLabel : defaultAiProviderLabels[id]);
  const endpoint = preferences.openAiEndpoint;

  return (
    <div className={styles.aiPreferences} data-testid="ai-preferences">
      <section>
        <SubTitle title="Default backend" />
        <Select
          id="ai-default-provider"
          themeName="lens"
          options={aiProviderIds.map((id) => ({ value: id, label: label(id) }))}
          value={preferences.defaultProvider}
          onChange={(option) => {
            const provider = aiProviderIds.find((id) => id === option?.value);

            if (provider) update({ defaultProvider: provider });
          }}
        />
        <small className="hint">
          The backend a new AI chat starts with. Each chat can switch backend, model and effort.
        </small>
      </section>

      {aiProviderIds.map((id) => {
        const provider = preferences.providers[id];

        return (
          <section key={id} data-testid={`ai-provider-${id}`}>
            <SubTitle title={`${label(id)} models`} />
            <ModelsInput
              models={provider.models}
              placeholder={id === "openai" ? "The server's own list is added in the chat" : "One model per line"}
              onChange={(models) => updateProvider(id, { models })}
            />
            <small className="hint">
              {id === "claude" &&
                'The models offered in the chat, one per line: an alias such as "opus" or a full model name.'}
              {id === "codex" &&
                "The models offered in the chat, one per line. Empty offers only Codex's default model."}
              {id === "openai" && "Models to offer besides the ones the server lists, one per line."}
            </small>
            <div className={styles.row}>
              <Select
                id={`ai-default-model-${id}`}
                themeName="lens"
                isCreatable
                options={[
                  { value: "", label: "Default model" },
                  ...[...new Set([...provider.models, ...(provider.defaultModel ? [provider.defaultModel] : [])])].map(
                    (model) => ({ value: model, label: model }),
                  ),
                ]}
                value={provider.defaultModel}
                onChange={(option) => updateProvider(id, { defaultModel: option?.value ?? "" })}
              />
              <Select
                id={`ai-default-effort-${id}`}
                themeName="lens"
                options={[
                  { value: "", label: "Default effort" },
                  ...aiProviderEfforts[id].map((effort) => ({ value: effort, label: `Effort: ${effort}` })),
                ]}
                value={provider.defaultEffort}
                onChange={(option) => updateProvider(id, { defaultEffort: option?.value ?? "" })}
              />
            </div>
          </section>
        );
      })}

      <section>
        <SubTitle title="Command-line agents" />
        <div className={styles.row}>
          <Input
            theme="round-black"
            placeholder="claude (from the PATH)"
            value={preferences.claudePath}
            onChange={(claudePath) => update({ claudePath })}
          />
          <Input
            theme="round-black"
            placeholder="codex (from the PATH)"
            value={preferences.codexPath}
            onChange={(codexPath) => update({ codexPath })}
          />
        </div>
        <small className="hint">
          Claude Code and Codex run as installed on this computer, signed in to your account as in a terminal. In the
          chat they get only Freelens&apos;s tools: their own shell, file and web tools are switched off or sandboxed.
        </small>
      </section>

      <section>
        <SubTitle title="OpenAI-compatible server" />
        <div className={styles.row}>
          <Input
            theme="round-black"
            placeholder="Name shown in the chat"
            value={preferences.openAiLabel}
            onChange={(openAiLabel) => update({ openAiLabel })}
          />
          <Select
            id="ai-openai-endpoint-kind"
            themeName="lens"
            options={[
              { value: "service", label: "A Service in the cluster" },
              { value: "url", label: "A URL" },
            ]}
            value={endpoint.kind}
            onChange={(option) =>
              update({
                openAiEndpoint:
                  option?.value === "url"
                    ? { kind: "url", url: "" }
                    : (defaultAiChatPreferences.openAiEndpoint as AiChatPreferences["openAiEndpoint"]),
              })
            }
          />
        </div>
        {endpoint.kind === "service" ? (
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
        ) : (
          <Input
            theme="round-black"
            placeholder="http://host:8000"
            value={endpoint.url}
            onChange={(url) => update({ openAiEndpoint: { kind: "url", url } })}
          />
        )}
        <small className="hint">
          A server with the OpenAI chat completions API and tool calling, such as llama.cpp, vLLM or Ollama. A Service
          is reached through the open cluster&apos;s API server with your credentials, so it needs no ingress.
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
  }),
});
