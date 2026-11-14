/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { AiHttpPostResult } from "../common/channels";

export async function aiHttpRequest(url: string, init: RequestInit, timeoutMs: number): Promise<AiHttpPostResult> {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });

    return { ok: true, status: response.status, text: await response.text() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
