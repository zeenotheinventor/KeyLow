"use client";

import { useId, useState, useTransition } from "react";

import type { AppearanceSettingProps } from "./types";

import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { setTheme } from "@/lib/theme/setTheme";

const appearanceOptions = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
  { value: "device", label: "Match device" },
] as const;

/** A row of the Settings group: the label, and the choice of Dark, Light or following the device. */
export function AppearanceSetting({ initialPreference }: AppearanceSettingProps) {
  const labelId = useId();
  const [preference, setPreference] = useState(initialPreference);
  const [, startTransition] = useTransition();

  return (
    <li className="flex flex-col gap-2 p-3">
      <span id={labelId} className="text-body-strong">
        Appearance
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
