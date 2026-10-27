import { setsBarPositionsOf } from "@keylow/core/training";
import { vars } from "nativewind";
import { View } from "react-native";

import { BarLabel } from "./BarLabel";

import type { WeeklySetsBarProps } from "./types";
import type { VolumeStatus } from "@keylow/core/training";

// The done fill takes the volume status colour, as the legend of the Volume scale names it. The classes are
// written out so Tailwind sees them.
const fillClassName: Record<VolumeStatus, string> = {
  not_trained: "bg-volume-not-trained",
  maintaining: "bg-volume-maintaining",
  growing: "bg-volume-growing",
  productive: "bg-volume-productive",
  high: "bg-volume-high",
};

const percentOf = (share: number): string => `${share * 100}%`;

/**
 * The sets of the week against the volume bands, as the muscle sheet's board draws it: a track from 0 to 24
 * sets, the sets done filled in the colour of their band, a tick where each of Growing, Productive and High
 * begins with its number under it, and a taller tick for the planned figure. It is one image named by the
 * copy, so the colour is never the only signal. Every mark's place is a runtime number no class can name, so
 * each goes through a variable.
 */
export function WeeklySetsBar({ weeklySets, name, labels }: WeeklySetsBarProps) {
  const positions = setsBarPositionsOf(weeklySets);

  return (
    <View
      accessible
      aria-label={name}
      className="h-[34px]"
      role="img"
      style={vars({
        "--done": percentOf(positions.done),
        "--planned": percentOf(positions.planned),
        "--growing": percentOf(positions.growingFrom),
        "--productive": percentOf(positions.productiveFrom),
        "--high": percentOf(positions.highAbove),
      })}
    >
      <View className="absolute inset-x-0 top-[4px] h-[10px] rounded-[5px] border border-border bg-surface-raised" />
      <View
        className={`absolute left-0 top-[4px] h-[10px] w-[var(--done)] rounded-[5px] ${fillClassName[weeklySets.volumeStatus]}`}
      />
      <View className="absolute left-[var(--growing)] top-0 h-[18px] w-px bg-text-muted" />
      <View className="absolute left-[var(--productive)] top-0 h-[18px] w-px bg-text-muted" />
      <View className="absolute left-[var(--high)] top-0 h-[18px] w-px bg-text-muted" />
      <View className="absolute left-[var(--planned)] top-0 -ml-px h-[18px] w-[2px] rounded-[1px] bg-text-primary" />
      <BarLabel anchor="start" markClassName="" text={labels.start} />
      <BarLabel anchor="centre" markClassName="left-[var(--growing)]" text={labels.growing} />
      <BarLabel anchor="centre" markClassName="left-[var(--productive)]" text={labels.productive} />
      <BarLabel anchor="centre" markClassName="left-[var(--high)]" text={labels.high} />
    </View>
  );
}
