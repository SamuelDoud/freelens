/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { KubeObject } from "@freelensapp/kube-object";
import { loggerInjectionToken } from "@freelensapp/logger";
import { Link } from "@freelensapp/routing";
import { withInjectables } from "@ogre-tools/injectable-react";
import * as yaml from "js-yaml";
import { observer } from "mobx-react";
import { useEffect, useState } from "react";
import apiManagerInjectable from "../../../common/k8s-api/api-manager/manager.injectable";
import { defaultYamlDumpOptions } from "../../../common/kube-helpers";
import requestKubeResourceInjectable from "../dock/edit-resource/edit-resource-model/request-kube-resource.injectable";
import { DrawerItem, DrawerItemLabels, DrawerParamToggler } from "../drawer";
import { DurationAbsoluteTimestamp } from "../events";
import getDetailsUrlInjectable from "../kube-detail-params/get-details-url.injectable";
import { KubeObjectAge } from "../kube-object/age";
import { LinkToNamespace } from "../kube-object-link";
import { LocaleDate } from "../locale-date";
import { MonacoEditor } from "../monaco-editor";
import { WithTooltip } from "../with-tooltip";

import type { KubeMetaField } from "@freelensapp/kube-object";
import type { Logger } from "@freelensapp/logger";

import type { ApiManager } from "../../../common/k8s-api/api-manager";
import type { RequestKubeResource } from "../dock/edit-resource/edit-resource-model/request-kube-resource.injectable";
import type { GetDetailsUrl } from "../kube-detail-params/get-details-url.injectable";

interface ManagedFieldsEntry {
  manager: string;
  operation: "Apply" | "Update";
  apiVersion?: string;
  time?: string;
  fieldsType?: string;
  fieldsV1?: unknown;
  subresource?: string;
}

export interface KubeObjectMetaProps {
  object: KubeObject;
  hideFields?: KubeMetaField[];
}

interface Dependencies {
  getDetailsUrl: GetDetailsUrl;
  apiManager: ApiManager;
  logger: Logger;
  requestKubeResource: RequestKubeResource;
}

const lastAppliedConfigurationAnnotation = "kubectl.kubernetes.io/last-applied-configuration";

/**
 * `kubectl apply` stores the manifest as JSON; show it as YAML, like the rest of the resource.
 * A value that is not valid JSON is shown as it is.
 */
function formatLastAppliedConfiguration(value: string): string {
  try {
    return yaml.dump(JSON.parse(value), defaultYamlDumpOptions);
  } catch {
    return value;
  }
}

function ManagedFieldEntryLabel({ entry }: { entry: ManagedFieldsEntry }) {
  return (
    <WithTooltip tooltip={entry.time && <DurationAbsoluteTimestamp timestamp={entry.time} />}>
      {entry.manager}
      {": "}
      {entry.operation}
      {entry.subresource && ` (${entry.subresource})`}
    </WithTooltip>
  );
}

const isManagedFieldsEntry = (entry: unknown): entry is ManagedFieldsEntry =>
  typeof entry === "object" &&
  entry !== null &&
  "manager" in entry &&
  typeof entry.manager === "string" &&
  entry.manager.length > 0 &&
  "operation" in entry &&
  typeof entry.operation === "string" &&
  entry.operation.length > 0;

// The apiserver identifies a managed-fields entry by manager, operation,
// apiVersion and subresource.
const isSameManagedFieldsEntry = (left: ManagedFieldsEntry, right: ManagedFieldsEntry) =>
  left.manager === right.manager &&
  left.operation === right.operation &&
  left.apiVersion === right.apiVersion &&
  left.subresource === right.subresource;

interface ManagedFieldSetProps {
  entry: ManagedFieldsEntry;
  selfLink: string;
  requestKubeResource: RequestKubeResource;
}

/**
 * The fields one manager owns. Lists and watches leave the field sets out of
 * the objects they deliver, so an entry without one reads the object on its
 * own, which keeps them, when it is first shown.
 */
function ManagedFieldSet({ entry, selfLink, requestKubeResource }: ManagedFieldSetProps) {
  const hasFieldSet = "fieldsV1" in entry;
  const [loaded, setLoaded] = useState<{ fieldsV1?: unknown; error?: string }>();

  useEffect(() => {
    if (hasFieldSet) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const result = await requestKubeResource(selfLink);

      if (cancelled) {
        return;
      }

      if (!result.callWasSuccessful) {
        setLoaded({ error: String(result.error) });

        return;
      }

      const match = (result.response?.metadata.managedFields ?? [])
        .filter(isManagedFieldsEntry)
        .find((candidate) => isSameManagedFieldsEntry(candidate, entry));

      setLoaded({ fieldsV1: match?.fieldsV1 });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasFieldSet, selfLink, entry, requestKubeResource]);

  if (!hasFieldSet && !loaded) {
    return <span>Loading…</span>;
  }

  if (loaded?.error !== undefined) {
    return <span>{`The managed fields could not be loaded: ${loaded.error}`}</span>;
  }

  const fieldsV1 = hasFieldSet ? entry.fieldsV1 : loaded?.fieldsV1;

  return <MonacoEditor readOnly style={{ height: 200 }} value={yaml.dump(fieldsV1 ?? {}, defaultYamlDumpOptions)} />;
}

