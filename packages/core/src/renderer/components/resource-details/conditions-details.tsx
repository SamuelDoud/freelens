/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DrawerItem, DrawerTitle } from "../drawer";
import styles from "./resource-details.module.scss";

import type { BaseKubeObjectCondition } from "@freelensapp/kube-object";

/** The status conditions of an object, one per line, with their reason and message. */
export const ConditionsDetails = ({ conditions }: { conditions: readonly BaseKubeObjectCondition[] | undefined }) =>
  conditions?.length ? (
    <>
      <DrawerTitle>Conditions</DrawerTitle>
      {conditions.map((condition) => (
        <DrawerItem key={condition.type} name={condition.type}>
          <span className={condition.status === "True" ? styles.conditionTrue : styles.conditionOther}>
            {condition.status}
          </span>
          {condition.reason && ` (${condition.reason})`}
          {condition.message && <div className={styles.conditionMessage}>{condition.message}</div>}
        </DrawerItem>
      ))}
    </>
  ) : null;

/** The types of the conditions that hold, e.g. "Approved, Issued", or what the object is waiting for. */
export const describeTrueConditions = (conditions: readonly BaseKubeObjectCondition[] | undefined, none = "") =>
  (conditions ?? [])
    .filter((condition) => condition.status === "True")
    .map((condition) => condition.type)
    .join(", ") || none;
