/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observableHistoryInjectionToken } from "@freelensapp/routing";
import { observable, runInAction } from "mobx";
import { describe, expect, it } from "vitest";
import generalCategoryInjectable from "../../../common/catalog/categories/general.injectable";
import isActiveRouteInjectable from "../../navigation/is-route-active.injectable";
import catalogEntityRegistryInjectable from "../catalog/entity/registry.injectable";
import watchForGeneralEntityNavigationInjectable from "./watch-for-general-entity-navigation.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";

const entity = (id: string, path?: string) => ({ getId: () => id, spec: { path } });

describe("watching navigation to general entities", () => {
  const setup = () => {
    const history = observable({ location: { pathname: "/multiview/m1" } }, {}, { deep: false });
    const multiview = entity("multiview-m1", "/multiview/m1");
    const cluster = entity("cluster-1");
    const registry = observable(
      {
        entities: new Map([[multiview.getId(), multiview]]),
        activeEntity: undefined as unknown,
        getItemsForCategory: () => [multiview],
      },
      {},
      { deep: false },
    );
    const di = {
      inject: (injectable: unknown) =>
        injectable === observableHistoryInjectionToken
          ? history
          : injectable === isActiveRouteInjectable
            ? (path: string) => history.location.pathname === path
            : injectable === catalogEntityRegistryInjectable
              ? registry
              : injectable === generalCategoryInjectable
                ? {}
                : undefined,
    } as unknown as DiContainerForInjection;
    const dispose = watchForGeneralEntityNavigationInjectable.instantiate(di as never)();

    return {
      registry,
      cluster,
      navigate: (pathname: string) => runInAction(() => (history.location = { pathname })),
      dispose,
    };
  };

  it("clears the active entity on leaving the page of a general entity", () => {
    const { registry, navigate, dispose } = setup();

    expect((registry.activeEntity as { getId: () => string }).getId()).toBe("multiview-m1");

    navigate("/catalog");

    expect(registry.activeEntity).toBeUndefined();
    dispose();
  });

  it("keeps another entity that became active in the meantime", () => {
    const { registry, cluster, navigate, dispose } = setup();

    runInAction(() => (registry.activeEntity = cluster));
    navigate("/cluster/1");

    expect(registry.activeEntity).toBe(cluster);
    dispose();
  });
});
