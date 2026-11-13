/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { ConfigMap } from "@freelensapp/kube-object";
import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDiForUnitTesting } from "../../../getDiForUnitTesting";
import requestKubeResourceInjectable from "../../dock/edit-resource/edit-resource-model/request-kube-resource.injectable";
import { renderFor } from "../../test-utils/renderFor";
import { KubeObjectMeta } from "../kube-object-meta";

import type { KubeMetaField } from "@freelensapp/kube-object";

import type { DiContainer } from "@ogre-tools/injectable";
import type { Mock } from "vitest";

import type { RequestKubeResource } from "../../dock/edit-resource/edit-resource-model/request-kube-resource.injectable";
import type { DiRender } from "../../test-utils/renderFor";

// The namespace link needs a hosted cluster, which is beside the point here.
vi.mock("../../kube-object-link", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  LinkToNamespace: ({ namespace }: { namespace?: string }) => <span>{namespace}</span>,
}));

const lastAppliedConfigurationAnnotation = "kubectl.kubernetes.io/last-applied-configuration";

const createConfigMap = (annotations?: Record<string, string>) =>
  new ConfigMap({
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: "some-config-map",
      namespace: "default",
      resourceVersion: "1",
      selfLink: "/api/v1/namespaces/default/configmaps/some-config-map",
      uid: "some-uid",
      annotations,
    },
    data: {},
  });

describe("<KubeObjectMeta />", () => {
  let di: DiContainer;
  let render: DiRender;

  beforeEach(() => {
    di = getDiForUnitTesting();
    render = renderFor(di);
  });

  const renderMeta = (object: ConfigMap, hideFields?: KubeMetaField[]) =>
    render(<KubeObjectMeta object={object} hideFields={hideFields} />);

  const lastAppliedConfigurationItem = () => screen.queryByText("Last Applied Configuration")?.closest(".DrawerItem");

  const openLastAppliedConfiguration = () => {
    const item = lastAppliedConfigurationItem() as HTMLElement;

    fireEvent.click(within(item).getByTestId("drawer-param-toggler"));

    return within(item).getByRole("textbox") as HTMLTextAreaElement;
  };

  describe("given the last-applied-configuration annotation holds valid JSON", () => {
    const configMap = createConfigMap({
      [lastAppliedConfigurationAnnotation]:
        '{"apiVersion":"v1","kind":"ConfigMap","metadata":{"name":"some-config-map","namespace":"default"},"data":{"key":"value"}}',
      "some-annotation": "some-value",
    });

    it("shows the configuration as YAML", () => {
      renderMeta(configMap);

      expect(openLastAppliedConfiguration().value).toBe(
        [
          "apiVersion: v1",
          "data:",
          "  key: value",
          "kind: ConfigMap",
          "metadata:",
          "  name: some-config-map",
          "  namespace: default",
          "",
        ].join("\n"),
      );
    });

    it("leaves the annotation out of the Annotations list", () => {
      renderMeta(configMap);

      const annotations = screen.getByText("Annotations").closest(".DrawerItem") as HTMLElement;

      expect(within(annotations).getByText("some-annotation=some-value")).toBeInTheDocument();
      expect(within(annotations).queryByText(new RegExp(lastAppliedConfigurationAnnotation))).toBeNull();
    });

    it("hides the configuration together with the annotations", () => {
      renderMeta(configMap, ["annotations"]);

      expect(lastAppliedConfigurationItem()).toBeFalsy();
      expect(screen.queryByText("Annotations")).toBeNull();
    });
  });

  describe("given the last-applied-configuration annotation is not valid JSON", () => {
    it("shows the raw value", () => {
      renderMeta(createConfigMap({ [lastAppliedConfigurationAnnotation]: "{not json" }));

      expect(openLastAppliedConfiguration().value).toBe("{not json");
    });
  });

  describe("given no last-applied-configuration annotation", () => {
    it("does not show the configuration", () => {
      renderMeta(createConfigMap({ "some-annotation": "some-value" }));

      expect(screen.getByText("Annotations")).toBeInTheDocument();
      expect(lastAppliedConfigurationItem()).toBeFalsy();
    });
  });

  describe("managed fields", () => {
    const selfLink = "/api/v1/namespaces/default/configmaps/some-config-map";
    const specFieldSet = { "f:data": { "f:key": {} } };
    const statusFieldSet = { "f:metadata": { "f:labels": {} } };

    const entries = (withFieldSets: boolean) => [
      {
        manager: "kubectl",
        operation: "Update",
        apiVersion: "v1",
        ...(withFieldSets && { fieldsType: "FieldsV1", fieldsV1: specFieldSet }),
      },
      {
        manager: "kubectl",
        operation: "Update",
        apiVersion: "v1",
        subresource: "status",
        ...(withFieldSets && { fieldsType: "FieldsV1", fieldsV1: statusFieldSet }),
      },
    ];

    const createWithManagedFields = (managedFields: unknown[]) =>
      new ConfigMap({
        apiVersion: "v1",
        kind: "ConfigMap",
        metadata: {
          name: "some-config-map",
          namespace: "default",
          resourceVersion: "1",
          selfLink,
          uid: "some-uid",
          managedFields,
        },
        data: {},
      });

    let requestKubeResource: Mock<RequestKubeResource>;

    beforeEach(() => {
      requestKubeResource = vi.fn(async () => ({
        callWasSuccessful: true as const,
        response: createWithManagedFields(entries(true)),
      }));
      di.override(requestKubeResourceInjectable, () => requestKubeResource);
    });

    const openEntry = (index: number) => {
      const item = screen.getByText("Managed Fields").closest(".DrawerItem") as HTMLElement;

      fireEvent.click(within(item).getAllByTestId("drawer-param-toggler")[index]);

      return item;
    };

    it("shows a field set the object carries without reading the object again", () => {
      renderMeta(createWithManagedFields(entries(true)));

      const item = openEntry(1);

      expect((within(item).getByRole("textbox") as HTMLTextAreaElement).value).toBe("f:metadata:\n  f:labels: {}\n");
      expect(requestKubeResource).not.toHaveBeenCalled();
    });

    it("reads the object for a field set a list left out, and shows the matching entry's", async () => {
      renderMeta(createWithManagedFields(entries(false)));

      const item = openEntry(1);

      expect(within(item).getByText("Loading…")).toBeInTheDocument();
      expect(((await within(item).findByRole("textbox")) as HTMLTextAreaElement).value).toBe(
        "f:metadata:\n  f:labels: {}\n",
      );
      expect(requestKubeResource).toHaveBeenCalledWith(selfLink);
    });

    it("reads nothing until an entry is opened", () => {
      renderMeta(createWithManagedFields(entries(false)));

      expect(requestKubeResource).not.toHaveBeenCalled();
    });

    it("says so when the object cannot be read", async () => {
      requestKubeResource.mockResolvedValue({ callWasSuccessful: false, error: "forbidden" });
      renderMeta(createWithManagedFields(entries(false)));

      const item = openEntry(0);

      expect(await within(item).findByText("The managed fields could not be loaded: forbidden")).toBeInTheDocument();
    });
  });
});
