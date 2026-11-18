/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, rename, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import watchInjectable, { macOsPollingInterval, watchOptionsFor } from "./watch.injectable";

import type { FSWatcher } from "chokidar";

// The file tests watch natively, as on Linux; the macOS block checks what macOS gets.
const watch = watchInjectable.instantiate({ inject: () => "linux" } as never);

const require = createRequire(import.meta.url);

describe("watch", () => {
  /**
   * On macOS libuv serves `fs.watch` of a file with kqueue, and aborts the process when it cannot
   * re-arm that watch (the file's volume ejected, or a network share gone stale). Watchers poll
   * there unless a caller asks for native watching by name. These pin what chokidar does with the
   * options macOS gets, in a process that says it is a Mac, as chokidar reads the platform when it
   * is loaded.
   */
  describe("on macOS", () => {
    const optionsOf = async (options: Record<string, unknown>) => {
      const script = `
        Object.defineProperty(process, "platform", { value: "darwin" });
        const { FSWatcher } = await import(${JSON.stringify(pathToFileURL(require.resolve("chokidar")).href)});
        const watcher = new FSWatcher(${JSON.stringify(options)});
        const { backend, usePolling, backendStrategy } = watcher.options;
        await watcher.close();
        console.log(JSON.stringify({ backend, usePolling, backendStrategy }));
      `;

      return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" }));
    };
    const polling = { backend: "polling", usePolling: true, backendStrategy: "polling" };

    it("polls a watcher whose caller does not choose, at the default interval", async () => {
      const options = watchOptionsFor("darwin", { ignoreInitial: false, depth: 1 });

      expect(options).toMatchObject({
        backend: "polling",
        pollingInterval: macOsPollingInterval,
        pollingBinaryInterval: macOsPollingInterval,
        depth: 1,
      });
      expect(await optionsOf(options as never)).toEqual(polling);
      expect(await optionsOf(watchOptionsFor("darwin", undefined) as never)).toEqual(polling);
    });

    it("polls a caller that asks for automatic watching, as the kubeconfig sync does", async () => {
      expect(await optionsOf(watchOptionsFor("darwin", { backend: "auto" }) as never)).toEqual(polling);
    });

    it("keeps the interval a caller gives", () => {
      expect(watchOptionsFor("darwin", { pollingInterval: 250 })).toMatchObject({
        backend: "polling",
        pollingInterval: 250,
      });
    });

    it("keeps native watching a caller asks for by name", () => {
      expect(watchOptionsFor("darwin", { backend: "native" })).toEqual({ backend: "native" });
    });

    it("leaves the options of other platforms as they are", () => {
      for (const platform of ["linux", "win32"]) {
        expect(watchOptionsFor(platform, { backend: "auto", depth: 1 })).toEqual({ backend: "auto", depth: 1 });
        expect(watchOptionsFor(platform, undefined)).toBeUndefined();
      }
    });
  });

  describe("with files", () => {
    let directory: string;
    let watchers: FSWatcher[];

    const watchFor = <T extends boolean>(paths: string | string[], options: Parameters<typeof watch<T>>[1]) => {
      const watcher = watch<T>(paths, options) as unknown as FSWatcher;

      watchers.push(watcher);

      return watcher;
    };

    beforeEach(async () => {
      directory = await mkdtemp(path.join(tmpdir(), "freelens-watch-"));
      watchers = [];
    });

    afterEach(async () => {
      await Promise.all(watchers.map((watcher) => watcher.close()));
      await rm(directory, { recursive: true, force: true });
    });

    const ready = (watcher: FSWatcher) => new Promise<void>((resolve) => watcher.once("ready", () => resolve()));

    it("reports a file of a folder being added, changed through an atomic write and removed", async () => {
      await writeFile(path.join(directory, "a.yaml"), "1");

      const events: string[] = [];
      const watcher = watchFor<true>(directory, {
        depth: 0,
        alwaysStat: true,
        ignorePermissionErrors: true,
        atomic: 150,
        awaitWriteFinish: { pollInterval: 20, stabilityThreshold: 100 },
      });

      for (const event of ["add", "change", "unlink"] as const) {
        (watcher as FSWatcher).on(event, (file) => events.push(`${event} ${path.basename(file)}`));
      }

      await ready(watcher);
      expect(events).toEqual(["add a.yaml"]);

      await writeFile(path.join(directory, "a.yaml.tmp"), "2");
      await rename(path.join(directory, "a.yaml.tmp"), path.join(directory, "a.yaml"));
      await vi.waitFor(() => expect(events).toContain("change a.yaml"));

      await writeFile(path.join(directory, "b.yaml"), "x");
      await vi.waitFor(() => expect(events).toContain("add b.yaml"));

      await rm(path.join(directory, "b.yaml"));
      await vi.waitFor(() => expect(events).toContain("unlink b.yaml"));

      // Not a child of the folder: depth 0.
      await mkdir(path.join(directory, "sub"));
      await writeFile(path.join(directory, "sub", "c.yaml"), "x");
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(events).not.toContain("add c.yaml");
    });

    it("reports a single file changed, replaced and removed", async () => {
      const config = path.join(directory, "config");

      await writeFile(config, "1");

      const events: string[] = [];
      const watcher = watchFor<true>(config, {
        depth: 1,
        alwaysStat: true,
        atomic: 150,
        awaitWriteFinish: { pollInterval: 20, stabilityThreshold: 100 },
      });

      for (const event of ["add", "change", "unlink"] as const) {
        (watcher as FSWatcher).on(event, () => events.push(event));
      }

      await ready(watcher);
      await writeFile(config, "22");
      await vi.waitFor(() => expect(events).toEqual(["add", "change"]));

      await rm(config);
      await vi.waitFor(() => expect(events).toEqual(["add", "change", "unlink"]));
    });

    it("cannot be reused once closed, so a new watch starts a new watcher", async () => {
      const watcher = watchFor<false>(directory, { depth: 0 });

      await ready(watcher);
      await watcher.close();

      expect(() => watcher.add(directory)).toThrow(/close/);

      const next = watchFor<false>(directory, { depth: 0, ignoreInitial: true });
      const added = vi.fn();

      next.on("add", added);
      await ready(next);
      await writeFile(path.join(directory, "x"), "1");
      await vi.waitFor(() => expect(added).toHaveBeenCalledTimes(1));
    });

    it("rejects options it cannot use, which chokidar 5 took without a word", () => {
      expect(() => watch(directory, { pollingInterval: 0 })).toThrow(/pollingInterval/);
      expect(() => watch(directory, { depth: -1 })).toThrow(/depth/);
      expect(() => watch(directory, { atomic: -5 })).toThrow(/atomic/);
      expect(() => watch(directory, { awaitWriteFinish: { pollInterval: 0 } })).toThrow(/pollInterval/);
    });
  });
});
