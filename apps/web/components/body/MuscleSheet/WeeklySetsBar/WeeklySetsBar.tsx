import { setsBarPositionsOf } from "@keylow/core/training";

import type { WeeklySetsBarProps } from "./types";
import type { VolumeStatus } from "@keylow/core/training";

import { vars } from "@/lib/vars";

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

const labelClasses = "absolute top-[20px] text-caption text-text-muted";
const centredLabelClasses = `${labelClasses} -ml-[36px] flex w-[72px] justify-center`;

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
    <div
      role="img"
      aria-label={name}
      className="relative h-[34px]"
      style={vars({
        "--done": percentOf(positions.done),
        "--planned": percentOf(positions.planned),
        "--growing": percentOf(positions.growingFrom),
        "--productive": percentOf(positions.productiveFrom),
        "--high": percentOf(positions.highAbove),
      })}
    >
      <div className="absolute inset-x-0 top-[4px] h-[10px] rounded-[5px] border border-border bg-surface-raised" />
      <div
        data-testid="sets-bar-fill"
        className={`absolute left-0 top-[4px] h-[10px] w-[var(--done)] rounded-[5px] ${fillClassName[weeklySets.volumeStatus]}`}
      />
      <div className="absolute left-[var(--growing)] top-0 h-[18px] w-px bg-text-muted" />
      <div className="absolute left-[var(--productive)] top-0 h-[18px] w-px bg-text-muted" />
      <div className="absolute left-[var(--high)] top-0 h-[18px] w-px bg-text-muted" />
      <div className="absolute left-[var(--planned)] top-0 -ml-px h-[18px] w-[2px] rounded-[1px] bg-text-primary" />
      <span className={`${labelClasses} left-0`}>{labels.start}</span>
      <span className={`${centredLabelClasses} left-[var(--growing)]`}>{labels.growing}</span>
      <span className={`${centredLabelClasses} left-[var(--productive)]`}>{labels.productive}</span>
      <span className={`${centredLabelClasses} left-[var(--high)]`}>{labels.high}</span>
    </div>
  );
}
