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
import { modelsFor } from "../common/models";
import { defaultAiChatPreferences, isOpenAiConfigured } from "../common/preferences";
import { aiProviderIds, aiProviderLabels, isAiCliProviderId, openAiEfforts } from "../common/providers";
import styles from "./ai-chat-view.module.scss";
import aiChatMirrorInjectable from "./chat-mirror.injectable";
import aiDiscoveryMirrorInjectable from "./discovery.injectable";

import type { UserPreferencesState } from "../../user-preferences/common/state.injectable";
import type { AiChatItem, AiChatSnapshot } from "../common/chat-state";
import type { AiChatPlacement } from "../common/preferences";
import type { AiProviderId } from "../common/providers";
import type { AiChatMirror } from "./chat-mirror.injectable";
import type { AiDiscoveryMirror } from "./discovery.injectable";

export interface AiChatViewProps {
  chatId: string;
}

interface Dependencies {
  mirror: AiChatMirror;
  discovery: AiDiscoveryMirror;
  preferencesState: UserPreferencesState;
}

const defaultOption = "";

const placements: { placement: AiChatPlacement; icon: string; tooltip: string }[] = [
  { placement: "bottom", icon: "call_to_action", tooltip: "Show at the bottom" },
  { placement: "right", icon: "vertical_split", tooltip: "Show at the right" },
  { placement: "window", icon: "open_in_new", tooltip: "Open in its own window" },
];

/**
 * The model choices: "default" (no model flag) unless the CLI lists a "default" model of its own,
 * which then stands for it, the reported models, and a model typed in that is not among them.
 */
export const modelOptions = (models: readonly { id: string; name: string }[], current: string) => [
  ...(models.some((model) => model.id === "default") ? [] : [{ value: defaultOption, label: "default" }]),
  ...models.map((model) => ({ value: model.id, label: model.name })),
  ...(current && current !== "default" && !models.some((model) => model.id === current)
    ? [{ value: current, label: current }]
    : []),
];

const summarizeArgs = (args: unknown) =>
  args && typeof args === "object"
    ? Object.entries(args as Record<string, unknown>)
        .map(([key, value]) => `${key}=${typeof value === "string" ? value : JSON.stringify(value)}`)
        .join(" ")
    : "";

const ChatItemView = ({ item, decide }: { item: AiChatItem; decide: (itemId: string, approved: boolean) => void }) => {
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
              <Button primary label="Approve" onClick={() => decide(item.id, true)} />
              <Button outlined label="Reject" onClick={() => decide(item.id, false)} />
            </>
          ) : (
            <span className={styles.approvalState}>{item.state}</span>
          )}
        </div>
      );
    case "notice":
      return <div className={cssNames(styles.notice, styles[item.tone])}>{item.text}</div>;
  }
};

