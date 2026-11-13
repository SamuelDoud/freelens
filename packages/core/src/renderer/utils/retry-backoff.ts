/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export interface RetryBackoffOptions {
  /** Wait after the first failure, doubled by each further failure. */
  initialDelayMs?: number;
  /** Longest wait between attempts. */
  maxDelayMs?: number;
}

/**
 * Spaces out the attempts of a polled request that keeps failing, such as a
 * metrics API whose backend is down: after a failure the next attempt waits
 * `initialDelayMs`, doubling with each further failure up to `maxDelayMs`.
 * A success resets it.
 */
export class RetryBackoff {
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private failures = 0;
  private nextAttemptAt = 0;

  constructor({ initialDelayMs = 10_000, maxDelayMs = 300_000 }: RetryBackoffOptions = {}) {
    this.initialDelayMs = initialDelayMs;
    this.maxDelayMs = maxDelayMs;
  }

  canAttempt(): boolean {
    return Date.now() >= this.nextAttemptAt;
  }

  succeeded(): void {
    this.failures = 0;
    this.nextAttemptAt = 0;
  }

  failed(): void {
    const delay = Math.min(this.initialDelayMs * 2 ** this.failures, this.maxDelayMs);

    this.failures += 1;
    this.nextAttemptAt = Date.now() + delay;
  }
}
