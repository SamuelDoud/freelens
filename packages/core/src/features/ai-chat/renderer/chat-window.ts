/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * The id of the chat this renderer shows on its own, when it runs in a chat's window (the main
 * process opens it with `?ai-chat-window=<chat id>`), and undefined in the application window.
 */
export function chatWindowChatId(): string | undefined {
  // A cluster's frame is an iframe of the window: only the window's own frame is the chat's.
  if (typeof location === "undefined" || window.top !== window.self) {
    return undefined;
  }

  return new URLSearchParams(location.search).get("ai-chat-window") ?? undefined;
}
