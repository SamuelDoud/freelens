/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import React from "react";
import { DrawerItem, DrawerTitle } from "../drawer";
import { MatchResourcesDetails } from "./match-resources-details";
import styles from "./mutating-admission-policies-details.module.scss";

import type { MutatingAdmissionPolicy } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface MutatingAdmissionPolicyDetailsProps extends KubeObjectDetailsProps<MutatingAdmissionPolicy> {}

@observer
export class MutatingAdmissionPolicyDetails extends React.Component<MutatingAdmissionPolicyDetailsProps> {
  render() {
    const { object: policy } = this.props;

    const paramKind = policy.getParamKind();
    const matchConstraints = policy.getMatchConstraints();
    const mutations = policy.getMutations();
    const matchConditions = policy.getMatchConditions();
    const variables = policy.getVariables();

    return (
      <div className="MutatingAdmissionPolicyDetails">
        <DrawerItem name="API version">{policy.apiVersion}</DrawerItem>
        <DrawerItem name="Failure Policy">{policy.getFailurePolicy()}</DrawerItem>
        <DrawerItem name="Reinvocation Policy" hidden={!policy.getReinvocationPolicy()}>
          {policy.getReinvocationPolicy()}
        </DrawerItem>
        {paramKind && (
          <DrawerItem name="Param Kind">{[paramKind.apiVersion, paramKind.kind].filter(Boolean).join("/")}</DrawerItem>
        )}

        {matchConditions.length > 0 && (
          <>
            <DrawerTitle>Match Conditions</DrawerTitle>
            {matchConditions.map((matchCondition) => (
              <DrawerItem name={matchCondition.name} key={matchCondition.name}>
                {matchCondition.expression}
              </DrawerItem>
            ))}
          </>
        )}

        {variables.length > 0 && (
          <>
            <DrawerTitle>Variables</DrawerTitle>
            {variables.map((variable) => (
              <DrawerItem name={variable.name} key={variable.name}>
                {variable.expression}
              </DrawerItem>
            ))}
          </>
        )}

        <DrawerTitle>Mutations</DrawerTitle>
        {mutations.length === 0 && <div style={{ opacity: 0.6 }}>No mutations set</div>}
        {mutations.map((mutation, index) => (
          <div key={index}>
            <DrawerItem name="Patch Type">{mutation.patchType}</DrawerItem>
            {mutation.applyConfiguration?.expression && (
              <DrawerItem name="Apply Configuration">
                <pre className={styles.expression}>{mutation.applyConfiguration.expression}</pre>
              </DrawerItem>
            )}
            {mutation.jsonPatch?.expression && (
              <DrawerItem name="JSON Patch">
                <pre className={styles.expression}>{mutation.jsonPatch.expression}</pre>
              </DrawerItem>
            )}
          </div>
        ))}

        <MatchResourcesDetails title="Match Constraints" matchResources={matchConstraints} />
      </div>
    );
  }
}
