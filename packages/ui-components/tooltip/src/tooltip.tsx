/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import "./tooltip.scss";

import { cssNames } from "@freelensapp/utilities";
import autoBindReact from "auto-bind/react";
import { action, observable, observableRef, runInAction } from "mobx";
import { observer } from "mobx-react";
import React from "react";
import { createPortal, flushSync } from "react-dom";
import { computeNextPosition } from "./helpers";

import type { IClassName, StrictReactNode } from "@freelensapp/utilities";

export enum TooltipPosition {
  TOP = "top",
  BOTTOM = "bottom",
  LEFT = "left",
  RIGHT = "right",
  TOP_LEFT = "top_left",
  TOP_RIGHT = "top_right",
  BOTTOM_LEFT = "bottom_left",
  BOTTOM_RIGHT = "bottom_right",
}

export interface TooltipProps {
  targetId: string; // html-id of target element to bind for
  tooltipOnParentHover?: boolean; // detect hover on parent of target
  visible?: boolean; // initial visibility
  offset?: number; // offset from target element in pixels (all sides)
  usePortal?: boolean; // renders element outside of parent (in body), disable for "easy-styling", default: true
  preferredPositions?: TooltipPosition | TooltipPosition[];
  className?: IClassName;
  formatters?: TooltipContentFormatters;
  style?: React.CSSProperties;
  children?: StrictReactNode;
  "data-testid"?: string;
}

export interface TooltipContentFormatters {
  narrow?: boolean; // max-width
  warning?: boolean; // color
  small?: boolean; // font-size
  nowrap?: boolean; // white-space
  tableView?: boolean;
}

const defaultProps = {
  usePortal: true,
  offset: 10,
};

type ActiveTooltipProps = TooltipProps &
  typeof defaultProps & {
    /** The mouse entered the target before this component was mounted. */
    initiallyHovered?: boolean;
  };

@observer
class ActiveTooltip extends React.Component<ActiveTooltipProps> {
  static defaultProps = defaultProps as object;

  @observableRef accessor elem: HTMLDivElement | null = null;

  @observable accessor activePosition: TooltipPosition | undefined;

  @observable accessor isVisible = false;

  @observable accessor isContentVisible = false; // animation manager

  constructor(props: ActiveTooltipProps) {
    super(props);
    autoBindReact(this);

    if (props.initiallyHovered) {
      this.isVisible = true;
    }
  }

  get targetElem(): HTMLElement | null {
    return document.getElementById(this.props.targetId);
  }

  get hoverTarget(): HTMLElement | null {
    if (this.props.tooltipOnParentHover) {
      return this.targetElem?.parentElement ?? null;
    }

    return this.targetElem;
  }

  componentDidMount() {
    this.hoverTarget?.addEventListener("mouseenter", this.onEnterTarget);
    this.hoverTarget?.addEventListener("mouseleave", this.onLeaveTarget);

    if (this.props.initiallyHovered) {
      requestAnimationFrame(action(() => (this.isContentVisible = true)));
    }

    this.refreshPosition();
  }

  componentDidUpdate() {
    this.refreshPosition();
  }

  componentWillUnmount() {
    this.hoverTarget?.removeEventListener("mouseenter", this.onEnterTarget);
    this.hoverTarget?.removeEventListener("mouseleave", this.onLeaveTarget);
  }

  @action
  protected onEnterTarget() {
    this.isVisible = true;
    requestAnimationFrame(action(() => (this.isContentVisible = true)));
  }

  @action
  protected onLeaveTarget() {
    this.isVisible = false;
    this.isContentVisible = false;
  }

  refreshPosition() {
    const { preferredPositions, offset } = this.props;
    const { elem, targetElem } = this;

    if (!elem || !targetElem) {
      return;
    }

    this.setPosition(elem, { left: 0, top: 0 });

    const { position, ...location } = computeNextPosition({
      offset,
      preferredPositions,
      target: targetElem,
      tooltip: elem,
    });

    runInAction(() => {
      this.activePosition = position;
      this.setPosition(elem, location);
    });
  }

  protected setPosition(elem: HTMLDivElement, pos: { left: number; top: number }) {
    elem.style.left = `${pos.left}px`;
    elem.style.top = `${pos.top}px`;
  }

  render() {
    const { style, formatters, usePortal, children, visible = this.isVisible } = this.props;

    if (!visible) {
      return null;
    }

    const className = cssNames("Tooltip", this.props.className, formatters, this.activePosition, {
      visible: this.isContentVisible || this.props.visible,
      formatter: !!formatters,
    });
    const tooltip = (
      <div
        className={className}
        style={style}
        ref={(elem) => {
          this.elem = elem;
        }}
        role="tooltip"
        data-testid={this.props["data-testid"]}
      >
        {children}
      </div>
    );

    if (usePortal) {
      return createPortal(tooltip, document.body);
    }

    return tooltip;
  }
}

/**
 * Mounts the tooltip machinery (observables, bound handlers, listeners on the
 * target) only once the pointer first enters the target, or when `visible` is
 * set. A tooltip that is never hovered costs one plain component and two
 * listeners.
 */
class LazyTooltip extends React.Component<TooltipProps, { hovered: boolean }> {
  state = { hovered: false };

  private hoverTarget: HTMLElement | null = null;

  private readonly onEnterTarget = () => {
    if (this.state.hovered) {
      return;
    }

    this.removeListeners();
    // Synchronous, so that the mounted tooltip has its own listeners attached
    // before the pointer can leave again.
    flushSync(() => this.setState({ hovered: true }));
  };

  private removeListeners() {
    this.hoverTarget?.removeEventListener("mouseenter", this.onEnterTarget);
    this.hoverTarget = null;
  }

  componentDidMount() {
    const target = document.getElementById(this.props.targetId);

    this.hoverTarget = this.props.tooltipOnParentHover ? (target?.parentElement ?? null) : target;
    this.hoverTarget?.addEventListener("mouseenter", this.onEnterTarget);
  }

  componentWillUnmount() {
    this.removeListeners();
  }

  render() {
    if (!this.state.hovered && !this.props.visible) {
      return null;
    }

    return <ActiveTooltip {...(this.props as ActiveTooltipProps)} initiallyHovered={this.state.hovered} />;
  }
}

export const Tooltip = LazyTooltip as React.ComponentClass<TooltipProps>;
