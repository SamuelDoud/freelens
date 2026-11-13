/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { observer } from "mobx-react";
import { Checkbox } from "../checkbox";
import { SubTitle } from "../layout/sub-title";

import type { Cluster } from "../../../common/cluster/cluster";

export interface HideCompletedPodsSettingProps {
  cluster: Cluster;
}

export const HideCompletedPodsSetting = observer(function HideCompletedPodsSetting({
  cluster,
}: HideCompletedPodsSettingProps) {
  return (
    <>
      <SubTitle title="Completed pods" />
      <Checkbox
        label="Hide completed pods"
        value={cluster.preferences.hideCompletedPods ?? false}
        onChange={(checked) => {
          cluster.preferences.hideCompletedPods = checked;
        }}
      />
      <small className="hint">
        Leave pods that ran to completion out of the pod list, so that clusters with many finished Jobs load and watch
        less. They are also left out of the pods of finished Jobs and CronJobs, of the logs, of node details and of the
        pod chart in the overview. Failed pods stay.
      </small>
    </>
  );
});
