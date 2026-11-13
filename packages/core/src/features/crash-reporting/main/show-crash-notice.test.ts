/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { showCrashNoticeIfNeeded } from "./show-crash-notice";

import type { Mock } from "vitest";

import type { CrashNoticeDependencies } from "./show-crash-notice";

describe("showCrashNoticeIfNeeded", () => {
  let takePendingNotice: Mock<CrashNoticeDependencies["store"]["takePendingNotice"]>;
  let showMessagePopup: Mock<CrashNoticeDependencies["showMessagePopup"]>;
  let openLogsFolder: Mock<CrashNoticeDependencies["openLogsFolder"]>;

  const run = () =>
    showCrashNoticeIfNeeded({
      store: { takePendingNotice },
      showMessagePopup,
      openLogsFolder,
      logger: { error: vi.fn() },
    });

  beforeEach(() => {
    takePendingNotice = vi.fn();
    showMessagePopup = vi.fn(async () => ({ response: 1 }));
    openLogsFolder = vi.fn(async () => {});
  });

  it("shows nothing when the previous run ended cleanly", async () => {
    takePendingNotice.mockReturnValue(undefined);

    await run();

    expect(showMessagePopup).not.toHaveBeenCalled();
  });

  it("tells the user about the newest crash report", async () => {
    takePendingNotice.mockReturnValue({
      reportPaths: ["/logs/crashes/crash-old.txt", "/logs/crashes/crash-new.txt"],
      uncleanExit: true,
    });

    await run();

    expect(showMessagePopup).toHaveBeenCalledWith(
      "Freelens",
      "Freelens crashed during its previous run",
      expect.stringContaining("/logs/crashes/crash-new.txt"),
      expect.objectContaining({ buttons: ["Open Logs Folder", "Close"] }),
    );
    expect(openLogsFolder).not.toHaveBeenCalled();
  });

  it("opens the logs folder when the user asks for it", async () => {
    takePendingNotice.mockReturnValue({ reportPaths: ["/logs/crashes/crash-new.txt"], uncleanExit: true });
    showMessagePopup.mockResolvedValue({ response: 0 });

    await run();

    expect(openLogsFolder).toHaveBeenCalledTimes(1);
  });

  it("says the previous run did not close properly when there is no report", async () => {
    takePendingNotice.mockReturnValue({ reportPaths: [], uncleanExit: true });

    await run();

    expect(showMessagePopup).toHaveBeenCalledWith(
      "Freelens",
      "Freelens did not close properly last time",
      expect.any(String),
      expect.any(Object),
    );
  });
});
