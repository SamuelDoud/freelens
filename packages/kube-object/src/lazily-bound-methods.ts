/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

// Binding every method of every instance in the constructor costs about 10 µs and
// 5 KB per object. Instead each method of a class becomes an accessor on its
// prototype that binds on first read through an instance and caches the bound
// function on that instance, so `const { getName } = pod; getName()` keeps working.

type AnyFunction = (...args: any[]) => unknown;

/** Maps the getter of an installed accessor to the method it stands for. */
const originalOfGetter = new WeakMap<AnyFunction, AnyFunction>();
const installedPrototypes = new WeakSet<object>();

const defineOwn = (target: object, key: PropertyKey, value: unknown, enumerable: boolean) => {
  try {
    Object.defineProperty(target, key, { value, writable: true, configurable: true, enumerable });
  } catch {
    // A frozen or sealed instance cannot cache the bound function: the caller still gets it.
  }
};

export function bindMethodsLazily(constructor: Function): void {
  const prototype = constructor.prototype as object;

  if (installedPrototypes.has(prototype)) {
    return;
  }

  installedPrototypes.add(prototype);

  const seen = new Set<PropertyKey>();

  // Walks the chain as auto-bind does: the most derived definition of a name wins.
  for (
    let current: object | null = prototype;
    current && current !== Object.prototype;
    current = Object.getPrototypeOf(current)
  ) {
    for (const key of Reflect.ownKeys(current)) {
      if (key === "constructor" || seen.has(key)) {
        continue;
      }

      seen.add(key);

      const descriptor = Reflect.getOwnPropertyDescriptor(current, key);
      const method =
        typeof descriptor?.value === "function"
          ? (descriptor.value as AnyFunction)
          : descriptor?.get
            ? originalOfGetter.get(descriptor.get as AnyFunction)
            : undefined;

      if (!method) {
        continue;
      }

      const getter = function (this: object) {
        // Reads through the prototype or through `super` must see the plain method. A read
        // without a receiver is how vi.spyOn inspects an accessor, and it needs the method.
        if (this == null || Object.getPrototypeOf(this) !== prototype) {
          return method;
        }

        const bound = method.bind(this);

        // Not enumerable, so copies (`Object.assign`, spread, `new Pod(otherPod)`) hold data only
        // and never carry a function bound to another instance.
        defineOwn(this, key, bound, false);

        return bound;
      };

      originalOfGetter.set(getter, method);

      Object.defineProperty(prototype, key, {
        configurable: true,
        enumerable: false,
        get: getter,
        set(this: object, value: unknown) {
          defineOwn(this, key, value, true);
        },
      });
    }
  }
}
