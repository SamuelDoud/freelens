/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { getInjectable } from "@ogre-tools/injectable";
import freelensProxyPortInjectable from "../../../main/freelens-proxy/freelens-proxy-port.injectable";
import createElectronWindowInjectable from "../../../main/start-main-application/lens-window/application-window/create-electron-window.injectable";

import type { ElectronWindow } from "../../../main/start-main-application/lens-window/application-window/create-lens-window.injectable";

export interface AiChatWindow {
  open: (chatId: string, title: string, onClosedByUser: (chatId: string) => void) => void;
  close: (chatId: string) => void;
}

/**
 * The window a chat pops out into: one at a time, keeping its size and position (by the window id)
 * across chats and restarts. It loads the renderer with the chat's id, which then shows only that chat.
 */
const aiChatWindowInjectable = getInjectable({
  id: "ai-chat-window",
  instantiate: (di): AiChatWindow => {
    const createElectronWindow = di.inject(createElectronWindowInjectable);
    const freelensProxyPort = di.inject(freelensProxyPortInjectable);
    let current: { chatId: string; window: ElectronWindow; closingOnPurpose: boolean } | undefined;

    const close = (chatId: string) => {
      if (current?.chatId === chatId) {
        current.closingOnPurpose = true;
        current.window.close();
        current = undefined;
      }
    };

    return {
      open: (chatId, title, onClosedByUser) => {
        if (current) {
          close(current.chatId);
        }

        const entry = { chatId, closingOnPurpose: false } as {
          chatId: string;
          window: ElectronWindow;
          closingOnPurpose: boolean;
        };

        entry.window = createElectronWindow({
          id: "ai-chat-window",
          title,
          defaultWidth: 520,
          defaultHeight: 760,
          getContentSource: () => ({ url: "" }),
          resizable: true,
          windowFrameUtilitiesAreShown: true,
          titleBarStyle: "default",
          centered: false,
          onClose: () => {
            if (current === entry) {
              current = undefined;
            }

            if (!entry.closingOnPurpose) {
              onClosedByUser(chatId);
            }
          },
        });
        current = entry;

        const url = `https://renderer.freelens.app:${freelensProxyPort.get()}/?ai-chat-window=${encodeURIComponent(chatId)}`;

        void entry.window.loadUrl(url).then(() => entry.window.show());
      },
      close,
    };
  },
});

export default aiChatWindowInjectable;
