"use client";

import { MORE_SCREEN } from "@keylow/core/copy";
import { useId, useState, useTransition } from "react";

import type { AppearanceSettingProps } from "./types";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { setTheme } from "@/lib/theme/setTheme";

const { appearance } = MORE_SCREEN.settings;

const appearanceOptions = [
  { value: "dark", label: appearance.options.dark },
  { value: "light", label: appearance.options.light },
  { value: "device", label: appearance.options.system },
] as const;

/** A row of the Settings group: the label, and the choice of Dark, Light or following the device. */
export function AppearanceSetting({ initialPreference }: AppearanceSettingProps) {
  const labelId = useId();
  const [preference, setPreference] = useState(initialPreference);
  const [, startTransition] = useTransition();

  return (
    <li className="flex flex-col gap-2 p-3">
      <span id={labelId} className="text-body-strong">
        {appearance.title}
      </span>
      <SegmentedControl
        labelledBy={labelId}
        options={appearanceOptions}
        value={preference}
        onChange={(next) => {
          const earlierPreference = preference;
          setPreference(next);
          startTransition(async () => {
            try {
              await setTheme(next);
            } catch {
              // The theme was not saved, so the control goes back to what is still true.
              setPreference(earlierPreference);
            }
          });
        }}
      />
    </li>
  );
}
