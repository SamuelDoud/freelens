/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import asyncFn from "@async-fn/vitest";
import { Deployment, Pod } from "@freelensapp/kube-object";
import { flushPromises } from "@freelensapp/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DeploymentApi, NamespaceApi, PodApi } from "./endpoints";
import { KubeJsonApi } from "./kube-json-api";
import { createMockResponseFromStream, createMockResponseFromString, MockResponseStream } from "./mock-responses";

import type { Fetch as JsonApiFetch } from "@freelensapp/json-api";
import type { KubeJsonApiData, KubeJsonApiDataFor } from "@freelensapp/kube-object";
import type { Logger } from "@freelensapp/logger";

import type { AsyncFnMock } from "@async-fn/vitest";
import type { MockedFunction } from "vitest";

import type { KubeApiWatchCallback } from "./kube-api";
import type { IKubeWatchEvent } from "./kube-watch-event";

describe("KubeApi", () => {
  let fetchMock: AsyncFnMock<JsonApiFetch>;
  let logger: Logger;
  let kubeJsonApi: KubeJsonApi;

  beforeEach(() => {
    fetchMock = asyncFn();

    logger = {
      debug: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
      silly: vi.fn(),
      warn: vi.fn(),
    };

    kubeJsonApi = new KubeJsonApi(
      {
        fetch: fetchMock,
        logger,
      },
      {
        apiBase: "/api-kube",
        serverAddress: "http://127.0.0.1:9999",
      },
      {
        headers: {
          "content-type": "application/json",
        },
      },
    );
  });

  describe("pod logs", () => {
    it.each([false, true])("fetches logs with an optional abort signal (provided: %s)", async (withSignal) => {
      const api = new PodApi({
        logDebug: vi.fn(),
        logError: vi.fn(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        maybeKubeApi: kubeJsonApi,
      });
      const controller = new AbortController();
      const signal = withSignal ? controller.signal : undefined;
      const logs = api.getLogs({ name: "test", namespace: "default" }, { container: "app" }, signal);
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/test/log?container=app";
      expect(fetchMock.mock.lastCall?.[0]).toBe(url);
      expect(fetchMock.mock.lastCall?.[1]?.signal).toBe(signal);

      await fetchMock.resolve(createMockResponseFromString(url, "log line"));
      expect(await logs).toBe("log line");
    });

    it("leaves undefined and null query values out of the URL", async () => {
      const api = new PodApi({
        logDebug: vi.fn(),
        logError: vi.fn(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        maybeKubeApi: kubeJsonApi,
      });
      const logs = api.getLogs(
        { name: "test", namespace: "default" },
        { container: "app", tailLines: 1000, timestamps: undefined, previous: null as never },
      );
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/test/log?container=app&tailLines=1000";
      expect(fetchMock.mock.lastCall?.[0]).toBe(url);

      await fetchMock.resolve(createMockResponseFromString(url, "log line"));
      expect(await logs).toBe("log line");
    });
  });

  describe("query parameters", () => {
    it("keeps false and zero values", async () => {
      const request = kubeJsonApi.getResponse("/api/v1/pods", {
        query: { watch: false, limit: 0, labelSelector: undefined },
      });
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/pods?watch=false&limit=0";
      expect(fetchMock.mock.lastCall?.[0]).toBe(url);

      await fetchMock.resolve(createMockResponseFromString(url, "{}"));
      await request;
    });

    it("adds no query string when every value is undefined", async () => {
      const request = kubeJsonApi.get("/api/v1/pods", { query: { watch: undefined } });
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/pods";
      expect(fetchMock.mock.lastCall?.[0]).toBe(url);

      await fetchMock.resolve(createMockResponseFromString(url, "{}"));
      await request;
    });

    it("adds no question mark to a listing URL when every value is undefined", () => {
      const api = new PodApi({
        logDebug: vi.fn(),
        logError: vi.fn(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        maybeKubeApi: kubeJsonApi,
      });

      expect(api.getUrl({ namespace: "default" }, { resourceVersion: undefined })).toBe(
        "/api/v1/namespaces/default/pods",
      );
    });
  });

  describe("listing pods with pagination", () => {
    let api: PodApi;

    const podData = (name: string) => ({
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name,
        namespace: "default",
        uid: name,
        resourceVersion: "10",
        selfLink: `/api/v1/namespaces/default/pods/${name}`,
      },
    });

    const listPage = (names: string[], metadata: Record<string, unknown> = {}) =>
      JSON.stringify({
        apiVersion: "v1",
        kind: "PodList",
        metadata: { resourceVersion: "10", ...metadata },
        items: names.map(podData),
      });

    beforeEach(() => {
      api = new PodApi({
        logDebug: vi.fn(),
        logError: vi.fn(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        maybeKubeApi: kubeJsonApi,
      });
    });

    it("follows continue tokens and reports each page as it arrives", async () => {
      const onPage = vi.fn();
      const listing = api.list({ pageSize: 2, onPage });
      await flushPromises();

      const firstUrl = "http://127.0.0.1:9999/api-kube/api/v1/pods?limit=2";
      expect(fetchMock.mock.lastCall?.[0]).toBe(firstUrl);

      await fetchMock.resolve(
        createMockResponseFromString(
          firstUrl,
          listPage(["pod-1", "pod-2"], { continue: "next-page", remainingItemCount: 1 }),
        ),
      );
      await flushPromises();

      const secondUrl = "http://127.0.0.1:9999/api-kube/api/v1/pods?limit=2&continue=next-page";
      expect(fetchMock.mock.lastCall?.[0]).toBe(secondUrl);
      expect(onPage).toHaveBeenCalledTimes(1);
      expect(onPage.mock.lastCall?.[0]).toMatchObject({ loaded: 2, remainingItemCount: 1, resourceVersion: "10" });
      expect(onPage.mock.lastCall?.[0].items.map((pod: Pod) => pod.getName())).toEqual(["pod-1", "pod-2"]);

      await fetchMock.resolve(createMockResponseFromString(secondUrl, listPage(["pod-3"])));

      const pods = (await listing) as Pod[];
      expect(pods.map((pod) => pod.getName())).toEqual(["pod-1", "pod-2", "pod-3"]);
      expect(onPage).toHaveBeenCalledTimes(2);
      expect(onPage.mock.lastCall?.[0]).toMatchObject({ loaded: 3 });
    });

    it("does not paginate when the caller sets an explicit limit", async () => {
      const listing = api.list({ pageSize: 2 }, { limit: 1 });
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/pods?limit=1";
      expect(fetchMock.mock.lastCall?.[0]).toBe(url);

      await fetchMock.resolve(createMockResponseFromString(url, listPage(["pod-1"], { continue: "next-page" })));

      const pods = (await listing) as Pod[];
      expect(pods.map((pod) => pod.getName())).toEqual(["pod-1"]);
      expect(fetchMock.mock.calls).toHaveLength(1);
    });

    it("restarts from the first page when a continue token has expired", async () => {
      const listing = api.list({ pageSize: 2 });
      await flushPromises();

      const firstUrl = "http://127.0.0.1:9999/api-kube/api/v1/pods?limit=2";
      await fetchMock.resolve(
        createMockResponseFromString(firstUrl, listPage(["pod-1", "pod-2"], { continue: "stale-token" })),
      );
      await flushPromises();

      const expiredUrl = "http://127.0.0.1:9999/api-kube/api/v1/pods?limit=2&continue=stale-token";
      expect(fetchMock.mock.lastCall?.[0]).toBe(expiredUrl);

      const expired = JSON.stringify({
        apiVersion: "v1",
        kind: "Status",
        code: 410,
        reason: "Expired",
        message: "The provided continue parameter is too old",
      });
      await fetchMock.resolve(createMockResponseFromString(expiredUrl, expired, 410));
      await flushPromises();

      // Restarted without a continue token, discarding the first snapshot.
      expect(fetchMock.mock.lastCall?.[0]).toBe(firstUrl);

      await fetchMock.resolve(
        createMockResponseFromString(firstUrl, listPage(["pod-1", "pod-2"], { continue: "fresh-token" })),
      );
      await flushPromises();

      const freshUrl = "http://127.0.0.1:9999/api-kube/api/v1/pods?limit=2&continue=fresh-token";
      await fetchMock.resolve(createMockResponseFromString(freshUrl, listPage(["pod-3"])));

      const pods = (await listing) as Pod[];
      expect(pods.map((pod) => pod.getName())).toEqual(["pod-1", "pod-2", "pod-3"]);
    });

    it("stops fetching pages when the request is aborted", async () => {
      const controller = new AbortController();
      const listing = api.list({ pageSize: 2, reqInit: { signal: controller.signal } });
      await flushPromises();

      const firstUrl = "http://127.0.0.1:9999/api-kube/api/v1/pods?limit=2";

      controller.abort();

      // Attach the rejection expectation before the page resolves, so the
      // rejection is never momentarily unhandled.
      const expectation = expect(listing).rejects.toMatchObject({ name: "AbortError" });

      await fetchMock.resolve(
        createMockResponseFromString(firstUrl, listPage(["pod-1", "pod-2"], { continue: "next-page" })),
      );

      await expectation;
      expect(fetchMock.mock.calls).toHaveLength(1);
    });
  });

  describe("managed field sets", () => {
    let api: PodApi;

    const managedFields = () => [
      {
        manager: "kubectl",
        operation: "Apply",
        apiVersion: "v1",
        time: "2026-11-13T00:00:00Z",
        fieldsType: "FieldsV1",
        fieldsV1: { "f:spec": { "f:containers": {} } },
      },
      {
        manager: "kubelet",
        operation: "Update",
        apiVersion: "v1",
        subresource: "status",
        fieldsType: "FieldsV1",
        fieldsV1: { "f:status": {} },
      },
    ];

    const podData = (name: string) => ({
      apiVersion: "v1",
      kind: "Pod",
      metadata: {
        name,
        namespace: "default",
        uid: name,
        resourceVersion: "10",
        managedFields: managedFields(),
      },
    });

    const withoutFieldSets = () => managedFields().map(({ fieldsV1: _fieldSet, ...rest }) => rest);

    beforeEach(() => {
      api = new PodApi({
        logDebug: vi.fn(),
        logError: vi.fn(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        maybeKubeApi: kubeJsonApi,
      });
    });

    it("leaves them out of listed objects and keeps the rest of each entry", async () => {
      const listing = api.list();
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/pods";
      await fetchMock.resolve(
        createMockResponseFromString(
          url,
          JSON.stringify({
            apiVersion: "v1",
            kind: "PodList",
            metadata: { resourceVersion: "10" },
            items: [podData("pod-1")],
          }),
        ),
      );

      const [pod] = (await listing) as Pod[];
      expect(pod.metadata.managedFields).toEqual(withoutFieldSets());
    });

    it("keeps them on an object read on its own", async () => {
      const getting = api.get({ name: "pod-1", namespace: "default" });
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/pod-1";
      await fetchMock.resolve(createMockResponseFromString(url, JSON.stringify(podData("pod-1"))));

      const pod = (await getting) as Pod;
      expect(pod.metadata.managedFields).toEqual(managedFields());
    });

    it("leaves them out of watched objects", async () => {
      const stream = new MockResponseStream();
      const callback = vi.fn();
      const stopWatch = api.watch({ namespace: "default", callback });
      await flushPromises();

      const url = "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods?watch=1&timeoutSeconds=600";
      await fetchMock.resolve(createMockResponseFromStream(url, stream));
      stream.push(`${JSON.stringify({ type: "MODIFIED", object: podData("pod-1") })}\n`);
      await flushPromises();

      expect(callback.mock.lastCall?.[0].object.metadata.managedFields).toEqual(withoutFieldSets());

      stopWatch();
      stream.end();
      stream.destroy();
    });
  });

  describe("patching deployments", () => {
    let api: DeploymentApi;

    beforeEach(() => {
      api = new DeploymentApi({
        logDebug: vi.fn(),
        logError: vi.fn(),
        logInfo: vi.fn(),
        logWarn: vi.fn(),
        maybeKubeApi: kubeJsonApi,
      });
    });

    describe("when patching a resource without providing a strategy", () => {
      let patchRequest: Promise<Deployment | null>;

      beforeEach(async () => {
        patchRequest = api.patch(
          { name: "test", namespace: "default" },
          {
            spec: { replicas: 2 },
          },
        );

        // This is needed because of how JS promises work
        await flushPromises();
      });

      it("requests a patch using strategic merge", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test",
          {
            headers: {
              "content-type": "application/strategic-merge-patch+json",
            },
            method: "PATCH",
            body: JSON.stringify({ spec: { replicas: 2 } }),
          },
        ]);
      });

      describe("when the patch request resolves with data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test",
              JSON.stringify({
                apiVersion: "v1",
                kind: "Deployment",
                metadata: {
                  name: "test",
                  namespace: "default",
                  resourceVersion: "1",
                  uid: "12345",
                },
                spec: {
                  replicas: 2,
                },
              }),
            ),
          );
        });

        it("resolves the patch call", async () => {
          expect(await patchRequest).toBeInstanceOf(Deployment);
        });
      });
    });

    describe("when patching a resource using json patch", () => {
      let patchRequest: Promise<Deployment | null>;

      beforeEach(async () => {
        patchRequest = api.patch(
          { name: "test", namespace: "default" },
          [{ op: "replace", path: "/spec/replicas", value: 2 }],
          "json",
        );

        // This is needed because of how JS promises work
        await flushPromises();
      });

      it("requests a patch using json merge", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test",
          {
            headers: {
              "content-type": "application/json-patch+json",
            },
            method: "PATCH",
            body: JSON.stringify([{ op: "replace", path: "/spec/replicas", value: 2 }]),
          },
        ]);
      });

      describe("when the patch request resolves with data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test",
              JSON.stringify({
                apiVersion: "v1",
                kind: "Deployment",
                metadata: {
                  name: "test",
                  namespace: "default",
                  resourceVersion: "1",
                  uid: "12345",
                },
                spec: {
                  replicas: 2,
                },
              }),
            ),
          );
        });

        it("resolves the patch call", async () => {
          expect(await patchRequest).toBeInstanceOf(Deployment);
        });
      });
    });

    describe("when patching a resource using merge patch", () => {
      let patchRequest: Promise<Deployment | null>;

      beforeEach(async () => {
        patchRequest = api.patch(
          { name: "test", namespace: "default" },
          { metadata: { annotations: { provisioned: "True" } } },
          "merge",
        );

        // This is needed because of how JS promises work
        await flushPromises();
      });

      it("requests a patch using json merge", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test",
          {
            headers: {
              "content-type": "application/merge-patch+json",
            },
            method: "PATCH",
            body: JSON.stringify({ metadata: { annotations: { provisioned: "True" } } }),
          },
        ]);
      });

      describe("when the patch request resolves with data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/apis/apps/v1/namespaces/default/deployments/test",
              JSON.stringify({
                apiVersion: "v1",
                kind: "Deployment",
                metadata: {
                  name: "test",
                  namespace: "default",
                  resourceVersion: "1",
                  uid: "12345",
                  annotations: {
                    provisioned: "True",
                  },
                },
              }),
            ),
          );
        });

        it("resolves the patch call", async () => {
          expect(await patchRequest).toBeInstanceOf(Deployment);
        });
      });
    });
  });

  describe("deleting pods (namespace scoped resource)", () => {
    let api: PodApi;

    beforeEach(() => {
      api = new PodApi({
        logDebug: logger.debug,
        logError: logger.error,
        logInfo: logger.info,
        logWarn: logger.error,
        maybeKubeApi: kubeJsonApi,
      });
    });

    describe("when deleting by just name", () => {
      let deleteRequest: Promise<KubeJsonApiData>;

      beforeEach(async () => {
        deleteRequest = api.delete({ name: "foo" });

        // This is required for how JS promises work
        await flushPromises();
      });

      it("requests deleting pod in default namespace", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo?propagationPolicy=Background",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "DELETE",
          },
        ]);
      });

      describe("when request resolves", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo?propagationPolicy=Background"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo?propagationPolicy=Background",
              "{}",
            ),
          );
        });

        it("resolves the call", async () => {
          expect(await deleteRequest).toBeDefined();
        });
      });
    });

    describe("when deleting by name and empty namespace", () => {
      let deleteRequest: Promise<KubeJsonApiData>;

      beforeEach(async () => {
        deleteRequest = api.delete({ name: "foo", namespace: "" });

        // This is required for how JS promises work
        await flushPromises();
      });

      it("requests deleting pod in default namespace", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo?propagationPolicy=Background",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "DELETE",
          },
        ]);
      });

      describe("when request resolves", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo?propagationPolicy=Background"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo?propagationPolicy=Background",
              "{}",
            ),
          );
        });

        it("resolves the call", async () => {
          expect(await deleteRequest).toBeDefined();
        });
      });
    });

    describe("when deleting by name and namespace", () => {
      let deleteRequest: Promise<KubeJsonApiData>;

      beforeEach(async () => {
        deleteRequest = api.delete({ name: "foo", namespace: "test" });

        // This is required for how JS promises work
        await flushPromises();
      });

      it("requests deleting pod in given namespace", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/test/pods/foo?propagationPolicy=Background",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "DELETE",
          },
        ]);
      });

      describe("when request resolves", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/test/pods/foo?propagationPolicy=Background"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/test/pods/foo?propagationPolicy=Background",
              "{}",
            ),
          );
        });

        it("resolves the call", async () => {
          expect(await deleteRequest).toBeDefined();
        });
      });
    });

    describe("when deleting with finalizers", () => {
      const podUrl = "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foo";
      let deleteRequest: Promise<KubeJsonApiData>;

      beforeEach(async () => {
        deleteRequest = api.deleteWithFinalizers({ name: "foo", namespace: "default" });

        // This is required for how JS promises work
        await flushPromises();
      });

      it("clears the finalizers with a JSON merge patch", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          podUrl,
          {
            headers: {
              "content-type": "application/merge-patch+json",
            },
            method: "PATCH",
            body: JSON.stringify({ metadata: { finalizers: [] } }),
          },
        ]);
      });

      describe("when the patch request resolves", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            [podUrl],
            createMockResponseFromString(
              podUrl,
              JSON.stringify({
                apiVersion: "v1",
                kind: "Pod",
                metadata: {
                  name: "foo",
                  namespace: "default",
                  resourceVersion: "1",
                  uid: "12345",
                  finalizers: [],
                },
              }),
            ),
          );
        });

        it("force deletes the pod", () => {
          expect(fetchMock.mock.lastCall).toMatchObject([
            `${podUrl}?propagationPolicy=Background`,
            {
              method: "DELETE",
              body: JSON.stringify({
                kind: "DeleteOptions",
                apiVersion: "v1",
                gracePeriodSeconds: 0,
                propagationPolicy: "Background",
              }),
            },
          ]);
        });

        it("resolves the call", async () => {
          await fetchMock.resolveSpecific(
            [`${podUrl}?propagationPolicy=Background`],
            createMockResponseFromString(`${podUrl}?propagationPolicy=Background`, "{}"),
          );

          expect(await deleteRequest).toBeDefined();
        });
      });
    });
  });

  describe("deleting namespaces (cluster scoped resource)", () => {
    let api: NamespaceApi;

    beforeEach(() => {
      api = new NamespaceApi({
        logDebug: logger.debug,
        logError: logger.error,
        logInfo: logger.info,
        logWarn: logger.error,
        maybeKubeApi: kubeJsonApi,
      });
    });

    describe("when deleting by just name", () => {
      let deleteRequest: Promise<KubeJsonApiData>;

      beforeEach(async () => {
        deleteRequest = api.delete({ name: "foo" });

        // This is required for how JS promises work
        await flushPromises();
      });

      it("requests deleting Namespace without namespace", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/foo?propagationPolicy=Background",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "DELETE",
          },
        ]);
      });

      describe("when request resolves", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/foo?propagationPolicy=Background"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/foo?propagationPolicy=Background",
              "{}",
            ),
          );
        });

        it("resolves the call", async () => {
          expect(await deleteRequest).toBeDefined();
        });
      });
    });

    describe("when deleting by name and empty namespace", () => {
      let deleteRequest: Promise<KubeJsonApiData>;

      beforeEach(async () => {
        deleteRequest = api.delete({ name: "foo", namespace: "" });

        // This is required for how JS promises work
        await flushPromises();
      });

      it("requests deleting Namespace without namespace", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/foo?propagationPolicy=Background",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "DELETE",
          },
        ]);
      });

      describe("when request resolves", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/foo?propagationPolicy=Background"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/foo?propagationPolicy=Background",
              "{}",
            ),
          );
        });

        it("resolves the call", async () => {
          expect(await deleteRequest).toBeDefined();
        });
      });
    });
  });

  describe("watching pods", () => {
    let api: PodApi;
    let stream: MockResponseStream;

    beforeEach(() => {
      api = new PodApi({
        logDebug: logger.debug,
        logError: logger.error,
        logInfo: logger.info,
        logWarn: logger.error,
        maybeKubeApi: kubeJsonApi,
      });
      stream = new MockResponseStream();
    });

    afterEach(() => {
      stream.end();
      stream.destroy();
    });

    describe("when watching in a namespace", () => {
      let stopWatch: () => void;
      let callback: MockedFunction<KubeApiWatchCallback>;

      beforeEach(async () => {
        callback = vi.fn();
        stopWatch = api.watch({
          namespace: "kube-system",
          callback,
        });

        await flushPromises();
      });

      afterEach(async () => {
        stopWatch();
      });

      it("requests the watch", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=600",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "GET",
          },
        ]);
      });

      describe("when the request resolves with a stream", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ([url, init]) => {
              const isMatch =
                url === "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=600";

              if (isMatch) {
                init?.signal?.addEventListener("abort", () => {
                  stream.destroy();
                });
              }

              return isMatch;
            },
            createMockResponseFromStream(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=600",
              stream,
            ),
          );
        });

        describe("when some data comes back on the stream", () => {
          beforeEach(async () => {
            stream.push(
              `${JSON.stringify({
                type: "ADDED",
                object: {
                  apiVersion: "v1",
                  kind: "Pod",
                  metadata: {
                    name: "foobar",
                    namespace: "kube-system",
                    resourceVersion: "1",
                    uid: "123456",
                  },
                },
              } as IKubeWatchEvent<KubeJsonApiDataFor<Pod>>)}\n`,
            );

            // The body is a `ReadableStream`, so the watch reads it a chunk at
            // a time off the microtask queue rather than on a sync `data` event.
            await flushPromises();
          });

          it("calls the callback with the data", () => {
            expect(callback).toBeCalledWith(
              {
                type: "ADDED",
                object: {
                  apiVersion: "v1",
                  kind: "Pod",
                  metadata: {
                    name: "foobar",
                    namespace: "kube-system",
                    resourceVersion: "1",
                    selfLink: "/api/v1/namespaces/kube-system/pods/foobar",
                    uid: "123456",
                  },
                },
              },
              null,
            );
          });

          describe("when stopping the watch", () => {
            beforeEach(() => {
              stopWatch();
            });

            it("closes the stream", () => {
              expect(stream.destroyed).toBe(true);
            });
          });
        });
      });
    });

    describe("when watching in a namespace with an abort controller provided", () => {
      let callback: MockedFunction<KubeApiWatchCallback>;
      let abortController: AbortController;

      beforeEach(async () => {
        callback = vi.fn();
        abortController = new AbortController();
        api.watch({
          namespace: "kube-system",
          callback,
          abortController,
        });

        await flushPromises();
      });

      it("requests the watch", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=600",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "GET",
          },
        ]);
      });

      describe("when the request resolves with a stream", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ([url, init]) => {
              const isMatch =
                url === "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=600";

              if (isMatch) {
                init?.signal?.addEventListener("abort", () => {
                  stream.destroy();
                });
              }

              return isMatch;
            },
            createMockResponseFromStream(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=600",
              stream,
            ),
          );
        });

        describe("when some data comes back on the stream", () => {
          beforeEach(async () => {
            stream.push(
              `${JSON.stringify({
                type: "ADDED",
                object: {
                  apiVersion: "v1",
                  kind: "Pod",
                  metadata: {
                    name: "foobar",
                    namespace: "kube-system",
                    resourceVersion: "1",
                    uid: "123456",
                  },
                },
              } as IKubeWatchEvent<KubeJsonApiDataFor<Pod>>)}\n`,
            );

            // The body is a `ReadableStream`, so the watch reads it a chunk at
            // a time off the microtask queue rather than on a sync `data` event.
            await flushPromises();
          });

          it("calls the callback with the data", () => {
            expect(callback).toBeCalledWith(
              {
                type: "ADDED",
                object: {
                  apiVersion: "v1",
                  kind: "Pod",
                  metadata: {
                    name: "foobar",
                    namespace: "kube-system",
                    resourceVersion: "1",
                    selfLink: "/api/v1/namespaces/kube-system/pods/foobar",
                    uid: "123456",
                  },
                },
              },
              null,
            );
          });

          describe("when stopping the watch via the controller", () => {
            beforeEach(() => {
              abortController.abort();
            });

            it("closes the stream", () => {
              expect(stream.destroyed).toBe(true);
            });
          });
        });
      });
    });

    describe("when watching in a namespace with a timeout", () => {
      let stopWatch: () => void;
      let callback: MockedFunction<KubeApiWatchCallback>;

      beforeEach(async () => {
        callback = vi.fn();
        stopWatch = api.watch({
          namespace: "kube-system",
          callback,
          timeout: 60,
        });

        await flushPromises();
      });

      it("requests the watch", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=60",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "GET",
          },
        ]);
      });

      describe("when the request resolves with a stream", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ([url, init]) => {
              const isMatch =
                url === "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=60";

              if (isMatch) {
                init?.signal?.addEventListener("abort", () => {
                  stream.destroy();
                });
              }

              return isMatch;
            },
            createMockResponseFromStream(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=60",
              stream,
            ),
          );
        });

        describe("when some data comes back on the stream", () => {
          beforeEach(async () => {
            stream.push(
              `${JSON.stringify({
                type: "ADDED",
                object: {
                  apiVersion: "v1",
                  kind: "Pod",
                  metadata: {
                    name: "foobar",
                    namespace: "kube-system",
                    resourceVersion: "1",
                    uid: "123456",
                  },
                },
              } as IKubeWatchEvent<KubeJsonApiDataFor<Pod>>)}\n`,
            );

            // The body is a `ReadableStream`, so the watch reads it a chunk at
            // a time off the microtask queue rather than on a sync `data` event.
            await flushPromises();
          });

          it("calls the callback with the data", () => {
            expect(callback).toBeCalledWith(
              {
                type: "ADDED",
                object: {
                  apiVersion: "v1",
                  kind: "Pod",
                  metadata: {
                    name: "foobar",
                    namespace: "kube-system",
                    resourceVersion: "1",
                    selfLink: "/api/v1/namespaces/kube-system/pods/foobar",
                    uid: "123456",
                  },
                },
              },
              null,
            );
          });

          describe("when stopping the watch", () => {
            beforeEach(() => {
              stopWatch();
            });

            it("closes the stream", () => {
              expect(stream.destroyed).toBe(true);
            });
          });

          describe("when the watch ends", () => {
            beforeEach(() => {
              stream.end();
            });

            it("requests a new watch", () => {
              expect(fetchMock.mock.lastCall).toMatchObject([
                "http://127.0.0.1:9999/api-kube/api/v1/namespaces/kube-system/pods?watch=1&timeoutSeconds=60",
                {
                  headers: {
                    "content-type": "application/json",
                  },
                  method: "GET",
                },
              ]);
            });

            describe("when stopping the watch", () => {
              beforeEach(() => {
                stopWatch();
              });

              it("closes the stream", () => {
                expect(stream.destroyed).toBe(true);
              });
            });
          });
        });
      });
    });
  });

  describe("creating pods", () => {
    let api: PodApi;

    beforeEach(() => {
      api = new PodApi({
        logDebug: logger.debug,
        logError: logger.error,
        logInfo: logger.info,
        logWarn: logger.error,
        maybeKubeApi: kubeJsonApi,
      });
    });

    describe("when creating a pod", () => {
      let createRequest: Promise<Pod | null>;

      beforeEach(async () => {
        createRequest = api.create(
          {
            name: "foobar",
            namespace: "default",
          },
          {
            metadata: {
              labels: {
                foo: "bar",
              },
            },
            spec: {
              containers: [
                {
                  name: "web",
                  image: "nginx",
                  ports: [
                    {
                      name: "web",
                      containerPort: 80,
                      protocol: "TCP",
                    },
                  ],
                },
              ],
            },
          },
        );

        // This is required because of how JS promises work
        await flushPromises();
      });

      it("should request to create a pod with full descriptor", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "POST",
            body: JSON.stringify({
              metadata: {
                labels: {
                  foo: "bar",
                },
                name: "foobar",
                namespace: "default",
              },
              spec: {
                containers: [
                  {
                    name: "web",
                    image: "nginx",
                    ports: [
                      {
                        name: "web",
                        containerPort: 80,
                        protocol: "TCP",
                      },
                    ],
                  },
                ],
              },
              kind: "Pod",
              apiVersion: "v1",
            }),
          },
        ]);
      });

      describe("when request resolves with data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods",
              JSON.stringify({
                kind: "Pod",
                apiVersion: "v1",
                metadata: {
                  name: "foobar",
                  namespace: "default",
                  labels: {
                    foo: "bar",
                  },
                  resourceVersion: "1",
                  uid: "123456798",
                },
                spec: {
                  containers: [
                    {
                      name: "web",
                      image: "nginx",
                      ports: [
                        {
                          name: "web",
                          containerPort: 80,
                          protocol: "TCP",
                        },
                      ],
                    },
                  ],
                },
              }),
            ),
          );
        });

        it("call should resolve in a Pod instance", async () => {
          expect(await createRequest).toBeInstanceOf(Pod);
        });
      });
    });
  });

  describe("updating pods", () => {
    let api: PodApi;

    beforeEach(() => {
      api = new PodApi({
        logDebug: logger.debug,
        logError: logger.error,
        logInfo: logger.info,
        logWarn: logger.error,
        maybeKubeApi: kubeJsonApi,
      });
    });

    describe("when updating a pod", () => {
      let updateRequest: Promise<Pod | null>;

      beforeEach(async () => {
        updateRequest = api.update(
          {
            name: "foobar",
            namespace: "default",
          },
          {
            kind: "Pod",
            apiVersion: "v1",
            metadata: {
              labels: {
                foo: "bar",
              },
            },
            spec: {
              containers: [
                {
                  name: "web",
                  image: "nginx",
                  ports: [
                    {
                      name: "web",
                      containerPort: 80,
                      protocol: "TCP",
                    },
                  ],
                },
              ],
            },
          },
        );

        await flushPromises();
      });

      it("should request that the pod is updated", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foobar",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "PUT",
            body: JSON.stringify({
              kind: "Pod",
              apiVersion: "v1",
              metadata: {
                labels: {
                  foo: "bar",
                },
                name: "foobar",
                namespace: "default",
              },
              spec: {
                containers: [
                  {
                    name: "web",
                    image: "nginx",
                    ports: [
                      {
                        name: "web",
                        containerPort: 80,
                        protocol: "TCP",
                      },
                    ],
                  },
                ],
              },
            }),
          },
        ]);
      });

      describe("when the request resolves with data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foobar"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods/foobar",
              JSON.stringify({
                kind: "Pod",
                apiVersion: "v1",
                metadata: {
                  name: "foobar",
                  namespace: "default",
                  labels: {
                    foo: "bar",
                  },
                  resourceVersion: "1",
                  uid: "123456798",
                },
                spec: {
                  containers: [
                    {
                      name: "web",
                      image: "nginx",
                      ports: [
                        {
                          name: "web",
                          containerPort: 80,
                          protocol: "TCP",
                        },
                      ],
                    },
                  ],
                },
              }),
            ),
          );
        });

        it("the call should resolve to a Pod", async () => {
          expect(await updateRequest).toBeInstanceOf(Pod);
        });
      });
    });
  });

  describe("listing pods", () => {
    let api: PodApi;

    beforeEach(() => {
      api = new PodApi({
        logDebug: logger.debug,
        logError: logger.error,
        logInfo: logger.info,
        logWarn: logger.error,
        maybeKubeApi: kubeJsonApi,
      });
    });

    describe("when listing pods with no descriptor", () => {
      let listRequest: Promise<Pod[] | null>;

      beforeEach(async () => {
        listRequest = api.list();

        await flushPromises();
      });

      it("should request that the pods from all namespaces", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/pods",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "GET",
          },
        ]);
      });

      describe("when the request resolves with empty data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/pods"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/pods",
              JSON.stringify({
                kind: "PodList",
                apiVersion: "v1",
                metadata: {},
                items: [],
              }),
            ),
          );
        });

        it("the call should resolve to an empty list", async () => {
          expect(await listRequest).toEqual([]);
        });
      });
    });

    describe("when listing pods with descriptor with namespace=''", () => {
      let listRequest: Promise<Pod[] | null>;

      beforeEach(async () => {
        listRequest = api.list({
          namespace: "",
        });

        await flushPromises();
      });

      it("should request that the pods from all namespaces", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/pods",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "GET",
          },
        ]);
      });

      describe("when the request resolves with empty data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/pods"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/pods",
              JSON.stringify({
                kind: "PodList",
                apiVersion: "v1",
                metadata: {},
                items: [],
              }),
            ),
          );
        });

        it("the call should resolve to an empty list", async () => {
          expect(await listRequest).toEqual([]);
        });
      });
    });

    describe("when listing pods with descriptor with namespace='default'", () => {
      let listRequest: Promise<Pod[] | null>;

      beforeEach(async () => {
        listRequest = api.list({
          namespace: "default",
        });

        await flushPromises();
      });

      it("should request that the pods from just the default namespace", () => {
        expect(fetchMock.mock.lastCall).toMatchObject([
          "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods",
          {
            headers: {
              "content-type": "application/json",
            },
            method: "GET",
          },
        ]);
      });

      describe("when the request resolves with empty data", () => {
        beforeEach(async () => {
          await fetchMock.resolveSpecific(
            ["http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods"],
            createMockResponseFromString(
              "http://127.0.0.1:9999/api-kube/api/v1/namespaces/default/pods",
              JSON.stringify({
                kind: "PodList",
                apiVersion: "v1",
                metadata: {},
                items: [],
              }),
            ),
          );
        });

        it("the call should resolve to an empty list", async () => {
          expect(await listRequest).toEqual([]);
        });
      });
    });
  });
});
