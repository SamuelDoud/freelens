/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import React from "react";
import { MatchResourcesDetails } from "../config-mutating-admission-policies/match-resources-details";
import { DrawerItem, DrawerTitle } from "../drawer";

import type { MutatingAdmissionPolicyBinding } from "@freelensapp/kube-object";

import type { KubeObjectDetailsProps } from "../kube-object-details";

export interface MutatingAdmissionPolicyBindingDetailsProps
  extends KubeObjectDetailsProps<MutatingAdmissionPolicyBinding> {}

@observer
export class MutatingAdmissionPolicyBindingDetails extends React.Component<MutatingAdmissionPolicyBindingDetailsProps> {
  render() {
    const { object: binding } = this.props;

    const paramRef = binding.getParamRef();
    const matchResources = binding.getMatchResources();

    return (
      <div className="MutatingAdmissionPolicyBindingDetails">
        <DrawerItem name="API version">{binding.apiVersion}</DrawerItem>
        <DrawerItem name="Policy Name">{binding.getPolicyName()}</DrawerItem>

        {paramRef && (
          <>
            <DrawerTitle>Param Ref</DrawerTitle>
            {paramRef.name && <DrawerItem name="Name">{paramRef.name}</DrawerItem>}
            {paramRef.namespace && <DrawerItem name="Namespace">{paramRef.namespace}</DrawerItem>}
            {paramRef.parameterNotFoundAction && (
              <DrawerItem name="Parameter Not Found Action">{paramRef.parameterNotFoundAction}</DrawerItem>
            )}
          </>
        )}

        <MatchResourcesDetails title="Match Resources" matchResources={matchResources} />
      </div>
    );
  }
}
