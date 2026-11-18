/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

/**
 * Set on a row customization that never disables a row, whatever the item. The list then leaves the
 * select-all checkbox's items as they are, where otherwise it asks the customization about every
 * item to find the ones it disables.
 */
export const rowsCannotBeDisabled = Symbol("rowsCannotBeDisabled");
