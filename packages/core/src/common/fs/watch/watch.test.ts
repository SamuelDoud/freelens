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
import watchInjectable from "./watch.injectable";

import type { FSWatcher } from "chokidar";

const watch = watchInjectable.instantiate(undefined as never);

const require = createRequire(import.meta.url);

describe("watch", () => {
  /**
   * On macOS a file is watched with a kqueue watch, which libuv aborts the process on when it
   * cannot re-arm it, and a directory with FSEvents. Chokidar 6 watches directories and, for a
   * file, its directory, so nothing polls there; these pin what it picks for the options the
   * application passes.
   */
  describe("on macOS", () => {
    // Chokidar reads the platform when it is loaded, so it is loaded in a process that says it is a Mac.
    const optionsOf = async (options: Record<string, unknown>) => {
      const script = `
        Object.defineProperty(process, "platform", { value: "darwin" });
        const { FSWatcher } = await import(${JSON.stringify(pathToFileURL(require.resolve("chokidar")).href)});
        const watcher = new FSWatcher(${JSON.stringify(options)});
        const { backend, usePolling, backendStrategy, atomic } = watcher.options;
        await watcher.close();
        console.log(JSON.stringify({ backend, usePolling, backendStrategy, atomic }));
      `;

      return JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8" }));
    };

    it("does not poll, and watches a directory tree with one recursive watch", async () => {
      expect(await optionsOf({ ignoreInitial: false, atomic: 150, awaitWriteFinish: { pollInterval: 100 } })).toEqual({
        backend: "auto",
        usePolling: false,
        backendStrategy: "native-recursive-preferred",
        atomic: 150,
      });
    });

    it("watches a limited depth with one watch per directory, not per file", async () => {
      for (const depth of [0, 1, 3]) {
        expect(await optionsOf({ depth })).toEqual({
          backend: "auto",
          usePolling: false,
          backendStrategy: "native-per-directory",
          atomic: true,
        });
      }
    });

    it("polls when a caller asks for it, as for a share that sends no change notifications", async () => {
      expect(await optionsOf({ backend: "polling", pollingInterval: 250 })).toEqual({
        backend: "polling",
        usePolling: true,
        backendStrategy: "polling",
        atomic: false,
      });
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
