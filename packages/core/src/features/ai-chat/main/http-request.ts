/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

export type AiHttpResult =
  | { readonly ok: true; readonly status: number; readonly text: string }
  | { readonly ok: false; readonly error: string };

/** A request to an OpenAI-compatible server at a URL, stopped by the caller's signal or the timeout. */
export async function aiHttpRequest(url: string, init: RequestInit, timeoutMs: number): Promise<AiHttpResult> {
  const signals = [AbortSignal.timeout(timeoutMs), ...(init.signal ? [init.signal] : [])];

  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.any(signals) });

    return { ok: true, status: response.status, text: await response.text() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
