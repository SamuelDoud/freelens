/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getRequestChannelListenerInjectable } from "@freelensapp/messaging";
import { stopAiCliTurnChannel } from "../common/channels";
import aiCliTurnsInjectable from "./cli-turns.injectable";

const stopAiCliTurnListenerInjectable = getRequestChannelListenerInjectable({
  id: "ai-chat-stop-cli-turn-listener",
  channel: stopAiCliTurnChannel,
  getHandler: (di) => {
    const turns = di.inject(aiCliTurnsInjectable);

    return ({ chatId }) => turns.stop(chatId);
  },
});

export default stopAiCliTurnListenerInjectable;
