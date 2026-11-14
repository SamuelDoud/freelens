/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { cssNames } from "@freelensapp/utilities";
import * as yaml from "js-yaml";
import { useEffect, useMemo, useState } from "react";
import { defaultYamlDumpOptions } from "../../../../common/kube-helpers";
import { MonacoEditor } from "../../monaco-editor";
import { diffLines } from "./diff-lines";
import styles from "./pod-spec-view.module.scss";

import type { OwnerReference, Pod } from "@freelensapp/kube-object";

import type { RequestKubeResource } from "../../dock/edit-resource/edit-resource-model/request-kube-resource.injectable";

export interface PodSpecViewProps {
  pod: Pod;
  /** The pod's controller and the API path to read it from, when it has one */
  owner?: { ref: OwnerReference; apiPath: string };
  requestKubeResource: RequestKubeResource;
}

type Mode = "pod" | "controller";

interface ControllerTemplate {
  spec?: unknown;
  /** What owns the controller, such as the Deployment of a ReplicaSet */
  parent?: OwnerReference;
  error?: string;
}

const toYaml = (value: unknown) => yaml.dump(value ?? {}, defaultYamlDumpOptions);

const kindsWithPodTemplate = new Set(["ReplicaSet", "StatefulSet", "DaemonSet", "Job", "ReplicationController"]);

/**
 * The spec a pod runs with, shown in place. For a pod made by a controller it
 * can show the controller's pod template instead, with the lines the pod has
 * and the template has not (set when the pod was created: defaults,
 * admission, the scheduler) and the other way round.
 */
export function PodSpecView({ pod, owner, requestKubeResource }: PodSpecViewProps) {
  const hasTemplate = Boolean(owner && kindsWithPodTemplate.has(owner.ref.kind));
  const [mode, setMode] = useState<Mode>(hasTemplate ? "controller" : "pod");
  const [template, setTemplate] = useState<ControllerTemplate>();
  const podYaml = useMemo(() => toYaml(pod.spec), [pod.spec]);

  useEffect(() => {
    if (mode !== "controller" || !owner || template) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await requestKubeResource(owner.apiPath);

      if (cancelled) {
        return;
      }

      if (!result.callWasSuccessful) {
        setTemplate({ error: String(result.error) });

        return;
      }

      const controller = result.response as unknown as {
        spec?: { template?: { spec?: unknown } };
        getOwnerRefs: () => OwnerReference[];
      };

      setTemplate({ spec: controller?.spec?.template?.spec, parent: controller?.getOwnerRefs()[0] });
    })();

    return () => {
      cancelled = true;
    };
  }, [mode, owner, template, requestKubeResource]);

  const renderController = () => {
    if (!owner) {
      return null;
    }

    if (!template) {
      return <span>Loading…</span>;
    }

    if (template.error !== undefined) {
      return <span>{`The ${owner.ref.kind} could not be read: ${template.error}`}</span>;
    }

    const lines = diffLines(toYaml(template.spec).trimEnd().split("\n"), podYaml.trimEnd().split("\n"));

    return (
      <>
        <div className={styles.origin} data-testid="pod-spec-origin">
          {`Created from the pod template of ${owner.ref.kind} ${owner.ref.name}`}
          {template.parent && `, of ${template.parent.kind} ${template.parent.name}`}
        </div>
        <div className={styles.legend}>
          <span className={styles.added}>+ on the pod only</span>
          {" (set when it was created: defaults, admission, the scheduler) · "}
          <span className={styles.removed}>− in the template only</span>
        </div>
        <pre className={styles.diff} data-testid="pod-spec-diff">
          {lines.map((line, index) => (
            <div
              key={index}
              className={cssNames({ [styles.added]: line.kind === "added", [styles.removed]: line.kind === "removed" })}
            >
              {`${line.kind === "added" ? "+" : line.kind === "removed" ? "−" : " "} ${line.text}`}
            </div>
          ))}
        </pre>
      </>
    );
  };

  return (
    <div className={styles.view} data-testid="pod-spec-view">
      {hasTemplate && (
        <div className={styles.modes} role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "controller"}
            className={cssNames(styles.mode, { [styles.active]: mode === "controller" })}
            data-testid="pod-spec-mode-controller"
            onClick={() => setMode("controller")}
          >
            From controller
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "pod"}
            className={cssNames(styles.mode, { [styles.active]: mode === "pod" })}
            data-testid="pod-spec-mode-pod"
            onClick={() => setMode("pod")}
          >
            Pod
          </button>
        </div>
      )}
      {mode === "controller" ? (
        renderController()
      ) : (
        <MonacoEditor readOnly style={{ height: 300, flex: "none" }} value={podYaml} />
      )}
    </div>
  );
}
