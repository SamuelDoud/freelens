/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { createContainer, getInjectable } from "@ogre-tools/injectable";
import { DiContextProvider, withInjectables } from "@ogre-tools/injectable-react";
import { act, render } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import type { DiContainer } from "@ogre-tools/injectable";

// The behaviour of withInjectables before the pnpm patch, kept as a reference.
const oldWithInjectables = (
  di: DiContainer,
  Component: React.ComponentType<any>,
  { getPlaceholder = () => null, getProps }: { getPlaceholder?: (p: any) => any; getProps: (di: any, p: any) => any },
) => {
  const Inner = ({ nonDependencyProps, refProp }: { nonDependencyProps: any; refProp: any }) => {
    const l = React.useMemo(() => ({ ...di, inject: (t: any, ...r: any[]) => (di as any).inject(t, ...r) }), []);
    const [s, set] = React.useState<any>();

    React.useLayoutEffect(() => {
      const result = getProps(l, nonDependencyProps);

      if (result && typeof result.then === "function") result.then(set);
      else set(result);
    }, [nonDependencyProps]);

    return s ? <Component {...s} {...(refProp ? { ref: refProp } : {})} /> : getPlaceholder(nonDependencyProps);
  };

  return React.forwardRef<any, any>((props, ref) => <Inner nonDependencyProps={props} refProp={ref} />);
};

const valueInjectable = getInjectable({ id: "value", instantiate: () => "injected" });

type Log = { props: any }[];

const setup = (variant: "old" | "new", log: Log, getProps: any, getPlaceholder?: any) => {
  const di = createContainer("test");

  di.register(valueInjectable);

  const Component = ({ label, value }: { label: string; value: string }) => {
    log.push({ props: { label, value } });

    return <div data-testid="out">{`${label}:${value}`}</div>;
  };
  const Wrapped =
    variant === "old"
      ? oldWithInjectables(di, Component, { getProps, getPlaceholder })
      : (withInjectables as any)(Component, { getProps, getPlaceholder });
  const ui = (label: string) => (
    <DiContextProvider value={di as any}>
      <Wrapped label={label} />
    </DiContextProvider>
  );

  return { ui };
};

const syncGetProps = (di: any, props: any) => ({ ...props, value: di.inject(valueInjectable) });

describe("withInjectables patched to render once", () => {
  it("renders the component once on mount and once per update, always with the right props", () => {
    const log: Log = [];
    const { ui } = setup("new", log, syncGetProps);
    const r = render(ui("a"));

    expect(r.getByTestId("out").textContent).toBe("a:injected");
    expect(log).toEqual([{ props: { label: "a", value: "injected" } }]);

    r.rerender(ui("b"));
    expect(r.getByTestId("out").textContent).toBe("b:injected");
    expect(log.length).toBe(2);
    expect(log[1]).toEqual({ props: { label: "b", value: "injected" } });
  });

  it("the old implementation renders twice, which is what the patch removes", () => {
    const log: Log = [];
    const { ui } = setup("old", log, syncGetProps);
    const r = render(ui("a"));

    r.rerender(ui("b"));
    // mount: placeholder then component; update: stale props then new props
    expect(log.map((l) => l.props.label)).toEqual(["a", "a", "b"]);
  });

  it("ends in the same DOM as the old implementation for sync and async getProps", async () => {
    for (const mode of ["sync", "async"] as const) {
      const out: Record<string, string[]> = { old: [], new: [] };

      for (const variant of ["old", "new"] as const) {
        const getProps =
          mode === "sync"
            ? syncGetProps
            : async (di: any, props: any) => ({ ...props, value: di.inject(valueInjectable) });
        const { ui } = setup(variant, [], getProps, () => <span data-testid="out">placeholder</span>);
        const r = render(ui("a"));

        out[variant].push(r.getByTestId("out").textContent ?? "");
        await act(async () => {});
        out[variant].push(r.getByTestId("out").textContent ?? "");
        r.rerender(ui("b"));
        await act(async () => {});
        out[variant].push(r.getByTestId("out").textContent ?? "");
        r.unmount();
      }

      expect(out.new[out.new.length - 1]).toBe("b:injected");
      expect(out.new[1]).toBe(out.old[1]);
      expect(out.new[2]).toBe(out.old[2]);
    }
  });

  it("async getProps shows the placeholder until the promise resolves", async () => {
    let resolve: (v: any) => void = () => {};
    const getProps = () => new Promise((r) => (resolve = r));
    const { ui } = setup("new", [], getProps, () => <span data-testid="out">placeholder</span>);
    const r = render(ui("a"));

    expect(r.getByTestId("out").textContent).toBe("placeholder");
    await act(async () => resolve({ label: "x", value: "y" }));
    expect(r.getByTestId("out").textContent).toBe("x:y");
  });

  it("an error in getProps reaches an error boundary like before", () => {
    class Boundary extends React.Component<{ children: any }, { error?: Error }> {
      state: { error?: Error } = {};
      static getDerivedStateFromError(error: Error) {
        return { error };
      }
      render() {
        return this.state.error ? <i data-testid="err">{this.state.error.message}</i> : this.props.children;
      }
    }

    for (const variant of ["old", "new"] as const) {
      const { ui } = setup(variant, [], () => {
        throw new Error("boom");
      });
      const spy = console.error;

      console.error = () => {};
      const r = render(<Boundary>{ui("a")}</Boundary>);

      console.error = spy;
      expect(r.getByTestId("err").textContent).toBe("boom");
      r.unmount();
    }
  });

  it("forwards refs", () => {
    const di = createContainer("t");
    const Comp = React.forwardRef<HTMLDivElement, any>((_p, ref) => <div ref={ref} data-testid="x" />);
    const W = (withInjectables as any)(Comp, { getProps: (_d: any, p: any) => p });
    const ref = React.createRef<HTMLDivElement>();
    const r = render(
      <DiContextProvider value={di as any}>
        <W ref={ref} />
      </DiContextProvider>,
    );

    expect(ref.current).toBe(r.getByTestId("x"));
  });
});
