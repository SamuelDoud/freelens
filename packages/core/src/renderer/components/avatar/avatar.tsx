/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cssNames } from "@freelensapp/utilities";
import Color from "color";
import { useLayoutEffect, useRef } from "react";
import { computeDefaultShortName } from "../../../common/catalog/helpers";
import styles from "./avatar.module.scss";
import { seededColor } from "./seeded-color";

import type { StrictReactNode } from "@freelensapp/utilities";

import type { ImgHTMLAttributes, MouseEventHandler } from "react";

export interface AvatarProps {
  title: string;
  colorHash?: string;
  size?: number;
  src?: string;
  background?: string;
  /**
   * Text to show instead of the initials of the title, as it is written. It is
   * fitted into the avatar: it wraps onto up to three lines, and its font
   * shrinks until it fits.
   */
  text?: string;
  /** The colour of the text; by default it contrasts with the background */
  color?: string;
  variant?: "circle" | "rounded" | "square";
  imgProps?: ImgHTMLAttributes<HTMLImageElement>;
  disabled?: boolean;
  children?: StrictReactNode;
  className?: string;
  id?: string;
  onClick?: MouseEventHandler<HTMLDivElement>;
  "data-testid"?: string;
}

const maxLines = 3;
const minFontSize = 6;

/** Black or white, whichever reads better on the background; white when it is not a plain colour. */
export const contrastingTextColor = (background: string): string => {
  try {
    return Color(background).isLight() ? "#000000" : "#ffffff";
  } catch {
    return "#ffffff";
  }
};

const FittedText = ({ text, size }: { text: string; size: number }) => {
  const ref = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;

    if (!element) {
      return;
    }

    const room = element.clientWidth;
    let fontSize = Math.min(Math.round(size * 0.4), 16);

    const overflows = () => {
      element.style.fontSize = `${fontSize}px`;

      const lineHeight = parseFloat(getComputedStyle(element).lineHeight) || fontSize * 1.1;

      return (
        element.scrollWidth > room + 0.5 ||
        element.scrollHeight > room + 0.5 ||
        Math.round(element.scrollHeight / lineHeight) > maxLines
      );
    };

    // Words stay whole while the font can still shrink; only a word too long
    // for the smallest size is broken.
    element.style.overflowWrap = "normal";

    while (fontSize > minFontSize && overflows()) {
      fontSize -= 0.5;
    }

    if (overflows()) {
      element.style.overflowWrap = "anywhere";
    }
  }, [text, size]);

  return (
    <span ref={ref} className={styles.fittedText}>
      {text}
    </span>
  );
};

export const Avatar = ({
  title,
  variant = "rounded",
  size = 32,
  colorHash,
  children,
  background,
  text,
  color,
  imgProps,
  src,
  className,
  disabled,
  id,
  onClick,
  "data-testid": dataTestId,
}: AvatarProps) => (
  <div
    className={cssNames(
      styles.Avatar,
      {
        [styles.circle]: variant == "circle",
        [styles.rounded]: variant == "rounded",
        [styles.disabled]: disabled,
      },
      className,
    )}
    style={{
      width: `${size}px`,
      height: `${size}px`,
      // Falling back to the title keeps the colour stable for an avatar given
      // no explicit hash, which is also where the initials come from
      background: background || (src ? "transparent" : seededColor(colorHash ?? title)),
      color: color || contrastingTextColor(background || seededColor(colorHash ?? title)),
    }}
    id={id}
    onClick={onClick}
    data-testid={dataTestId}
  >
    {src ? (
      <img src={src} {...imgProps} alt={title} />
    ) : (
      children || (text ? <FittedText text={text} size={size} /> : computeDefaultShortName(title))
    )}
  </div>
);
