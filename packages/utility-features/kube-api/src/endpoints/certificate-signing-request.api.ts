/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { CertificateSigningRequest } from "@freelensapp/kube-object";
import { KubeApi } from "../kube-api";

import type { DerivedKubeApiOptions, KubeApiDependencies } from "../kube-api";

export class CertificateSigningRequestApi extends KubeApi<CertificateSigningRequest> {
  constructor(deps: KubeApiDependencies, opts?: DerivedKubeApiOptions) {
    super(deps, {
      ...(opts ?? {}),
      objectConstructor: CertificateSigningRequest,
    });
  }

  /**
   * Approves or denies a request, as `kubectl certificate approve` and `deny` do: the request with
   * one more condition is put to its approval subresource.
   */
  async setApproval(name: string, approved: boolean): Promise<CertificateSigningRequest | null> {
    const current = await this.get({ name });

    if (!current) {
      throw new Error(`There is no certificate signing request ${name}.`);
    }

    const condition = {
      type: approved ? "Approved" : "Denied",
      status: "True",
      reason: approved ? "FreelensApprove" : "FreelensDeny",
      message: `${approved ? "Approved" : "Denied"} in Freelens`,
      lastUpdateTime: new Date().toISOString(),
    };
    const request = current.toPlainObject() as { status?: { conditions?: unknown[] } };

    request.status = { ...request.status, conditions: [...(request.status?.conditions ?? []), condition] };

    const response = await this.request.put(`${this.formatUrlForNotListing({ name })}/approval`, { data: request });
    const parsed = this.parseResponse(response);

    return Array.isArray(parsed) ? null : parsed;
  }
}
