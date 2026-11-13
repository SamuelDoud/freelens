/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Button } from "@freelensapp/button";
import { Icon } from "@freelensapp/icon";
import { cssNames } from "@freelensapp/utilities";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import React, { useState } from "react";
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

const describeConditions = <I,>(conditions: readonly SearchCondition[], fields: readonly SearchField<I>[]) => {
  const titles = new Map([[anyFieldId, "Any field"], ...fields.map((field) => [field.id, field.title] as const)]);

  return conditions
    .filter(isConditionInEffect)
    .map((condition) => describeCondition(condition, titles.get(condition.field) ?? condition.field));
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

const NonInjectedAdvancedSearchControls = observer(
  <I,>({ view, state, savedSearches, quickSearch }: AdvancedSearchControlsProps<I> & Dependencies) => {
    const { viewKey } = view;
    const activeCount = state.getConditions(viewKey).filter(isConditionInEffect).length;
    const saved = savedSearches.forView(viewKey);
    const isOpen = state.isPanelOpen(viewKey);

    return (
      <div className="flex items-center gap-1">
        <Icon
          material="tune"
          interactive
          active={isOpen}
          data-testid="advanced-search-toggle"
          tooltip={activeCount > 0 ? `Advanced search (${activeCount} active)` : "Advanced search"}
          onClick={() => state.setPanelOpen(viewKey, !isOpen)}
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
              {search.name}
            </MenuItem>
          ))}
          {saved.length === 0 && <MenuItem disabled>No saved searches for this list</MenuItem>}
          <MenuItem data-testid="saved-searches-manage" onClick={() => state.setPanelOpen(viewKey, true)}>
            Save or manage searches…
          </MenuItem>
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
// One condition

interface ConditionRowProps<I> {
  index: number;
  condition: SearchCondition;
  fields: readonly SearchField<I>[];
  onChange: (condition: SearchCondition) => void;
  onRemove: () => void;
}

const ConditionRow = observer(<I,>({ index, condition, fields, onChange, onRemove }: ConditionRowProps<I>) => {
  const error = getConditionError(condition);
  const operators = condition.kind === "text" ? textSearchOperators : timeSearchOperators;

  const renderValue = () => {
    if (condition.kind === "time" && !isRelativeTimeOperator(condition.operator)) {
      return (
        <input
          type="datetime-local"
          className={styles.dateInput}
          data-testid={`advanced-search-value-${index}`}
          value={condition.value}
          onChange={(event) => onChange({ ...condition, value: event.target.value })}
        />
      );
    }

    return (
      <Input
        data-testid={`advanced-search-value-${index}`}
        value={condition.value}
        placeholder={condition.kind === "time" ? "Duration, e.g. 30m, 2h, 3d, 1w" : "Value"}
        onChange={(value) => onChange({ ...condition, value })}
      />
    );
  };

  return (
    <div className="flex flex-wrap items-start gap-2" data-testid={`advanced-search-condition-${index}`}>
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
      <Button
        className={styles.not}
        outlined={!condition.negate}
        accent={condition.negate}
        data-testid={`advanced-search-not-${index}`}
        label="NOT"
        onClick={() => onChange({ ...condition, negate: !condition.negate })}
      />
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
        material="close"
        interactive
        data-testid={`advanced-search-remove-${index}`}
        tooltip="Remove condition"
        onClick={onRemove}
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// Saving

interface SaveSearchFormProps<I> {
  view: AdvancedSearchView<I>;
  dependencies: Dependencies;
}

const SaveSearchForm = observer(<I,>({ view, dependencies }: SaveSearchFormProps<I>) => {
  const { state, savedSearches, currentPath, quickSearch } = dependencies;
  const [name, setName] = useState("");
  const conditions = state.getConditions(view.viewKey).filter(isConditionInEffect);
  const quickSearchText = quickSearch.get().trim();
  const existing = name.trim() ? savedSearches.findByName(view.viewKey, name) : undefined;
  const canSave = Boolean(name.trim()) && (conditions.length > 0 || Boolean(quickSearchText));

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
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="grow">
        <Input
          data-testid="advanced-search-save-name"
          placeholder="Name this search to save it"
          value={name}
          onChange={setName}
          onSubmit={save}
        />
      </div>
      <Button
        primary
        data-testid="advanced-search-save"
        disabled={!canSave}
        label={existing ? "Replace saved search" : "Save search"}
        onClick={save}
      />
      {quickSearchText && (
        <span className={styles.hint}>
          The quick search &quot;{quickSearchText}&quot; is saved as an Any field condition.
        </span>
      )}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Saved searches of the list

interface SavedSearchRowProps<I> {
  search: SavedSearch;
  view: AdvancedSearchView<I>;
  dependencies: Dependencies;
}

const SavedSearchRow = observer(<I,>({ search, view, dependencies }: SavedSearchRowProps<I>) => {
  const { savedSearches, openConfirmDialog } = dependencies;
  const [newName, setNewName] = useState<string | undefined>(undefined);
  const summary = describeConditions(search.conditions, view.fields).join(" · ");

  if (newName !== undefined) {
    const rename = () => {
      if (newName.trim()) {
        savedSearches.rename(search.id, newName);
      }

      setNewName(undefined);
    };

    return (
      <div className="flex items-center gap-2" data-testid={`saved-search-${search.name}`}>
        <div className="grow">
          <Input
            autoFocus
            data-testid={`saved-search-rename-input-${search.name}`}
            value={newName}
            onChange={setNewName}
            onSubmit={rename}
          />
        </div>
        <Button primary label="Rename" data-testid={`saved-search-rename-confirm-${search.name}`} onClick={rename} />
        <Button plain label="Cancel" onClick={() => setNewName(undefined)} />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2" data-testid={`saved-search-${search.name}`}>
      <div className="grow min-w-0">
        <div className={styles.savedName}>{search.name}</div>
        <div className={styles.savedSummary}>{summary || "No conditions"}</div>
      </div>
      <Button
        outlined
        label="Apply"
        data-testid={`saved-search-apply-${search.name}`}
        onClick={() => applySavedSearch(search, dependencies)}
      />
      <Icon
        material="edit"
        interactive
        tooltip="Rename"
        data-testid={`saved-search-rename-${search.name}`}
        onClick={() => setNewName(search.name)}
      />
      <Icon
        material="delete"
        interactive
        tooltip="Delete"
        data-testid={`saved-search-delete-${search.name}`}
        onClick={() =>
          openConfirmDialog({
            message: (
              <p>
                Delete the saved search <b>{search.name}</b>?
              </p>
            ),
            labelOk: "Delete",
            ok: () => savedSearches.remove(search.id),
          })
        }
      />
    </div>
  );
});

// ---------------------------------------------------------------------------
// The panel under the header

interface AdvancedSearchPanelProps<I> {
  view: AdvancedSearchView<I>;
}

const NonInjectedAdvancedSearchPanel = observer(
  <I,>({ view, ...dependencies }: AdvancedSearchPanelProps<I> & Dependencies) => {
    const { state, savedSearches } = dependencies;
    const { viewKey, fields } = view;
    const conditions = state.getConditions(viewKey);

    if (fields.length === 0) {
      return null;
    }

    if (!state.isPanelOpen(viewKey)) {
      const descriptions = describeConditions(conditions, fields);

      if (descriptions.length === 0) {
        return null;
      }

      return (
        <div
          className={cssNames(styles.chips, "flex flex-wrap items-center gap-2")}
          data-testid="advanced-search-chips"
        >
          {descriptions.map((description) => (
            <span key={description} className={styles.chip}>
              {description}
            </span>
          ))}
          <a
            className={styles.link}
            data-testid="advanced-search-edit"
            onClick={() => state.setPanelOpen(viewKey, true)}
          >
            Edit
          </a>
          <a className={styles.link} data-testid="advanced-search-clear-chips" onClick={() => state.clear(viewKey)}>
            Clear
          </a>
        </div>
      );
    }

    const saved = savedSearches.forView(viewKey);

    return (
      <div className={cssNames(styles.panel, "flex flex-col gap-3")} data-testid="advanced-search-panel">
        <div className="flex items-center gap-2">
          <span className={styles.title}>Advanced search</span>
          <span className={cssNames(styles.hint, "grow")}>
            Conditions on the same field match if any of them does; different fields must all match; NOT conditions must
            always hold.
          </span>
          <Icon
            material="expand_less"
            interactive
            tooltip="Hide"
            data-testid="advanced-search-hide"
            onClick={() => state.setPanelOpen(viewKey, false)}
          />
        </div>
        {conditions.map((condition, index) => (
          <ConditionRow
            key={condition.id}
            index={index}
            condition={condition}
            fields={fields}
            onChange={(changed) => state.replaceCondition(viewKey, changed)}
            onRemove={() => state.removeCondition(viewKey, condition.id)}
          />
        ))}
        <div className="flex items-center gap-2">
          <Button
            outlined
            label="Add condition"
            data-testid="advanced-search-add"
            onClick={() => state.addCondition(viewKey, createCondition(fields[0], Date.now()))}
          />
          {conditions.length > 0 && (
            <Button plain label="Clear all" data-testid="advanced-search-clear" onClick={() => state.clear(viewKey)} />
          )}
        </div>
        <SaveSearchForm view={view} dependencies={dependencies} />
        {saved.length > 0 && (
          <div className={cssNames(styles.savedList, "flex flex-col gap-2")} data-testid="saved-searches">
            <span className={styles.title}>Saved searches for {view.viewTitle}</span>
            {saved.map((search) => (
              <SavedSearchRow key={search.id} search={search} view={view} dependencies={dependencies} />
            ))}
          </div>
        )}
      </div>
    );
  },
);

export const AdvancedSearchPanel = withInjectables<Dependencies, AdvancedSearchPanelProps<unknown>>(
  NonInjectedAdvancedSearchPanel,
  { getProps: (di, props) => ({ ...props, ...injectDependencies(di) }) },
) as <I>(props: AdvancedSearchPanelProps<I>) => React.ReactElement;
