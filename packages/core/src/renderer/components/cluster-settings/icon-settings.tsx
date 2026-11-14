/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Copyright (c) OpenLens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import {
  clusterIconSettingsComponentInjectionToken,
  clusterIconSettingsMenuInjectionToken,
} from "@freelensapp/cluster-settings";
import { showErrorNotificationInjectable } from "@freelensapp/notifications";
import { computedInjectManyInjectionToken } from "@ogre-tools/injectable-extension-for-mobx";
import { withInjectables } from "@ogre-tools/injectable-react";
import Color from "color";
import { observer } from "mobx-react";
import React from "react";
import { computeDefaultShortName } from "../../../common/catalog/helpers";
import { Avatar, contrastingTextColor } from "../avatar";
import { seededColor } from "../avatar/seeded-color";
import { FilePicker, OverSizeLimitStyle } from "../file-picker";
import { Input } from "../input";
import { MenuActions, MenuItem } from "../menu";

import type { ClusterIconMenuItem, ClusterIconSettingsComponent } from "@freelensapp/cluster-settings";
import type { ShowNotification } from "@freelensapp/notifications";

import type { IComputedValue } from "mobx";

import type { KubernetesCluster } from "../../../common/catalog-entities";
import type { Cluster } from "../../../common/cluster/cluster";

export interface ClusterIconSettingProps {
  cluster: Cluster;
  entity: KubernetesCluster;
}

interface Dependencies {
  menuItems: IComputedValue<ClusterIconMenuItem[]>;
  settingComponents: IComputedValue<ClusterIconSettingsComponent[]>;
  showErrorNotification: ShowNotification;
}

const NonInjectedClusterIconSetting = observer((props: ClusterIconSettingProps & Dependencies) => {
  const element = React.createRef<HTMLDivElement>();
  const { cluster, entity } = props;
  const menuId = `menu-actions-for-cluster-icon-settings-for-${entity.getId()}`;

  const onIconPick = async ([file]: File[]) => {
    if (!file) {
      return;
    }

    try {
      const buf = Buffer.from(await file.arrayBuffer());

      cluster.preferences.icon = `data:${file.type};base64,${buf.toString("base64")}`;
    } catch (e) {
      props.showErrorNotification(String(e));
    }
  };

  const name = entity.getName();
  const colorHash = `${name}-${entity.metadata.source}`;
  const { iconText, iconBackground, iconTextColor } = cluster.preferences;
  const background = iconBackground || entity.spec.icon?.background || seededColor(colorHash);
  const asHex = (color: string) => {
    try {
      return Color(color).hex();
    } catch {
      return "#808080";
    }
  };

  const onUploadClick = () => {
    element.current?.querySelector<HTMLInputElement>("input[type=file]")?.click();
  };

  return (
    <div ref={element}>
      <div className="file-loader flex flex-row items-center">
        <div className="mr-5">
          <FilePicker
            accept="image/*"
            label={
              <Avatar
                colorHash={colorHash}
                title={name}
                src={entity.spec.icon?.src}
                size={53}
                background={iconBackground || entity.spec.icon?.background}
                text={iconText?.trim() || undefined}
                color={iconTextColor}
                data-testid="cluster-icon-preview"
              />
            }
            onOverSizeLimit={OverSizeLimitStyle.FILTER}
            handler={onIconPick}
          />
        </div>
        <MenuActions
          id={menuId}
          data-testid={menuId}
          toolbar={false}
          autoCloseOnSelect={true}
          triggerIcon={{ material: "more_horiz" }}
        >
          <MenuItem onClick={onUploadClick}>Upload Icon</MenuItem>
          {props.menuItems.get().map((item) => (
            <MenuItem
              onClick={() => item.onClick(cluster.preferences)}
              key={item.id}
              disabled={item.disabled?.(cluster.preferences)}
            >
              {item.title}
            </MenuItem>
          ))}
        </MenuActions>
      </div>
      <div className="flex flex-col gap-3 mt-4">
        <div>
          <div className="mb-1">Icon text</div>
          <Input
            theme="round-black"
            data-testid="cluster-icon-text"
            value={iconText ?? ""}
            placeholder={computeDefaultShortName(name)}
            maxLength={40}
            onChange={(value) => {
              cluster.preferences.iconText = value || undefined;
            }}
          />
          <small className="hint">
            Shown in the cluster bar instead of the initials. Long text wraps and shrinks to fit.
          </small>
        </div>
        <div className="flex flex-row gap-6">
          <label className="flex flex-row items-center gap-2">
            <span>Background</span>
            <input
              type="color"
              data-testid="cluster-icon-background"
              value={asHex(background)}
              onChange={(event) => {
                cluster.preferences.iconBackground = event.target.value;
              }}
            />
            {iconBackground && (
              <a className="cursor-pointer" onClick={() => (cluster.preferences.iconBackground = undefined)}>
                Reset
              </a>
            )}
          </label>
          <label className="flex flex-row items-center gap-2">
            <span>Text color</span>
            <input
              type="color"
              data-testid="cluster-icon-text-color"
              value={asHex(iconTextColor || contrastingTextColor(background))}
              onChange={(event) => {
                cluster.preferences.iconTextColor = event.target.value;
              }}
            />
            {iconTextColor ? (
              <a className="cursor-pointer" onClick={() => (cluster.preferences.iconTextColor = undefined)}>
                Automatic
              </a>
            ) : (
              <span className="text-secondary">Automatic</span>
            )}
          </label>
        </div>
      </div>
      {props.settingComponents.get().map((item) => {
        return <item.Component key={item.id} preferences={cluster.preferences} />;
      })}
    </div>
  );
});

export const ClusterIconSetting = withInjectables<Dependencies, ClusterIconSettingProps>(
  NonInjectedClusterIconSetting,
  {
    getProps: (di, props) => {
      const computedInjectMany = di.inject(computedInjectManyInjectionToken);

      return {
        ...props,
        menuItems: computedInjectMany(clusterIconSettingsMenuInjectionToken),
        settingComponents: computedInjectMany(clusterIconSettingsComponentInjectionToken),
        showErrorNotification: di.inject(showErrorNotificationInjectable),
      };
    },
  },
);
