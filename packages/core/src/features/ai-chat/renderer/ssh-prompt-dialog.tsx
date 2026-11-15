/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { useState } from "react";
import { Input } from "../../../renderer/components/input";

import type { AiSshPrompt } from "../common/channels";

export const SshPromptMessage = ({ prompt, onChange }: { prompt: AiSshPrompt; onChange: (value: string) => void }) => {
  const [value, setValue] = useState("");

  return (
    <div className="flex flex-col gap-3" data-testid="ai-ssh-prompt">
      <b>{`Connecting to ${prompt.host} for the AI chat`}</b>
      <pre className="whitespace-pre-wrap" style={{ fontFamily: "inherit", margin: 0 }}>
        {prompt.text}
      </pre>
      {prompt.kind !== "confirm" && (
        <Input
          autoFocus
          type={prompt.kind === "secret" ? "password" : "text"}
          data-testid="ai-ssh-prompt-input"
          value={value}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      )}
    </div>
  );
};
