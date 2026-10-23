import { setsBarPositionsOf } from "@keylow/core/training";
import { vars } from "nativewind";
import { View } from "react-native";

import { BarLabel } from "./BarLabel";

import type { WeeklySetsBarProps } from "./types";
import type { VolumeStatus } from "@keylow/core/training";

// The done fill takes the volume status colour, as the legend of the Volume scale names it. The classes are
// written out so Tailwind sees them.
const fillClassName: Record<VolumeStatus, string> = {
  under: "bg-volume-under",
  maintaining: "bg-volume-maintaining",
  productive: "bg-volume-productive",
  over: "bg-volume-over",
  not_targeted: "bg-volume-not-targeted",
};

const percentOf = (share: number): string => `${share * 100}%`;

/**
 * The sets of the week against the muscle's target, as the muscle sheet's board draws it: a track that runs
 * to the maximum, the target band over it, the sets done filled in the volume status colour, a tick for the
 * minimum and a taller one for the planned figure, with their words under. A label near an end of the
 * track hangs from the edge, and the planned label takes a second row when it would meet another. It is one
 * image named by the copy, so the colour is never the only signal. Every mark's place is a runtime
 * number no class can name, so each goes through a variable.
 */
export function WeeklySetsBar({ weeklySets, name, labels }: WeeklySetsBarProps) {
  const positions = setsBarPositionsOf(weeklySets);

  return (
    <View
      accessible
      aria-label={name}
      className={positions.isPlannedLabelBelow ? "h-[50px]" : "h-[34px]"}
      role="img"
      style={vars({
        "--done": percentOf(positions.done),
        "--minimum": percentOf(positions.minimum),
        "--planned": percentOf(positions.planned),
        "--band-start": percentOf(positions.bandStart),
        "--band-width": percentOf(positions.bandEnd - positions.bandStart),
      })}
    >
      <View className="absolute inset-x-0 top-[4px] h-[10px] rounded-[5px] border border-border bg-surface-raised" />
      <View className="absolute left-[var(--band-start)] top-[4px] h-[10px] w-[var(--band-width)] border-x border-success bg-success-muted" />
      <View
        className={`absolute left-0 top-[4px] h-[10px] w-[var(--done)] rounded-[5px] ${fillClassName[weeklySets.volumeStatus]}`}
      />
      <View className="absolute left-[var(--minimum)] top-0 h-[18px] w-px bg-text-muted" />
      <View className="absolute left-[var(--planned)] top-0 -ml-px h-[18px] w-[2px] rounded-[1px] bg-text-primary" />
      <BarLabel
        anchor="start"
        markClassName=""
        rowClassName="top-[20px]"
        text={labels.start}
        tone="muted"
      />
      <BarLabel
        anchor="centre"
        markClassName="left-[var(--minimum)]"
        rowClassName="top-[20px]"
        text={labels.minimum}
        tone="muted"
      />
      <BarLabel
        anchor={positions.plannedLabel}
        markClassName="left-[var(--planned)]"
        rowClassName={positions.isPlannedLabelBelow ? "top-[36px]" : "top-[20px]"}
        text={labels.planned}
        tone="secondary"
      />
      <BarLabel
        anchor="end"
        markClassName=""
        rowClassName="top-[20px]"
        text={labels.maximum}
        tone="muted"
      />
    </View>
  );
}
