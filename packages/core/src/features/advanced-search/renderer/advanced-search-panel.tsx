/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Button } from "@freelensapp/button";
import { Icon } from "@freelensapp/icon";
import { cssNames } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React, { useEffect, useRef, useState } from "react";
import openConfirmDialogInjectable from "../../../renderer/components/confirm-dialog/open.injectable";
import { Input } from "../../../renderer/components/input";
import persistentSearchStoreInjectable from "../../../renderer/components/input/persistent-search-store.injectable";
import searchUrlPageParamInjectable from "../../../renderer/components/input/search-url-page-param.injectable";
import { MenuActions, MenuItem } from "../../../renderer/components/menu";
import { Select } from "../../../renderer/components/select";
import currentPathInjectable from "../../../renderer/routes/current-path.injectable";
import { anyFieldId, isRelativeTimeOperator, textSearchOperators, timeSearchOperators } from "../common/conditions";
import { getConditionError, isConditionInEffect } from "../common/create-condition-matcher";
import { describeCondition } from "../common/describe-condition";
import styles from "./advanced-search-panel.module.scss";
import advancedSearchStateInjectable from "./advanced-search-state.injectable";
import {
  createCondition,
  quickSearchCondition,
  withField,
  withTextOperator,
  withTimeOperator,
} from "./condition-editing";
import savedSearchesInjectable from "./saved-searches.injectable";

import type { DiContainerForInjection } from "@ogre-tools/injectable";
import type { IComputedValue } from "mobx";

import type { OpenConfirmDialog } from "../../../renderer/components/confirm-dialog/open.injectable";
import type { PageParam } from "../../../renderer/navigation/page-param";
import type { SavedSearch, SearchCondition, SearchField } from "../common/conditions";
import type { AdvancedSearchState } from "./advanced-search-state";
import type { SavedSearches } from "./saved-search-store";

/**
 * What a list tells advanced search about itself.
 */
export interface AdvancedSearchView<I> {
  /** Identifies the kind of list; saved searches belong to one. */
  readonly viewKey: string;
  /** The name of the list, such as "Pods". */
  readonly viewTitle: string;
  readonly fields: readonly SearchField<I>[];
}

interface Dependencies {
  state: AdvancedSearchState;
  savedSearches: SavedSearches;
  openConfirmDialog: OpenConfirmDialog;
  currentPath: IComputedValue<string>;
  quickSearch: {
    get: () => string;
    clear: () => void;
  };
}

const fieldTitles = <I,>(fields: readonly SearchField<I>[]) =>
  new Map([[anyFieldId, "Any field"], ...fields.map((field) => [field.id, field.title] as const)]);

/** A chip's label: the condition in a line, with an ellipsis for a value still to fill in. */
const chipLabel = (condition: SearchCondition, titles: Map<string, string>) => {
  const title = titles.get(condition.field) ?? condition.field;

  if (!condition.value.trim()) {
    return `${describeCondition({ ...condition, value: "" }, title).replace(/\s*("")?$/, "")} …`;
  }

  return describeCondition(condition, title);
};

const injectDependencies = (di: DiContainerForInjection): Dependencies => {
  const searchUrlParam: PageParam<string> = di.inject(searchUrlPageParamInjectable);
  const persistentSearchStore = di.inject(persistentSearchStoreInjectable);

  return {
    state: di.inject(advancedSearchStateInjectable),
    savedSearches: di.inject(savedSearchesInjectable),
    openConfirmDialog: di.inject(openConfirmDialogInjectable),
    currentPath: di.inject(currentPathInjectable),
    quickSearch: {
      get: () => searchUrlParam.get(),
      clear: () => {
        // A linked search is restored from its shared value whenever the URL
        // changes, so that value has to be cleared too.
        if (persistentSearchStore.isEnabled) {
          persistentSearchStore.setValue("global:linked", "");
        }

        searchUrlParam.clear();
      },
    },
  };
};

/**
 * Applies a saved search to the list it belongs to: its conditions replace the
 * list's, and the quick search is cleared, since the saved search carries it.
 */
const applySavedSearch = (search: SavedSearch, { state, quickSearch }: Pick<Dependencies, "state" | "quickSearch">) => {
  state.setConditions(search.viewKey, search.conditions);
  quickSearch.clear();
};

// ---------------------------------------------------------------------------
// Header controls

interface AdvancedSearchControlsProps<I> {
  view: AdvancedSearchView<I>;
}

