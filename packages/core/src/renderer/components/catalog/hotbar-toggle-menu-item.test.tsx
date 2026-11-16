/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { act, screen } from "@testing-library/react";
import { computed, observable } from "mobx";
import { describe, expect, it } from "vitest";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import { renderFor } from "../test-utils/renderFor";
import { NonInjectedHotbarToggleMenuItem } from "./hotbar-toggle-menu-item";

import type { Hotbar } from "../../../features/hotbar/storage/common/hotbar";
import type { CatalogEntity } from "../../api/catalog-entity";

describe("hotbar toggle menu item", () => {
  it("follows the hotbar when the entity is added to it elsewhere", () => {
    const ids = observable.set<string>();
    const hotbar = { hasEntity: (id: string) => ids.has(id) } as unknown as Hotbar;
    const render = renderFor(getDiForUnitTesting());

    render(
      <ul>
        <NonInjectedHotbarToggleMenuItem
          entity={{ getId: () => "e1" } as unknown as CatalogEntity}
          activeHotbar={computed(() => hotbar)}
          addContent="Add"
          removeContent="Remove"
        />
      </ul>,
    );

    expect(screen.getByText("Add")).toBeTruthy();

    act(() => {
      ids.add("e1");
    });

    expect(screen.getByText("Remove")).toBeTruthy();
  });
});
