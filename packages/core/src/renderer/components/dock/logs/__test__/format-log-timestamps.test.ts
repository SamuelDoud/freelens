/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { formatInTimeZone } from "@freelensapp/utilities";
import { describe, expect, it, vi } from "vitest";
import { LogTimestampFormatter } from "../format-log-timestamps";

type Split = [string, string];

function split(line: string): Split {
  const extraction = /^(\d+\S+)(.*)/m.exec(line);

  return extraction ? [extraction[1], extraction[2]] : ["", line];
}

// What the list did before the formatting was kept: every line, every time.
function formatAll(lines: string[], timezone: string): string[] {
  return lines.map(split).map(([timestamp, text]) => `${timestamp && formatInTimeZone(timestamp, timezone)}${text}`);
}

function format(formatter: LogTimestampFormatter, lines: string[], timezone: string): string[] {
  const splitLines = lines.map(split);

  return formatter.format(lines, () => splitLines, timezone);
}

const zones = ["UTC", "Asia/Kolkata", "America/New_York", "Europe/Berlin", "Pacific/Chatham"];

function buildLines(start: number, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    // Several lines in every second, nanoseconds, and the days around the
    // changes of the clock of 2026 in New York and Berlin.
    const time = start + Math.floor(index / 3) * 1000 + (index % 3) * 100;
    const iso = new Date(time).toISOString().replace("Z", "");

    return `${iso}${String(index % 1000).padStart(6, "0")}Z message ${index % 5}`;
  });
}

describe("LogTimestampFormatter", () => {
  it.each(zones)("formats like formatInTimeZone in %s, around the changes of the clock", (timezone) => {
    const starts = [
      Date.UTC(2026, 2, 8, 6, 59, 58),
      Date.UTC(2026, 9, 25, 0, 59, 58),
      Date.UTC(2026, 10, 1, 5, 59, 58),
    ];

    for (const start of starts) {
      const lines = [...buildLines(start, 600), "continuation without a timestamp", ""];

      expect(format(new LogTimestampFormatter(), lines, timezone)).toEqual(formatAll(lines, timezone));
    }
  });

  it("equals the full formatting while the log gains lines at the bottom and loses them at the top", () => {
    const formatter = new LogTimestampFormatter();
    let lines = buildLines(Date.UTC(2026, 2, 8, 6, 0, 0), 200);

    for (let poll = 0; poll < 20; poll += 1) {
      const next = buildLines(Date.UTC(2026, 2, 8, 6, 0, 0), 200 + (poll + 1) * 7).slice((poll + 1) * 3);

      lines = next;
      expect(format(formatter, lines, "Europe/Berlin")).toEqual(formatAll(lines, "Europe/Berlin"));
    }
  });

  it("formats the lines again in another time zone", () => {
    const formatter = new LogTimestampFormatter();
    const lines = buildLines(Date.UTC(2026, 0, 1), 12);
    const splitLines = lines.map(split);

    expect(formatter.format(lines, () => splitLines, "UTC")).toEqual(formatAll(lines, "UTC"));
    expect(formatter.format(lines, () => splitLines, "Asia/Kolkata")).toEqual(formatAll(lines, "Asia/Kolkata"));
  });

  it("does not ask for the split lines again for the same log", () => {
    const formatter = new LogTimestampFormatter();
    const lines = buildLines(Date.UTC(2026, 0, 1), 5);
    const getSplitLines = vi.fn(() => lines.map(split));

    const first = formatter.format(lines, getSplitLines, "UTC");

    expect(formatter.format(lines, getSplitLines, "UTC")).toBe(first);
    expect(getSplitLines).toHaveBeenCalledTimes(1);
  });

  it("throws the error of formatInTimeZone for a timestamp that does not parse", () => {
    const lines = ["2026-01-01T00:00:00.000000000Z fine", "2026-99-99T99:99:99Z broken"];

    expect(() => formatAll(lines, "UTC")).toThrow(RangeError);
    expect(() => format(new LogTimestampFormatter(), lines, "UTC")).toThrow(RangeError);
  });
});
