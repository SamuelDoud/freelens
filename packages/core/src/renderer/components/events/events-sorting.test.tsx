/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DiContextProvider } from "@ogre-tools/injectable-react";
import { render } from "@testing-library/react";
import { observable, runInAction } from "mobx";
import { beforeEach, describe, expect, it, vi } from "vitest";
import navigateToEventsInjectable from "../../../common/front-end-routing/routes/cluster/events/navigate-to-events.injectable";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import { getDiForUnitTesting } from "../../getDiForUnitTesting";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { Events } from "./events";
import eventStoreInjectable from "./store.injectable";

import type { KubeEvent } from "@freelensapp/kube-object";

const layout = vi.hoisted(() => ({ props: undefined as any }));

vi.mock("../kube-object-list-layout", () => ({
  KubeObjectListLayout: (props: any) => {
    layout.props = props;

    return null;
  },
}));

vi.mock("../layout/tab-layout-2", () => ({ TabLayout: ({ children }: any) => children }));

type FakeEvent = { id: string; ns: string; count: number; created: number };

const makeEvent = (id: string, count: number, created = 0, ns = "default"): FakeEvent => ({ id, ns, count, created });

const asKubeEvent = (event: FakeEvent) =>
  ({
    getNs: () => event.ns,
    type: "Normal",
    involvedObject: { name: event.id },
    getCount: () => event.count,
    getCreationTimestamp: () => event.created,
    lastTimestamp: undefined,
  }) as unknown as KubeEvent;

describe("<Events> sorting", () => {
  let renderEvents: (props?: Record<string, unknown>) => void;
  let items: ReturnType<typeof observable.box<KubeEvent[]>>;

  beforeEach(() => {
    const di = getDiForUnitTesting();

    items = observable.box<KubeEvent[]>([], { deep: false });

    di.override(navigateToEventsInjectable, () => () => {});
    di.override(apiManagerInjectable, () => ({}) as never);
    di.override(getDetailsUrlInjectable, () => (() => "") as never);
    di.override(eventStoreInjectable, () => {
      return {
        limit: 1000,
        get contextItems() {
          return items.get();
        },
      } as never;
    });

    renderEvents = (props = {}) => {
      render(
        <DiContextProvider value={di}>
          <Events {...props} />
        </DiContextProvider>,
      );
    };
  });

  const ids = (list: KubeEvent[]) => list.map((event) => event.involvedObject.name);

  it("lists events by age, newest first, keeping the order of equal ones", () => {
    runInAction(() =>
      items.set(
        [
          makeEvent("a", 1, 10),
          makeEvent("b", 1, 30),
          makeEvent("c", 1, 30),
          makeEvent("d", 1, 20),
          makeEvent("e", 1, 10),
        ].map(asKubeEvent),
      ),
    );

    renderEvents();

    expect(ids(layout.props.getItems())).toEqual(["b", "c", "d", "a", "e"]);
  });

  it("slices the sorted list in compact mode and tells the header about both", () => {
    runInAction(() =>
      items.set([makeEvent("a", 1, 10), makeEvent("b", 1, 30), makeEvent("c", 1, 20)].map(asKubeEvent)),
    );

    renderEvents({ compact: true, compactLimit: 2 });

    expect(ids(layout.props.getItems())).toEqual(["b", "c"]);

    const header = layout.props.customizeHeader({ title: "Events" });

    expect(header.info).toBeTruthy();
  });

  it("sorts again when the sorting changes", () => {
    runInAction(() =>
      items.set([makeEvent("a", 3, 10), makeEvent("b", 1, 30), makeEvent("c", 2, 20)].map(asKubeEvent)),
    );

    renderEvents();
    layout.props.tableProps.onSort({ sortBy: "count", orderBy: "desc" });

    expect(ids(layout.props.getItems())).toEqual(["a", "c", "b"]);
  });

  it("returns an empty list for no events", () => {
    renderEvents();

    expect(layout.props.getItems()).toEqual([]);
  });

  it("sorts again when the events change", () => {
    renderEvents();

    runInAction(() => items.set([makeEvent("a", 1, 10), makeEvent("b", 1, 30)].map(asKubeEvent)));

    expect(ids(layout.props.getItems())).toEqual(["b", "a"]);
  });
});
