/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { dump } from "js-yaml";
import styles from "./resource-details.module.scss";

/** Missing, or an empty list or object. */
export const isEmptyValue = (value: unknown) =>
  value === undefined ||
  value === null ||
  (Array.isArray(value) && value.length === 0) ||
  (typeof value === "object" && Object.keys(value as object).length === 0);

/** A nested field of an object, as YAML: for the parts of a spec that have no fixed layout. */
export const YamlBlock = ({ value }: { value: unknown }) =>
  isEmptyValue(value) ? null : (
    <pre className={styles.yamlBlock}>{dump(value, { lineWidth: 120, noRefs: true }).trimEnd()}</pre>
  );
