/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import type { StrictReactNode } from "@freelensapp/utilities";

/** Details a list shows under its rows, opened by the arrow at the left of each row. */
export interface InlineDetails<Item> {
  render: (item: Item) => StrictReactNode;
  /** Whether a plain click on a row opens its details in place; otherwise it opens the side panel. */
  rowClickExpands: () => boolean;
}
