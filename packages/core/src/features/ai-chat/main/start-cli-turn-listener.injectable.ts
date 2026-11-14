/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { startAiCliTurnChannel } from "../common/channels";
import aiCliTurnsInjectable from "./cli-turns.injectable";

const startAiCliTurnListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-start-cli-turn-listener",
  channel: startAiCliTurnChannel,
  getHandler: (di) => {
    const turns = di.inject(aiCliTurnsInjectable);

    return (turn) => turns.start(turn);
  },
});

export default startAiCliTurnListenerInjectable;
