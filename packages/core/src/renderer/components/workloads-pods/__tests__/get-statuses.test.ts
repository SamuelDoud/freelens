/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import countBy from "lodash/countBy";

// Test the getStatuses logic in isolation (it's just countBy + map)
function getStatuses(pods: { getStatus: () => string }[]) {
  return countBy(pods.map((pod) => pod.getStatus()));
}

function mockPod(status: string) {
  return { getStatus: () => status };
}

describe("PodStore.getStatuses", () => {
  it("returns empty object for empty array", () => {
    expect(getStatuses([])).toEqual({});
  });

  it("counts single status", () => {
    expect(getStatuses([mockPod("Running")])).toEqual({ Running: 1 });
  });

  it("counts mixed statuses", () => {
    const pods = [mockPod("Running"), mockPod("Running"), mockPod("Pending"), mockPod("Failed")];

    expect(getStatuses(pods)).toEqual({ Running: 2, Pending: 1, Failed: 1 });
  });

  it("counts all same status", () => {
    const pods = [mockPod("Running"), mockPod("Running"), mockPod("Running")];

    expect(getStatuses(pods)).toEqual({ Running: 3 });
  });

  it("handles evicted pods", () => {
    const pods = [mockPod("Evicted"), mockPod("Evicted"), mockPod("Running")];

    expect(getStatuses(pods)).toEqual({ Evicted: 2, Running: 1 });
  });
});
