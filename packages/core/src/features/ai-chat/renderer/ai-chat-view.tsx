/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Button } from "@freelensapp/button";
import { Icon } from "@freelensapp/icon";
import { cssNames } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import { useEffect, useRef, useState } from "react";
import { Checkbox } from "../../../renderer/components/checkbox";
import { MarkdownViewer } from "../../../renderer/components/markdown-viewer";
import { Select } from "../../../renderer/components/select";
import userPreferencesStateInjectable from "../../user-preferences/common/state.injectable";
import { defaultAiChatPreferences } from "../common/preferences";
import { aiProviderEfforts, aiProviderIds, defaultAiProviderLabels } from "../common/providers";
import styles from "./ai-chat-view.module.scss";
import aiChatTurnsInjectable from "./chat-turns.injectable";
import aiChatsInjectable from "./chats.injectable";
import aiOpenAiEndpointInjectable from "./openai-endpoint.injectable";

import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { AiProviderId } from "../common/providers";
import type { AiChat, AiChatItem } from "./chat";
import type { AiChatTurns } from "./chat-turns";
import type { AiChats } from "./chats.injectable";
import type { AiOpenAiEndpointClient } from "./openai-endpoint.injectable";

export interface AiChatViewProps {
  tabId: string;
}

interface Dependencies {
  chats: AiChats;
  turns: AiChatTurns;
  preferencesState: UserPreferencesState;
  openAi: AiOpenAiEndpointClient;
}

const defaultOption = "";

const summarizeArgs = (args: unknown) => {
  if (!args || typeof args !== "object") return "";

  return Object.entries(args as Record<string, unknown>)
    .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" ");
};

const ChatItemView = observer(({ chat, item }: { chat: AiChat; item: AiChatItem }) => {
  switch (item.kind) {
    case "user":
      return <div className={cssNames(styles.message, styles.user)}>{item.text}</div>;
    case "assistant":
      return <MarkdownViewer className={cssNames(styles.message, styles.assistant)} markdown={item.text} />;
    case "tool":
      return (
        <details className={cssNames(styles.tool, styles[item.status])} data-testid="ai-chat-tool">
          <summary>
            <Icon
              small
              material={item.status === "running" ? "hourglass_empty" : item.status === "done" ? "check" : "error"}
            />
            <code>{item.name}</code> <span className={styles.args}>{summarizeArgs(item.args)}</span>
          </summary>
          {item.output && <pre>{item.output}</pre>}
        </details>
      );
    case "approval":
      return (
        <div className={styles.approval} data-testid="ai-chat-approval">
          <Icon small material="gpp_maybe" />
          <span>
            Change: <strong>{item.description}</strong>
          </span>
          {item.state === "pending" ? (
            <>
              <Button primary label="Approve" onClick={() => chat.resolveApproval(item.id, true)} />
              <Button outlined label="Reject" onClick={() => chat.resolveApproval(item.id, false)} />
            </>
          ) : (
            <span className={styles.approvalState}>{item.state}</span>
          )}
        </div>
      );
    case "notice":
      return <div className={cssNames(styles.notice, styles[item.tone])}>{item.text}</div>;
  }
});