/** Adds a condition, open for editing, at the end of the list's conditions. */
const addOpenCondition = <I,>(view: AdvancedSearchView<I>, state: AdvancedSearchState) => {
  const condition = createCondition(view.fields[0], Date.now());

  state.addCondition(view.viewKey, condition);
  state.setOpenCondition(view.viewKey, condition.id);
};

/** The name field of the rename dialog, which tells the dialog the name as it is typed. */
const RenameInput = ({ initial, onChange }: { initial: string; onChange: (name: string) => void }) => {
  const [name, setName] = useState(initial);

  return (
    <Input
      autoFocus
      data-testid="saved-search-rename-input"
      value={name}
      onChange={(value) => {
        setName(value);
        onChange(value);
      }}
    />
  );
};

const renameSavedSearch = (search: SavedSearch, { savedSearches, openConfirmDialog }: Dependencies) => {
  let name = search.name;

  openConfirmDialog({
    message: (
      <div className="flex flex-col gap-2">
        <span>Rename the saved search</span>
        <RenameInput
          initial={search.name}
          onChange={(value) => {
            name = value;
          }}
        />
      </div>
    ),
    labelOk: "Rename",
    ok: () => {
      if (name.trim()) {
        savedSearches.rename(search.id, name);
      }
    },
  });
};

const deleteSavedSearch = (search: SavedSearch, { savedSearches, openConfirmDialog }: Dependencies) =>
  openConfirmDialog({
    message: (
      <p>
        Delete the saved search <b>{search.name}</b>?
      </p>
    ),
    labelOk: "Delete",
    ok: () => savedSearches.remove(search.id),
  });

const NonInjectedAdvancedSearchControls = observer(
  <I,>({ view, ...dependencies }: AdvancedSearchControlsProps<I> & Dependencies) => {
    const { state, savedSearches, quickSearch } = dependencies;
    const { viewKey } = view;
    const activeCount = state.getConditions(viewKey).filter(isConditionInEffect).length;
    const saved = savedSearches.forView(viewKey);

    if (view.fields.length === 0) {
      return null;
    }

    return (
      <div className="flex items-center gap-1">
        <Icon
          material="tune"
          interactive
          data-testid="advanced-search-toggle"
          tooltip={activeCount > 0 ? `Add a condition (${activeCount} active)` : "Advanced search: add a condition"}
          onClick={() => addOpenCondition(view, state)}
        />
        {activeCount > 0 && <span data-testid="advanced-search-active-count">{activeCount}</span>}
        <MenuActions
          id={`saved-searches-menu-${viewKey.replace(/[^a-zA-Z0-9]+/g, "-")}`}
          data-testid="saved-searches-menu"
          toolbar={false}
          autoCloseOnSelect={true}
          triggerIcon={{ material: saved.length > 0 ? "star" : "star_border", tooltip: "Saved searches" }}
        >
          {saved.map((search) => (
            <MenuItem
              key={search.id}
              data-testid={`saved-search-menu-item-${search.name}`}
              onClick={() => applySavedSearch(search, { state, quickSearch })}
            >
              <span className={styles.savedName} title={search.conditions.length ? undefined : "No conditions"}>
                {search.name}
              </span>
              <Icon
                material="edit"
                small
                interactive
                tooltip="Rename"
                data-testid={`saved-search-rename-${search.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  renameSavedSearch(search, dependencies);
                }}
              />
              <Icon
                material="delete"
                small
                interactive
                tooltip="Delete"
                data-testid={`saved-search-delete-${search.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  deleteSavedSearch(search, dependencies);
                }}
              />
            </MenuItem>
          ))}
          {saved.length === 0 && (
            <MenuItem disabled>
              No saved searches for this list. Save one from the conditions under the header.
            </MenuItem>
          )}
        </MenuActions>
      </div>
    );
  },
);

export const AdvancedSearchControls = withInjectables<Dependencies, AdvancedSearchControlsProps<unknown>>(
  NonInjectedAdvancedSearchControls,
  { getProps: (di, props) => ({ ...props, ...injectDependencies(di) }) },
) as <I>(props: AdvancedSearchControlsProps<I>) => React.ReactElement;

// ---------------------------------------------------------------------------
// Closing a popup on a click outside it or on Escape