const NonInjectedKubeObjectMeta = observer((props: Dependencies & KubeObjectMetaProps) => {
  const {
    apiManager,
    getDetailsUrl,
    object,
    hideFields = ["uid", "resourceVersion", "selfLink"],
    logger,
    requestKubeResource,
  } = props;

  if (!object) {
    return null;
  }

  if (!(object instanceof KubeObject)) {
    logger.error("[KubeObjectMeta]: passed object that is not an instanceof KubeObject", object);

    return null;
  }

  const isHidden = (field: KubeMetaField) => hideFields.includes(field);

  const {
    selfLink,
    metadata: { creationTimestamp, deletionTimestamp, managedFields, annotations },
  } = object;
  const lastAppliedConfiguration = annotations?.[lastAppliedConfigurationAnnotation];
  const ownerRefs = object.getOwnerRefs();
  const namespace = object.getNs();

  return (
    <>
      <DrawerItem name="Created" hidden={isHidden("creationTimestamp") || !creationTimestamp}>
        <KubeObjectAge object={object} compact={false} withTooltip={false} />
        {" ago "}
        {creationTimestamp && (
          <>
            {"("}
            <LocaleDate date={creationTimestamp} />
            {")"}
          </>
        )}
      </DrawerItem>
      <DrawerItem name="Deleted" hidden={isHidden("deletionTimestamp") || !deletionTimestamp}>
        <DurationAbsoluteTimestamp timestamp={deletionTimestamp} />
      </DrawerItem>
      <DrawerItem name="Name" hidden={isHidden("name")}>
        {object.getName()}
      </DrawerItem>
      <DrawerItem name="Namespace" hidden={isHidden("namespace") || !namespace}>
        <LinkToNamespace namespace={namespace} />
      </DrawerItem>
      <DrawerItem name="UID" hidden={isHidden("uid")}>
        {object.getId()}
      </DrawerItem>
      <DrawerItem name="Link" hidden={isHidden("selfLink")}>
        {selfLink}
      </DrawerItem>
      <DrawerItem name="Resource Version" hidden={isHidden("resourceVersion")}>
        {object.getResourceVersion()}
      </DrawerItem>
      <DrawerItemLabels name="Labels" labels={object.getLabels()} hidden={isHidden("labels")} />
      <DrawerItemLabels name="Annotations" labels={object.getAnnotations(true)} hidden={isHidden("annotations")} />
      {lastAppliedConfiguration !== undefined && (
        <DrawerItem name="Last Applied Configuration" hidden={isHidden("annotations")}>
          <DrawerParamToggler label={lastAppliedConfigurationAnnotation}>
            <MonacoEditor
              readOnly
              style={{ height: 200 }}
              value={formatLastAppliedConfiguration(lastAppliedConfiguration)}
            />
          </DrawerParamToggler>
        </DrawerItem>
      )}
      <DrawerItemLabels name="Finalizers" labels={object.getFinalizers()} hidden={isHidden("finalizers")} />
      {ownerRefs?.length > 0 && (
        <DrawerItem name="Controlled By" hidden={isHidden("ownerReferences")}>
          {ownerRefs.map((ref) => (
            <p key={ref.name}>
              {`${ref.kind} `}
              <Link to={getDetailsUrl(apiManager.lookupApiLink(ref, object))}>{ref.name}</Link>
            </p>
          ))}
        </DrawerItem>
      )}
      {managedFields && managedFields.length > 0 && (
        <DrawerItem name="Managed Fields" hidden={isHidden("managedFields")}>
          {managedFields.filter(isManagedFieldsEntry).map((entry) => (
            // The apiserver identifies a managed-fields entry by manager, operation,
            // apiVersion and subresource, so that tuple is the entry's key. Manager and
            // operation alone are not unique — a manager typically owns both a plain
            // Update and an Update of the status subresource.
            <DrawerParamToggler
              label={<ManagedFieldEntryLabel entry={entry} />}
              key={`${entry.manager}-${entry.operation}-${entry.apiVersion ?? ""}-${entry.subresource ?? ""}`}
            >
              <ManagedFieldSet entry={entry} selfLink={selfLink} requestKubeResource={requestKubeResource} />
            </DrawerParamToggler>
          ))}
        </DrawerItem>
      )}
    </>
  );
});

export const KubeObjectMeta = withInjectables<Dependencies, KubeObjectMetaProps>(NonInjectedKubeObjectMeta, {
  getProps: (di, props) => ({
    ...props,
    getDetailsUrl: di.inject(getDetailsUrlInjectable),
    apiManager: di.inject(apiManagerInjectable),
    logger: di.inject(loggerInjectionToken),
    // Injected on first use: the request needs apiKube, which only a cluster
    // frame has, and most uses of this component never read a field set.
    requestKubeResource: (selfLink) => di.inject(requestKubeResourceInjectable)(selfLink),
  }),
});
