/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { formatInTimeZone } from "@freelensapp/utilities";
import { mapLinesIncremental } from "./map-lines-incremental";

import type { MappedLines } from "./map-lines-incremental";

type SplitLine = readonly [timestamp: string, text: string];

/**
 * Formats a timestamp in a time zone. The text has a whole second as its
 * finest part, so the lines of one second, which follow one another in a log,
 * share one formatting. A timestamp that does not parse goes to
 * `formatInTimeZone` as it is, which throws as it always has.
 */
function createTimestampFormatter(timezone: string): (timestamp: string) => string {
  let lastSecond = Number.NaN;
  let lastFormatted = "";

  return (timestamp) => {
    const milliseconds = Date.parse(timestamp);

    if (Number.isNaN(milliseconds)) {
      return formatInTimeZone(timestamp, timezone);
    }

    const second = Math.floor(milliseconds / 1000);

    if (second !== lastSecond) {
      lastFormatted = formatInTimeZone(timestamp, timezone);
      lastSecond = second;
    }

    return lastFormatted;
  };
}

/**
 * The lines of a log with their timestamps in a time zone, kept between calls:
 * the lines that the log kept since the last call are not formatted again, and
 * neither is the same log read again, which a list does for every row.
 */
export class LogTimestampFormatter {
  private last:
    | {
        source: readonly string[];
        timezone: string;
        mapped: MappedLines<SplitLine, string>;
      }
    | undefined;

  /**
   * @param source The lines of the log. Equal arrays stand for equal logs.
   * @param getSplitLines The same lines as timestamp and text, asked for only
   * when the source is not the one of the last call
   */
  format(source: readonly string[], getSplitLines: () => readonly SplitLine[], timezone: string): string[] {
    if (this.last?.source === source && this.last.timezone === timezone) {
      return this.last.mapped.output;
    }

    const formatTimestamp = createTimestampFormatter(timezone);
    // The lines kept were formatted in the time zone they were mapped with.
    const previous = this.last?.timezone === timezone ? this.last.mapped : undefined;
    const mapped = mapLinesIncremental(
      previous,
      getSplitLines(),
      ([timestamp, text]) => `${timestamp && formatTimestamp(timestamp)}${text}`,
    );

    this.last = { source, timezone, mapped };

    return mapped.output;
  }
}
