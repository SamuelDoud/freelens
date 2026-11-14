/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./definition-hover.module.scss";
import { findDefinitionTarget } from "./find-definition-target";
import getResourceDefinitionInjectable from "./get-definition.injectable";

import type { ResourceDefinition } from "../common/definitions";
import type { GetResourceDefinition } from "./get-definition.injectable";

interface Dependencies {
  getDefinition: GetResourceDefinition;
}

interface Shown {
  title: string;
  definition: ResourceDefinition;
  left: number;
  top: number;
}

const width = 340;
const gap = 8;

/** Where the definition goes: right of the element, or under it when the window is too narrow there. */
const placeBeside = (anchor: Element) => {
  const rect = anchor.getBoundingClientRect();
  const viewWidth = anchor.ownerDocument.defaultView?.innerWidth ?? Number.POSITIVE_INFINITY;

  if (rect.right + gap + width <= viewWidth) {
    return { left: rect.right + gap, top: rect.top };
  }

  return { left: Math.max(gap, Math.min(rect.left, viewWidth - width - gap)), top: rect.bottom + gap };
};

/**
 * Shows what a resource type is while Option (macOS) or Alt is held over its sidebar item, its tab
 * or the title of its list. The key is read from the pointer's own events, so it works whichever
 * frame has the keyboard focus.
 */
const NonInjectedDefinitionHover = ({ getDefinition }: Dependencies) => {
  const [shown, setShown] = useState<Shown | undefined>();

  useEffect(() => {
    let pointedAt: Element | null = null;

    const update = (altKey: boolean) => {
      const target = altKey ? findDefinitionTarget(pointedAt) : undefined;
      const definition = target ? getDefinition(target.id) : undefined;

      if (!target || !definition) {
        setShown(undefined);

        return;
      }

      setShown({
        title: target.anchor.textContent?.replace(/​/g, "").trim() || definition.kind || "",
        definition,
        ...placeBeside(target.anchor),
      });
    };

    const onPointer = (event: MouseEvent) => {
      pointedAt = event.target instanceof Element ? event.target : null;
      update(event.altKey);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Alt") {
        update(event.type === "keydown");
      }
    };
    const hide = () => setShown(undefined);

    document.addEventListener("mouseover", onPointer, true);
    document.addEventListener("mousemove", onPointer, true);
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    document.addEventListener("mouseleave", hide);
    window.addEventListener("blur", hide);

    return () => {
      document.removeEventListener("mouseover", onPointer, true);
      document.removeEventListener("mousemove", onPointer, true);
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
      document.removeEventListener("mouseleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, [getDefinition]);

  if (!shown) {
    return null;
  }

  const { title, definition, left, top } = shown;
  const facts = [definition.kind, definition.scope && (definition.scope === "Cluster" ? "Cluster-wide" : "Namespaced")]
    .filter(Boolean)
    .join(" · ");

  return createPortal(
    <div className={styles.definition} style={{ left, top }} role="tooltip" data-testid="resource-definition">
      <div className={styles.title}>{title}</div>
      <div>{definition.text}</div>
      {facts && <div className={styles.facts}>{facts}</div>}
    </div>,
    document.body,
  );
};

export const DefinitionHover = withInjectables<Dependencies>(NonInjectedDefinitionHover, {
  getProps: (di, props) => ({
    ...props,
    getDefinition: di.inject(getResourceDefinitionInjectable),
  }),
});