const useDismiss = (open: boolean, ref: React.RefObject<HTMLElement | null>, dismiss: () => void) => {
  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node | null;

      // The dropdowns of a Select can render their menus elsewhere in the page.
      if (target && !ref.current?.contains(target) && !(target as Element).closest?.(".Select__menu")) {
        dismiss();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismiss();
      }
    };

    document.addEventListener("mousedown", onPointerDown, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("mousedown", onPointerDown, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [open, ref, dismiss]);
};

// ---------------------------------------------------------------------------
// One condition: a chip, or open as its controls

interface ConditionChipProps<I> {
  index: number;
  condition: SearchCondition;
  fields: readonly SearchField<I>[];
  titles: Map<string, string>;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
  onChange: (condition: SearchCondition) => void;
  onRemove: () => void;
}

const ConditionChip = observer(
  <I,>({ index, condition, fields, titles, isOpen, onOpen, onClose, onChange, onRemove }: ConditionChipProps<I>) => {
    const error = getConditionError(condition);
    const operators = condition.kind === "text" ? textSearchOperators : timeSearchOperators;
    const ref = useRef<HTMLDivElement>(null);

    useDismiss(isOpen, ref, onClose);

    if (!isOpen) {
      return (
        <div
          className={cssNames(styles.chip, { [styles.chipInvalid]: Boolean(error) })}
          data-testid={`advanced-search-chip-${index}`}
          title={error}
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
        >
          <span className={styles.chipLabel}>{chipLabel(condition, titles)}</span>
          <Icon
            material="close"
            small
            interactive
            className={styles.chipRemove}
            data-testid={`advanced-search-remove-${index}`}
            tooltip="Remove condition"
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
          />
        </div>
      );
    }

    const renderValue = () => {
      if (condition.kind === "time" && !isRelativeTimeOperator(condition.operator)) {
        return (
          <input
            type="datetime-local"
            className={styles.dateInput}
            data-testid={`advanced-search-value-${index}`}
            value={condition.value}
            onChange={(event) => onChange({ ...condition, value: event.target.value })}
            onKeyDown={(event) => event.key === "Enter" && onClose()}
          />
        );
      }

      return (
        <Input
          autoFocus
          data-testid={`advanced-search-value-${index}`}
          value={condition.value}
          placeholder={condition.kind === "time" ? "Duration, e.g. 30m, 2h, 3d, 1w" : "Value"}
          onChange={(value) => onChange({ ...condition, value })}
          onSubmit={onClose}
        />
      );
    };

    return (
      <div ref={ref} className={styles.chipOpen} data-testid={`advanced-search-condition-${index}`}>
        <Button
          className={styles.not}
          outlined={!condition.negate}
          accent={condition.negate}
          data-testid={`advanced-search-not-${index}`}
          label="NOT"
          onClick={() => onChange({ ...condition, negate: !condition.negate })}
        />
        <div className={styles.fieldSelect}>
          <Select
            id={`advanced-search-field-${index}`}
            themeName="lens"
            options={fields.map((field) => ({ value: field.id, label: field.title }))}
            value={condition.field}
            onChange={(option) => {
              const field = fields.find(({ id }) => id === option?.value);

              if (field) {
                onChange(withField(condition, field, Date.now()));
              }
            }}
          />
        </div>
        <div className={styles.operatorSelect}>
          <Select
            id={`advanced-search-operator-${index}`}
            themeName="lens"
            options={operators.map(({ id, label }) => ({ value: id, label }))}
            value={condition.operator}
            onChange={(option) => {
              if (!option) {
                return;
              }

              onChange(
                condition.kind === "text"
                  ? withTextOperator(condition, option.value as (typeof textSearchOperators)[number]["id"])
                  : withTimeOperator(condition, option.value as (typeof timeSearchOperators)[number]["id"], Date.now()),
              );
            }}
          />
        </div>
        <div className={styles.value}>
          {renderValue()}
          {error && (
            <div className={styles.error} data-testid={`advanced-search-error-${index}`}>
              {error}
            </div>
          )}
        </div>
        <Icon
          material="check"
          interactive
          tooltip="Done"
          data-testid={`advanced-search-done-${index}`}
          onClick={onClose}
        />
        <Icon
          material="close"
          interactive
          data-testid={`advanced-search-remove-${index}`}
          tooltip="Remove condition"
          onClick={onRemove}
        />
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Saving: a dropdown at the end of the conditions

interface SaveSearchDropdownProps<I> {
  view: AdvancedSearchView<I>;
  dependencies: Dependencies;
}

const SaveSearchDropdown = observer(<I,>({ view, dependencies }: SaveSearchDropdownProps<I>) => {
  const { state, savedSearches, currentPath, quickSearch } = dependencies;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const conditions = state.getConditions(view.viewKey).filter(isConditionInEffect);
  const quickSearchText = quickSearch.get().trim();
  const existing = name.trim() ? savedSearches.findByName(view.viewKey, name) : undefined;
  const canSave = Boolean(name.trim()) && (conditions.length > 0 || Boolean(quickSearchText));

  useDismiss(open, ref, () => setOpen(false));

  const save = () => {
    if (!canSave) {
      return;
    }

    // The quick search text becomes an "Any field" condition, here and in the
    // saved search, so that the saved search is all conditions.
    const savedConditions = quickSearchText ? [...conditions, quickSearchCondition(quickSearchText)] : conditions;

    if (quickSearchText) {
      state.setConditions(view.viewKey, [...state.getConditions(view.viewKey), quickSearchCondition(quickSearchText)]);
      quickSearch.clear();
    }

    savedSearches.save({
      name,
      viewKey: view.viewKey,
      viewTitle: view.viewTitle,
      routePath: currentPath.get(),
      conditions: savedConditions,
    });
    setName("");
    setOpen(false);
  };

  return (
    <div ref={ref} className={styles.saveDropdown}>
      <a className={styles.link} data-testid="advanced-search-save-toggle" onClick={() => setOpen(!open)}>
        Save
        <Icon material={open ? "arrow_drop_up" : "arrow_drop_down"} small />
      </a>
      {open && (
        <div className={styles.savePopover} data-testid="advanced-search-save-popover">
          <Input
            autoFocus
            data-testid="advanced-search-save-name"
            placeholder="Name this search"
            value={name}
            onChange={setName}
            onSubmit={save}
          />
          <Button
            primary
            data-testid="advanced-search-save"
            disabled={!canSave}
            label={existing ? "Replace" : "Save"}
            onClick={save}
          />
          {quickSearchText && (
            <span className={styles.hint}>
              The quick search &quot;{quickSearchText}&quot; is saved as an Any field condition.
            </span>
          )}
          <span className={styles.hint}>Saved searches are in the ★ menu of the header.</span>
        </div>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// The conditions under the header

interface AdvancedSearchPanelProps<I> {
  view: AdvancedSearchView<I>;
}

const NonInjectedAdvancedSearchPanel = observer(
  <I,>({ view, ...dependencies }: AdvancedSearchPanelProps<I> & Dependencies) => {
    const { state } = dependencies;
    const { viewKey, fields } = view;
    const conditions = state.getConditions(viewKey);
    const openId = state.getOpenCondition(viewKey);

    if (fields.length === 0 || conditions.length === 0) {
      return null;
    }

    const titles = fieldTitles(fields);

    return (
      <div className={cssNames(styles.strip, "flex flex-wrap items-center gap-2")} data-testid="advanced-search-strip">
        {conditions.map((condition, index) => (
          <ConditionChip
            key={condition.id}
            index={index}
            condition={condition}
            fields={fields}
            titles={titles}
            isOpen={condition.id === openId}
            onOpen={() => state.setOpenCondition(viewKey, condition.id)}
            onClose={() => {
              if (state.getOpenCondition(viewKey) === condition.id) {
                state.setOpenCondition(viewKey, undefined);
              }
            }}
            onChange={(changed) => state.replaceCondition(viewKey, changed)}
            onRemove={() => state.removeCondition(viewKey, condition.id)}
          />
        ))}
        <Icon
          material="add"
          small
          interactive
          className={styles.addChip}
          tooltip="Add a condition. Conditions on the same field match if any of them does, different fields must all match, and NOT conditions must always hold."
          data-testid="advanced-search-add"
          onClick={() => addOpenCondition(view, state)}
        />
        <a className={styles.link} data-testid="advanced-search-clear" onClick={() => state.clear(viewKey)}>
          Clear all
        </a>
        <SaveSearchDropdown view={view} dependencies={dependencies} />
      </div>
    );
  },
);

export const AdvancedSearchPanel = withInjectables<Dependencies, AdvancedSearchPanelProps<unknown>>(
  NonInjectedAdvancedSearchPanel,
  { getProps: (di, props) => ({ ...props, ...injectDependencies(di) }) },
) as <I>(props: AdvancedSearchPanelProps<I>) => React.ReactElement;
