/**
 * Copyright (c) Freelens Authors. All rights reserved.
 * Licensed under MIT License. See LICENSE in root directory for more information.
 */

import { withInjectables } from "@ogre-tools/injectable-react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { useState } from "react";
import isLinuxInjectable from "../../../../../../common/vars/is-linux.injectable";
import { Input } from "../../../../../../renderer/components/input";
import { SubTitle } from "../../../../../../renderer/components/layout/sub-title";
import { defaultAppearance, maxFontSize, minFontSize, minOpacity } from "../../../../../appearance/common/appearance";
import userPreferencesStateInjectable from "../../../../../user-preferences/common/state.injectable";

import type { AppearancePreferences } from "../../../../../appearance/common/appearance";
import type { UserPreferencesState } from "../../../../../user-preferences/common/state.injectable";

interface Dependencies {
  state: UserPreferencesState;
  isLinux: boolean;
}

// Offered until the system's own fonts have been read
const commonFonts = [
  "Roboto",
  "Inter",
  "Helvetica",
  "Arial",
  "Segoe UI",
  "SF Pro Text",
  "Ubuntu",
  "Noto Sans",
  "Open Sans",
  "Source Sans 3",
  "Verdana",
  "Georgia",
];

type QueryLocalFonts = () => Promise<{ family: string }[]>;

/** The families of the fonts installed on the computer, when the browser can list them */
async function readSystemFonts(): Promise<string[] | undefined> {
  const query = (globalThis as { queryLocalFonts?: QueryLocalFonts }).queryLocalFonts;

  if (!query) {
    return undefined;
  }

  try {
    const fonts = await query();

    return [...new Set(fonts.map(({ family }) => family))].sort((a, b) => a.localeCompare(b));
  } catch {
    return undefined;
  }
}

const percent = (value: number) => `${Math.round(value * 100)}%`;

interface SliderProps {
  id: string;
  min: number;
  max: number;
  step: number;
  value: number;
  disabled?: boolean;
  format: (value: number) => string;
  onChange: (value: number) => void;
}

const Slider = ({ id, min, max, step, value, disabled, format, onChange }: SliderProps) => (
  <div className="flex flex-row items-center gap-3">
    <input
      id={id}
      data-testid={id}
      type="range"
      className="grow"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(Number(event.target.value))}
    />
    <span className="w-12 text-right">{format(value)}</span>
  </div>
);

const NonInjectedAppearance = observer(({ state, isLinux }: Dependencies) => {
  const [fonts, setFonts] = useState<string[]>(commonFonts);
  const [readFonts, setReadFonts] = useState(false);
  const appearance = state.appearance;

  const update = (change: Partial<AppearancePreferences>) =>
    runInAction(() => {
      state.appearance = { ...state.appearance, ...change };
    });

  const loadFonts = () => {
    if (readFonts) {
      return;
    }

    setReadFonts(true);
    void readSystemFonts().then((families) => families?.length && setFonts(families));
  };

  return (
    <section id="appearance-settings">
      <SubTitle title="Window transparency" />
      <Slider
        id="appearance-window-opacity"
        min={minOpacity}
        max={1}
        step={0.05}
        value={appearance.windowOpacity}
        disabled={isLinux}
        format={percent}
        onChange={(windowOpacity) => update({ windowOpacity })}
      />
      <small className="hint">
        {isLinux
          ? "Not available on Linux: Electron cannot make a window there see-through."
          : "How opaque the windows of Freelens are."}
      </small>

      <section className="mt-5">
        <SubTitle title="Font" />
        <Input
          theme="round-black"
          type="text"
          list="appearance-font-families"
          data-testid="appearance-font-family"
          placeholder="Default (Roboto)"
          value={appearance.fontFamily}
          onFocus={loadFonts}
          onChange={(fontFamily) => update({ fontFamily })}
        />
        <datalist id="appearance-font-families">
          {fonts.map((family) => (
            <option key={family} value={family} />
          ))}
        </datalist>
        <small className="hint">The font of the interface. Pick one of the installed fonts or type a name.</small>
      </section>

      <section className="mt-5">
        <SubTitle title="Font size" />
        <Slider
          id="appearance-font-size"
          min={minFontSize}
          max={maxFontSize}
          step={1}
          value={appearance.fontSize}
          format={(value) => `${value}px`}
          onChange={(fontSize) => update({ fontSize })}
        />
        <small className="hint">
          {`The size of the interface's text, ${defaultAppearance.fontSize}px by default. Zoom (View menu) scales everything instead.`}
        </small>
      </section>

      <section className="mt-5">
        <SubTitle title="Dropdown transparency" />
        <Slider
          id="appearance-dropdown-opacity"
          min={minOpacity}
          max={1}
          step={0.05}
          value={appearance.dropdownOpacity}
          format={percent}
          onChange={(dropdownOpacity) => update({ dropdownOpacity })}
        />
        <small className="hint">
          How opaque the background of dropdowns and menus is; what is behind shows blurred.
        </small>
      </section>
    </section>
  );
});

export const Appearance = withInjectables<Dependencies>(NonInjectedAppearance, {
  getProps: (di) => ({
    state: di.inject(userPreferencesStateInjectable),
    isLinux: di.inject(isLinuxInjectable),
  }),
});
