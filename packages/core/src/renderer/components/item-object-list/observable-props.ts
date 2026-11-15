/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { createAtom, transaction } from "mobx";

import type { IAtom } from "mobx";

export interface ObservableProps<P extends object> {
  /** The latest props. Reading a prop in a derivation tracks that prop alone. */
  readonly current: Readonly<P>;
  /** Takes the props of an update; only the props whose value changed notify their readers. */
  update(next: Readonly<P>): void;
}

/**
 * A snapshot of a component's props that derivations can read. mobx-react forbids reading
 * `this.props` in a derivation, and one observable reference for the whole object makes every
 * reader re-run on every update. Here each prop has an atom of its own, reported changed only
 * when its value is a different one, so a derivation re-runs for the props it actually read.
 */
export function createObservableProps<P extends object>(initial: Readonly<P>): ObservableProps<P> {
  let latest: Readonly<P> = initial;
  const atoms = new Map<PropertyKey, IAtom>();

  const atomOf = (key: PropertyKey) => {
    let atom = atoms.get(key);

    if (!atom) {
      atom = createAtom(`prop ${String(key)}`);
      atoms.set(key, atom);
    }

    return atom;
  };

  const current = new Proxy({} as P, {
    get: (_target, key) => {
      atomOf(key).reportObserved();

      return Reflect.get(latest, key);
    },
    has: (_target, key) => {
      atomOf(key).reportObserved();

      return Reflect.has(latest, key);
    },
  });

  return {
    current,
    update: (next) => {
      const previous = latest;

      latest = next;

      transaction(() => {
        for (const [key, atom] of atoms) {
          if (!Object.is(Reflect.get(previous, key), Reflect.get(next, key))) {
            atom.reportChanged();
          }
        }
      });
    },
  };
}
