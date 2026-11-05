"use client";

import { FINISH_SCREEN, SESSION_ACTIVE, describeMusclesTrained } from "@keylow/core/copy";
import {
  TRAINING_PARAMS_V2,
  sessionHeatReadingTime,
  sessionHeatValues,
  sessionMuscleSets,
} from "@keylow/core/training";
import { useMemo } from "react";

import { TrainedMuscleRow } from "./TrainedMuscleRow";

import type { SessionMusclesCardProps } from "./types";

import { BodyFigure } from "@/components/ui/BodyFigure";
import { Card } from "@/components/ui/Card";
import { useBodyFigure } from "@/lib/bodyFigure";

const SIDES = ["front", "back"] as const;

/**
 * The muscles a session has trained, as the phone's Muscles trained card draws them and as the `web-session ·
 * active` board draws the side card of the session page: the front and the back of the body filled with the
 * heat of this session's sets alone, and the muscles with their effective sets, most first. It reads only
 * the sets it is given, so it draws from what the page already holds and never waits for a read, online or
 * not. A session with no working set trained nothing, so the card is left out, and it waits for the stored
 * figure setting so it never draws the wrong figure first. The list changes with each set logged and is not
 * a live region: a screen reader reaches it when it chooses, and is not told of every set.
 */
export function SessionMusclesCard({ variant, sets, at, action }: SessionMusclesCardProps) {
  const { rows, heatSteps } = useMemo(
    () => ({
      rows: sessionMuscleSets(sets, TRAINING_PARAMS_V2),
      heatSteps: sessionHeatValues(sets, sessionHeatReadingTime(sets, at), TRAINING_PARAMS_V2),
    }),
    [sets, at],
  );
  const { figure, isReady: isFigureReady } = useBodyFigure();

  if (rows.length === 0 || !isFigureReady) {
    return action ?? null;
  }

  const isSide = variant === "side";
  const heading = isSide ? SESSION_ACTIVE.sideCardHeading : FINISH_SCREEN.musclesHeading;
  const figures = (
    <div className={isSide ? "flex justify-center gap-6" : "flex gap-2"}>
      {SIDES.map((side) => (
        <BodyFigure
          key={side}
          body={figure}
          label={FINISH_SCREEN.figureNames[side]}
          scale="heat"
          side={side}
          values={heatSteps}
          w={isSide ? 96 : 64}
        />
      ))}
    </div>
  );
  const list = (
    <ul className={isSide ? "flex flex-col gap-1" : "flex flex-1 flex-col gap-[2px]"}>
      {describeMusclesTrained(rows).map(({ muscle, name, value }) => (
        <TrainedMuscleRow
          key={muscle}
          hasSwatch={!isSide}
          heatStep={heatSteps[muscle]}
          name={name}
          value={value}
        />
      ))}
    </ul>
  );

  return (
    <Card asChild padding="none" className={isSide ? "p-4" : "p-3"}>
      <section aria-label={heading} className={`flex flex-col ${isSide ? "gap-3" : "gap-2"}`}>
        {isSide ? (
          <h2 className="text-body-strong">{heading}</h2>
        ) : (
          <div className="flex items-baseline justify-between">
            <h2 className="text-body-strong">{heading}</h2>
            <span className="text-caption text-text-muted">
              {FINISH_SCREEN.effectiveSetsCaption}
            </span>
          </div>
        )}
        {isSide ? (
          <>
            {figures}
            {list}
          </>
        ) : (
          <div className="flex items-center gap-3">
            {figures}
            {list}
          </div>
        )}
        {action}
      </section>
    </Card>
  );
}
