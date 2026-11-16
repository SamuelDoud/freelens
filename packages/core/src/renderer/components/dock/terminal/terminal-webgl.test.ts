/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import EventEmitter from "node:events";
import { computed } from "mobx";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@freelensapp/logger";

import type { TerminalApi } from "../../../api/terminal-api";

const webglMock = vi.hoisted(() => {
  class FakeWebglAddon {
    static instances: FakeWebglAddon[] = [];
    static failToLoad = false;

    readonly contextLoss = new Set<() => void>();
    // xterm wraps `dispose` of a loaded addon, so it is counted rather than spied on.
    disposed = 0;
    readonly clearTextureAtlas = vi.fn();
    readonly onContextLoss = (listener: () => void) => {
      this.contextLoss.add(listener);

      return { dispose: () => this.contextLoss.delete(listener) };
    };

    constructor() {
      FakeWebglAddon.instances.push(this);
    }

    dispose() {
      this.disposed += 1;
    }

    activate() {
      if (FakeWebglAddon.failToLoad) {
        throw new Error("WebGL2 not supported");
      }
    }

    loseContext() {
      this.contextLoss.forEach((listener) => listener());
    }
  }

  return FakeWebglAddon;
});

vi.mock("@xterm/addon-webgl", () => ({ WebglAddon: webglMock }));

import { Terminal } from "./terminal";

describe("Terminal WebGL renderer", () => {
  let terminal: Terminal;
  let logger: { debug: () => void; info: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn>; error: () => void };
  let shown: HTMLElement;
  let fonts: EventTarget;

  beforeEach(() => {
    vi.useFakeTimers();
    webglMock.instances = [];
    webglMock.failToLoad = false;

    window.matchMedia ??= (() => ({
      matches: false,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;

    fonts = new EventTarget();
    Object.defineProperty(document, "fonts", { value: fonts, configurable: true });
    logger = { debug: () => {}, info: vi.fn(), warn: vi.fn(), error: () => {} };

    const spawningPool = document.createElement("div");

    shown = document.createElement("div");
    document.body.append(spawningPool, shown);

    terminal = new Terminal(
      {
        spawningPool,
        terminalConfig: computed(() => ({ fontSize: 12, fontFamily: "monospace" })),
        terminalCopyOnSelect: computed(() => false),
        terminalFonts: [],
        isMac: false,
        xtermColorTheme: computed(() => ({})),
        logger: logger as unknown as Logger,
        openLinkInBrowser: vi.fn(),
      },
      {
        tabId: "tab",
        api: Object.assign(new EventEmitter(), {
          isReady: false,
          sendTerminalSize: vi.fn(),
          sendMessage: vi.fn(),
        }) as unknown as TerminalApi,
      },
    );
  });

  afterEach(() => {
    terminal.destroy();
    vi.useRealTimers();
  });

  it("draws with WebGL only while the terminal is shown", () => {
    expect(webglMock.instances).toHaveLength(0);

    terminal.attachTo(shown);
    expect(webglMock.instances).toHaveLength(1);
    expect(webglMock.instances[0].disposed).toBe(0);

    terminal.detach();
    expect(webglMock.instances[0].disposed).toBe(1);

    terminal.attachTo(shown);
    expect(webglMock.instances).toHaveLength(2);
    expect(webglMock.instances[1].disposed).toBe(0);
  });

  it("keeps the DOM renderer where WebGL is not available, and does not ask again", () => {
    webglMock.failToLoad = true;

    expect(() => terminal.attachTo(shown)).not.toThrow();
    terminal.detach();
    terminal.attachTo(shown);

    expect(webglMock.instances).toHaveLength(1);
    expect(logger.info).toHaveBeenCalledOnce();
  });

  it("falls back to the DOM renderer when the context is lost, and tries WebGL again when shown again", () => {
    terminal.attachTo(shown);
    webglMock.instances[0].loseContext();

    expect(webglMock.instances[0].disposed).toBe(1);
    expect(logger.warn).toHaveBeenCalledOnce();

    // Nothing is left to dispose a second time when the terminal is hidden.
    terminal.detach();
    expect(webglMock.instances[0].disposed).toBe(1);

    terminal.attachTo(shown);
    expect(webglMock.instances).toHaveLength(2);
  });

  it("draws its glyphs again when a font finishes loading, only while shown", () => {
    terminal.attachTo(shown);
    fonts.dispatchEvent(new Event("loadingdone"));
    expect(webglMock.instances[0].clearTextureAtlas).toHaveBeenCalledOnce();

    terminal.detach();
    fonts.dispatchEvent(new Event("loadingdone"));
    expect(webglMock.instances[0].clearTextureAtlas).toHaveBeenCalledOnce();
  });

  it("releases the context when destroyed", () => {
    terminal.attachTo(shown);
    terminal.destroy();

    expect(webglMock.instances[0].disposed).toBe(1);
  });
});
