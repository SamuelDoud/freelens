/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { describe, expect, it } from "vitest";
import { sortEvents } from "./kube-event-details";

import type { KubeEvent } from "@freelensapp/kube-object";

const eventAt = (lastTimestamp: string) => ({ lastTimestamp }) as KubeEvent;

describe("sortEvents", () => {
  it("sorts newest first without mutating the given array", () => {
    // The events come from EventStore's @computed eventsByObjectId buckets:
    // sorting in place would mutate the cached computed value.
    const oldest = eventAt("2026-01-01T00:00:00Z");
    const newest = eventAt("2026-01-03T00:00:00Z");
    const middle = eventAt("2026-01-02T00:00:00Z");
    const events = [oldest, newest, middle];

    expect(sortEvents(events)).toEqual([newest, middle, oldest]);
    expect(events).toEqual([oldest, newest, middle]);
  });
});
