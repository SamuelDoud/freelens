/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { Button } from "@freelensapp/button";
import { certificateSigningRequestApiInjectable } from "@freelensapp/kube-api-specifics";
import { showErrorNotificationInjectable } from "@freelensapp/notifications";
import { withInjectables } from "@ogre-tools/injectable-react";
import { observer } from "mobx-react";
import openConfirmDialogInjectable from "../confirm-dialog/open.injectable";
import styles from "./certificate-signing-request-actions.module.scss";

import type { CertificateSigningRequestApi } from "@freelensapp/kube-api";
import type { CertificateSigningRequest } from "@freelensapp/kube-object";
import type { ShowNotification } from "@freelensapp/notifications";

import type { OpenConfirmDialog } from "../confirm-dialog/open.injectable";

interface Dependencies {
  api: CertificateSigningRequestApi;
  openConfirmDialog: OpenConfirmDialog;
  showErrorNotification: ShowNotification;
}

/** Approve and Deny for a request that is still pending, as `kubectl certificate approve|deny` does. */
const NonInjectedCertificateSigningRequestActions = observer(
  ({
    request,
    api,
    openConfirmDialog,
    showErrorNotification,
  }: Dependencies & { request: CertificateSigningRequest }) => {
    if (!request.isPending()) {
      return null;
    }

    const decide = (approved: boolean) =>
      openConfirmDialog({
        labelOk: approved ? "Approve" : "Deny",
        message: (
          <p>
            {approved ? "Approve" : "Deny"} the certificate signing request <b>{request.getName()}</b> of{" "}
            <b>{request.spec?.username}</b> for the signer <b>{request.spec?.signerName}</b>?
          </p>
        ),
        ok: async () => {
          try {
            await api.setApproval(request.getName(), approved);
          } catch (error) {
            showErrorNotification(error instanceof Error ? error.message : String(error));
          }
        },
      });

    return (
      <div className={styles.actions} data-testid="csr-actions">
        <Button primary label="Approve" onClick={() => decide(true)} />
        <Button outlined label="Deny" onClick={() => decide(false)} />
      </div>
    );
  },
);

export const CertificateSigningRequestActions = withInjectables<Dependencies, { request: CertificateSigningRequest }>(
  NonInjectedCertificateSigningRequestActions,
  {
    getProps: (di, props) => ({
      ...props,
      api: di.inject(certificateSigningRequestApiInjectable),
      openConfirmDialog: di.inject(openConfirmDialogInjectable),
      showErrorNotification: di.inject(showErrorNotificationInjectable),
    }),
  },
);
