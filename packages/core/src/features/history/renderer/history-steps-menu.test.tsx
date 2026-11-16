/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { act, fireEvent, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderFor } from "../../../renderer/components/test-utils/renderFor";
import { getDiForUnitTesting } from "../../../renderer/getDiForUnitTesting";
import { Timeline } from "../common/timeline";
import { NonInjectedHistoryStepsMenu } from "./history-steps-menu";

import type { HistoryController } from "./history-controller.injectable";

describe("history steps menu", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  const setup = () => {
    const render = renderFor(getDiForUnitTesting());
    const timeline = new Timeline();

    timeline.record({ rootPath: "/welcome" });
    timeline.record({ rootPath: "/catalog" });

    const goBack = vi.fn();

    render(
      <NonInjectedHistoryStepsMenu
        direction={-1}
        timeline={timeline}
        controller={{ go: vi.fn() } as unknown as HistoryController}
        clusterName={() => undefined}
      >
        <button type="button" data-testid="back" onClick={goBack}>
          back
        </button>
      </NonInjectedHistoryStepsMenu>,
    );

    return { goBack, button: screen.getByTestId("back") };
  };

  it("does not take a step when the release of a long press follows the menu opening", () => {
    const { goBack, button } = setup();

    fireEvent.mouseDown(button, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    fireEvent.mouseUp(button, { button: 0 });
    fireEvent.click(button);

    expect(goBack).not.toHaveBeenCalled();
  });

  it("takes a step for a short click", () => {
    const { goBack, button } = setup();

    fireEvent.mouseDown(button, { button: 0 });
    fireEvent.mouseUp(button, { button: 0 });
    fireEvent.click(button);

    expect(goBack).toHaveBeenCalledTimes(1);
  });
});