const NonInjectedAiChatView = observer(
  ({ chatId, mirror, discovery, preferencesState }: AiChatViewProps & Dependencies) => {
    const chat: AiChatSnapshot | undefined = mirror.get(chatId);
    const preferences = preferencesState.aiChat ?? defaultAiChatPreferences;
    const discovered = discovery.get();
    const [draft, setDraft] = useState("");
    const messagesEnd = useRef<HTMLDivElement>(null);

    useEffect(() => {
      messagesEnd.current?.scrollIntoView?.({ block: "end" });
    }, [chat?.items.length]);

    if (!chat) {
      return <div className={styles.aiChat}>This chat was closed.</div>;
    }

    const command = (change: Parameters<AiChatMirror["command"]>[0]) => void mirror.command(change);
    const providerLabel = (id: AiProviderId) => (id === "openai" ? preferences.openAiLabel : aiProviderLabels[id]);
    const reported = isAiCliProviderId(chat.provider) ? discovered[chat.provider].models : [];
    const models = modelsFor(chat.provider, reported, preferences.providers[chat.provider].extraModels);
    // The effort list of the chosen model, or of the backend's default model (its first).
    const model = models.find((candidate) => candidate.id === chat.model) ?? models[0];
    const efforts = chat.provider === "openai" ? openAiEfforts : (model?.efforts ?? []);

    const providerOptions = aiProviderIds
      .filter((id) => id !== "openai" || isOpenAiConfigured(preferences))
      .map((id) => {
        const status = isAiCliProviderId(id) ? discovered[id] : undefined;
        const unavailable = status?.state === "missing" || status?.state === "error";

        return {
          value: id,
          label: `${providerLabel(id)}${status?.state === "missing" ? " (not installed)" : status?.signedIn === false ? " (not signed in)" : ""}`,
          isDisabled: unavailable,
        };
      });

    const send = () => {
      if (!draft.trim() || chat.running) return;

      command({ type: "send", chatId, text: draft });
      setDraft("");
    };

    return (
      <div className={styles.aiChat} data-testid="ai-chat" data-chat-id={chatId}>
        <div className={styles.header}>
          <Icon material="smart_toy" small />
          <span className={styles.cluster} title="The cluster this chat reads and drives">
            {chat.clusterName}
          </span>
          <div className={styles.spacer} />
          {placements.map(({ placement, icon, tooltip }) => (
            <Icon
              key={placement}
              small
              material={icon}
              tooltip={tooltip}
              className={cssNames(styles.placement, { [styles.current]: chat.placement === placement })}
              data-testid={`ai-chat-place-${placement}`}
              onClick={() => command({ type: "move", chatId, placement })}
            />
          ))}
          <Button
            plain
            label="New chat"
            disabled={chat.running}
            data-testid="ai-chat-new"
            onClick={() => command({ type: "clear", chatId })}
          />
        </div>
        <div className={styles.toolbar}>
          <Select
            id={`ai-chat-provider-${chatId}`}
            themeName="lens"
            className={styles.select}
            isDisabled={chat.running}
            options={providerOptions}
            value={chat.provider}
            onChange={(option) => {
              const provider = aiProviderIds.find((id) => id === option?.value);

              if (provider) {
                command({
                  type: "settings",
                  chatId,
                  settings: {
                    provider,
                    model: preferences.providers[provider].defaultModel,
                    effort: preferences.providers[provider].defaultEffort,
                  },
                });
              }
            }}
          />
          <Select
            id={`ai-chat-model-${chatId}`}
            themeName="lens"
            className={styles.select}
            isCreatable
            isDisabled={chat.running}
            options={modelOptions(models, chat.model)}
            // A CLI that lists its own "default" model shows it for the default choice.
            value={chat.model || (models.some((candidate) => candidate.id === "default") ? "default" : defaultOption)}
            onChange={(option) =>
              command({
                type: "settings",
                chatId,
                settings: { model: option?.value === "default" ? defaultOption : (option?.value ?? defaultOption) },
              })
            }
          />
          <label className={styles.effort}>
            <span>Effort</span>
            <Select
              id={`ai-chat-effort-${chatId}`}
              themeName="lens"
              className={styles.select}
              isDisabled={chat.running || efforts.length === 0}
              options={[
                { value: defaultOption, label: "default" },
                ...efforts.map((effort) => ({ value: effort, label: effort })),
              ]}
              value={efforts.includes(chat.effort) ? chat.effort : defaultOption}
              onChange={(option) =>
                command({ type: "settings", chatId, settings: { effort: option?.value ?? defaultOption } })
              }
            />
          </label>
          <div
            className={cssNames(styles.allowChanges, { [styles.allowed]: chat.allowChanges })}
            data-testid="ai-chat-allow-changes"
          >
            <Checkbox
              label="🤡 Allow changes"
              value={chat.allowChanges}
              onChange={(allowChanges) => command({ type: "allow-changes", chatId, allowChanges })}
            />
          </div>
        </div>

        <div className={styles.messages} data-testid="ai-chat-messages">
          {chat.items.length === 0 && (
            <div className={styles.empty}>
              Ask about {chat.clusterName}, e.g. &quot;which pods are failing and why?&quot;. The assistant reads the
              cluster and drives the Freelens window
              {chat.allowChanges
                ? ", and may change the cluster."
                : ", and cannot change anything until you tick Allow changes."}
            </div>
          )}
          {chat.items.map((item) => (
            <ChatItemView
              key={item.id}
              item={item}
              decide={(itemId, approved) => command({ type: "approval", chatId, itemId, approved })}
            />
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
            <Button
              outlined
              label="Stop"
              data-testid="ai-chat-stop"
              onClick={() => command({ type: "stop", chatId })}
            />
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
    mirror: di.inject(aiChatMirrorInjectable),
    discovery: di.inject(aiDiscoveryMirrorInjectable),
    preferencesState: di.inject(userPreferencesStateInjectable),
  }),
});