const NonInjectedAiChatView = observer(
  ({ tabId, chats, turns, preferencesState, openAi }: AiChatViewProps & Dependencies) => {
    const chat = chats.forTab(tabId);
    const preferences = preferencesState.aiChat ?? defaultAiChatPreferences;
    const [draft, setDraft] = useState("");
    const [serverModels, setServerModels] = useState<string[]>([]);
    const messagesEnd = useRef<HTMLDivElement>(null);

    const providerLabel = (id: AiProviderId) =>
      id === "openai" ? preferences.openAiLabel : defaultAiProviderLabels[id];

    useEffect(() => {
      messagesEnd.current?.scrollIntoView?.({ block: "end" });
    }, [chat.items.length]);

    // The OpenAI-compatible server lists its own models.
    useEffect(() => {
      if (chat.provider !== "openai") return;

      let cancelled = false;

      openAi
        .listModels()
        .then((models) => !cancelled && setServerModels(models))
        .catch(() => !cancelled && setServerModels([]));

      return () => {
        cancelled = true;
      };
    }, [chat.provider, preferences.openAiEndpoint]);

    const models = [
      ...new Set([
        ...preferences.providers[chat.provider].models,
        ...(chat.provider === "openai" ? serverModels : []),
        ...(chat.model ? [chat.model] : []),
      ]),
    ];

    const send = () => {
      const text = draft;

      if (!text.trim() || chat.running) return;

      setDraft("");
      void turns.send(chat, text);
    };

    return (
      <div className={styles.aiChat} data-testid="ai-chat">
        <div className={styles.toolbar}>
          <Select
            id={`ai-chat-provider-${tabId}`}
            themeName="lens"
            className={styles.select}
            isDisabled={chat.running}
            options={aiProviderIds.map((id) => ({ value: id, label: providerLabel(id) }))}
            value={chat.provider}
            onChange={(option) => {
              const provider = aiProviderIds.find((id) => id === option?.value);

              if (provider) {
                chat.setSettings({
                  provider,
                  model: preferences.providers[provider].defaultModel,
                  effort: preferences.providers[provider].defaultEffort,
                });
              }
            }}
          />
          <Select
            id={`ai-chat-model-${tabId}`}
            themeName="lens"
            className={styles.select}
            isCreatable
            isDisabled={chat.running}
            options={[
              { value: defaultOption, label: "Default model" },
              ...models.map((model) => ({ value: model, label: model })),
            ]}
            value={chat.model}
            onChange={(option) => chat.setSettings({ model: option?.value ?? defaultOption })}
          />
          <Select
            id={`ai-chat-effort-${tabId}`}
            themeName="lens"
            className={styles.select}
            isDisabled={chat.running}
            options={[
              { value: defaultOption, label: "Default effort" },
              ...aiProviderEfforts[chat.provider].map((effort) => ({ value: effort, label: `Effort: ${effort}` })),
            ]}
            value={chat.effort}
            onChange={(option) => chat.setSettings({ effort: option?.value ?? defaultOption })}
          />
          <div
            className={cssNames(styles.allowChanges, { [styles.allowed]: chat.allowChanges })}
            data-testid="ai-chat-allow-changes"
          >
            <Checkbox
              label="Allow changes"
              value={chat.allowChanges}
              onChange={(value) => void turns.setAllowChanges(chat, value)}
            />
          </div>
          <div className={styles.spacer} />
          <Button
            plain
            label="New chat"
            disabled={chat.running}
            data-testid="ai-chat-new"
            onClick={() => chat.clear()}
          />
        </div>

        <div className={styles.messages} data-testid="ai-chat-messages">
          {chat.items.length === 0 && (
            <div className={styles.empty}>
              Ask about this cluster, e.g. "which pods are failing and why?". The assistant reads the cluster and drives
              this window through Freelens
              {chat.allowChanges
                ? ", and may change the cluster."
                : ", and cannot change anything until you tick Allow changes."}
            </div>
          )}
          {chat.items.map((item) => (
            <ChatItemView key={item.id} chat={chat} item={item} />
          ))}
          {chat.running && (
            <div className={styles.thinking}>
              <Icon small material="more_horiz" /> {providerLabel(chat.provider)} is working…
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        <div className={styles.composer}>
          <textarea
            className={styles.input}
            data-testid="ai-chat-input"
            placeholder={`Message ${providerLabel(chat.provider)} (Enter to send, Shift+Enter for a new line)`}
            value={draft}
            rows={2}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
          />
          {chat.running ? (
            <Button outlined label="Stop" data-testid="ai-chat-stop" onClick={() => void turns.stop(chat)} />
          ) : (
            <Button primary label="Send" data-testid="ai-chat-send" disabled={!draft.trim()} onClick={send} />
          )}
        </div>
      </div>
    );
  },
);

export const AiChatView = withInjectables<Dependencies, AiChatViewProps>(NonInjectedAiChatView, {
  getProps: (di, props) => ({
    ...props,
    chats: di.inject(aiChatsInjectable),
    turns: di.inject(aiChatTurnsInjectable),
    preferencesState: di.inject(userPreferencesStateInjectable),
    openAi: di.inject(aiOpenAiEndpointInjectable),
  }),
});
