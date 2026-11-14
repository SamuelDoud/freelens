/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { DrawerItem, DrawerTitle } from "../drawer";

import type { LabelSelector, MatchResources, NamedRuleWithOperations } from "@freelensapp/kube-object";

/** "key=value" for each label and "key operator (values)" for each expression of a selector. */
export function describeLabelSelector({ matchLabels, matchExpressions }: LabelSelector): string[] {
  return [
    ...Object.entries(matchLabels ?? {}).map(([key, value]) => `${key}=${value}`),
    ...(matchExpressions ?? []).map(({ key, operator, values }) =>
      values?.length ? `${key} ${operator} (${values.join(", ")})` : `${key} ${operator}`,
    ),
  ];
}

// The core API group is the empty string.
const describeApiGroups = (groups: string[]) => groups.map((group) => group || "core").join(", ");

function renderRules(name: string, rules: NamedRuleWithOperations[] | undefined) {
  if (!rules?.length) {
    return null;
  }

  return (
    <DrawerItem name={name}>
      {rules.map((rule, index) => (
        <div key={index}>
          <div>API Groups: {describeApiGroups(rule.apiGroups)}</div>
          <div>API Versions: {rule.apiVersions?.join(", ")}</div>
          <div>Operations: {rule.operations.join(", ")}</div>
          {rule.resources && <div>Resources: {rule.resources.join(", ")}</div>}
          {rule.resourceNames && <div>Resource Names: {rule.resourceNames.join(", ")}</div>}
          {rule.scope && <div>Scope: {rule.scope}</div>}
        </div>
      ))}
    </DrawerItem>
  );
}

function renderSelector(name: string, selector: LabelSelector | undefined) {
  if (!selector) {
    return null;
  }

  const terms = describeLabelSelector(selector);

  return (
    <DrawerItem name={name}>
      {terms.length ? terms.map((term) => <div key={term}>{term}</div>) : "(matches everything)"}
    </DrawerItem>
  );
}

export function MatchResourcesDetails({ title, matchResources }: { title: string; matchResources?: MatchResources }) {
  if (!matchResources) {
    return null;
  }

  return (
    <>
      <DrawerTitle>{title}</DrawerTitle>
      {matchResources.matchPolicy && <DrawerItem name="Match Policy">{matchResources.matchPolicy}</DrawerItem>}
      {renderSelector("Namespace Selector", matchResources.namespaceSelector)}
      {renderSelector("Object Selector", matchResources.objectSelector)}
      {renderRules("Resource Rules", matchResources.resourceRules)}
      {renderRules("Excluded Resource Rules", matchResources.excludeResourceRules)}
    </>
  );
}
