/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DrawerItem, DrawerTitle } from "../drawer";
import { text } from "./format";
import styles from "./resource-details.module.scss";
import { isEmptyValue, YamlBlock } from "./yaml-block";

/** A field of an object in its details; nothing when the field is empty. */
export const ResourceDetailItem = ({ name, value }: { name: string; value: unknown }) =>
  text(value) === "" ? null : (
    <DrawerItem name={name}>
      <span className={styles.text}>{text(value)}</span>
    </DrawerItem>
  );

/** A nested field of an object under a title, as YAML; nothing when it is empty. */
export const YamlDetails = ({ title, value }: { title: string; value: unknown }) =>
  isEmptyValue(value) ? null : (
    <>
      <DrawerTitle>{title}</DrawerTitle>
      <YamlBlock value={value} />
    </>
  );
