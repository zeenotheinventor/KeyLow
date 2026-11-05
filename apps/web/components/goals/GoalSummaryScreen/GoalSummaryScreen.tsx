"use client";

import { useActiveRoutine, useSaveTrainingGoals } from "@keylow/api-client";
import {
  describePriorities,
  GOAL_ERRORS,
  GOAL_QUESTIONNAIRE,
  GOAL_SUMMARY,
} from "@keylow/core/copy";
import {
  deriveMusclePriority,
  GOAL_PRESETS_V1,
  priorityFigureValues,
  summarisePriorities,
} from "@keylow/core/training";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef } from "react";

import { useGoalDraft } from "../GoalDraftProvider";
import { PriorityRow } from "../PriorityRow";

import type { GoalSummaryScreenProps } from "./types";

import { Banner } from "@/components/ui/Banner";
import { BodyFigure } from "@/components/ui/BodyFigure";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useBodyFigure } from "@/lib/bodyFigure";
import { goalExitPath } from "@/lib/goalRoutes";
import { useIsOnline } from "@/lib/useIsOnline";

const FIGURE_WIDTH = 70;

// The space a figure takes at that width, 154 px tall from the 200 by 440 drawing, which is held while the
// figures are not drawn so the legend beside them does not move. The classes are written out so Tailwind
// sees them.
const FIGURE_SPACE_CLASSES = "h-[154px] w-[70px] shrink-0";

// The space the rows take, held while they are not drawn so that Save goal does not move when they arrive.
// Four rows of a title line and a description line are 42 px each with 12 px between them, which is 204 px
// where the rows stay on one line, from 460 px wide. Below that the titles wrap, to about 290 px up to 440 px
// and in between to a height that falls from 266 to 202 px. The rows that are drawn vary with the answers,
// so the space is near the real height and not equal to it. The classes are written out so Tailwind sees
// them.
const ROWS_SPACE_CLASSES =
  "flex min-h-[290px] flex-col gap-3 min-[440px]:min-h-[240px] min-[460px]:min-h-[204px]";
const ROW_PLACES = [0, 1, 2, 3] as const;

/**
 * "Your priorities", the last screen of the goal questionnaire, in the card the questions use: the answers
 * restated, a row for each group of muscles, the front and back of the body filled on the volume scale, and
 * Save goal. The rows count the muscles of the active routine as kept up, as the plan does. While the routine
 * is being read the rows and the figures are not drawn, so no muscle shows as left out and then flips to
 * kept up when the routine arrives. A routine that cannot be read counts as none, and so does one that
 * cannot be asked for because the browser is offline, since a read that is paused would never end. The
 * answers line, the legend and Save goal do not wait for it. The figures are always the flat drawings, in
 * the male or female figure the setting has. Save goal is drawn only once an answer has changed, so a goal
 * that is opened and left as it is stores no new row. It sends the answers once, however often it is pressed,
 * and then leaves for More. With no connection it is off and says why, since a save that waited would fire
 * later without the person looking. A save that fails keeps the answers and shows the error toast, so it
 * can be tried again. Nothing the answers say reaches a log or a report from here.
 */
export function GoalSummaryScreen({ answers }: GoalSummaryScreenProps) {
  const router = useRouter();
  const toast = useToast();
  const isOnline = useIsOnline();
  const { hasChanges } = useGoalDraft();
  const { figure, isReady: isFigureReady } = useBodyFigure();
  const routine = useActiveRoutine();
  const saveGoal = useSaveTrainingGoals();
  const titleId = useId();
  const titleRef = useRef<HTMLHeadingElement>(null);
  // Set by the first press, so a second press in the same moment does not save and leave twice.
  const isSaving = useRef(false);

  // The page opens at its title, as each question does.
  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Only a read that is on its way is waited for. One that failed has no data either, and one that is paused
  // because the browser is offline would never arrive, and both count as no routine.
  const isRoutineKnown = !(routine.isPending && routine.fetchStatus === "fetching");
  const routineRead = routine.data ?? null;
  const { copy, values } = useMemo(() => {
    const summary = summarisePriorities(
      answers,
      deriveMusclePriority(answers, GOAL_PRESETS_V1),
      routineRead,
    );
    return { copy: describePriorities(summary), values: priorityFigureValues(summary) };
  }, [answers, routineRead]);

  async function handleSave() {
    if (isSaving.current) {
      return;
    }
    isSaving.current = true;
    try {
      await saveGoal.mutateAsync(answers);
    } catch {
      // The error is not read: it can carry the answers, and the toast states the rule instead.
      isSaving.current = false;
      toast.show({ message: GOAL_ERRORS.save, tone: "danger" });
      return;
    }
    router.replace(goalExitPath());
  }

  return (
    <Card asChild padding="none">
      <section
        aria-labelledby={titleId}
        className="mx-auto flex w-full max-w-[560px] flex-col gap-3 p-4 min-[700px]:p-8"
      >
        <h1 ref={titleRef} id={titleId} tabIndex={-1} className="text-h1 outline-none">
          {GOAL_SUMMARY.title}
        </h1>
        <p className="text-body text-text-secondary">{copy.answers}</p>
        <Card
          aria-label={GOAL_SUMMARY.prioritiesSectionName}
          className="flex flex-col gap-3"
          level="raised"
          role="region"
          aria-busy={isRoutineKnown ? undefined : true}
        >
          {isRoutineKnown ? (
            copy.rows.map((row) => <PriorityRow key={row.group} {...row} />)
          ) : (
            <Skeleton className={ROWS_SPACE_CLASSES}>
              {ROW_PLACES.map((place) => (
                <div key={place} className="flex gap-3">
                  <SkeletonBone className="mt-[6px] size-[10px] shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col gap-[2px]">
                    <SkeletonBone className="h-6 w-[70%]" />
                    <SkeletonBone className="h-4 w-1/2" />
                  </div>
                </div>
              ))}
            </Skeleton>
          )}
        </Card>
        <div className="flex gap-2">
          {isFigureReady && isRoutineKnown ? (
            (["front", "back"] as const).map((side) => (
              <BodyFigure
                key={side}
                body={figure}
                label={
                  side === "front" ? GOAL_SUMMARY.bodyMapFrontName : GOAL_SUMMARY.bodyMapBackName
                }
                scale="volume"
                side={side}
                values={values}
                w={FIGURE_WIDTH}
              />
            ))
          ) : (
            <>
              <div className={FIGURE_SPACE_CLASSES} />
              <div className={FIGURE_SPACE_CLASSES} />
            </>
          )}
          <p className="flex-1 self-center text-caption text-text-muted">{copy.legend}</p>
        </div>
        {hasChanges && !isOnline ? <Banner tone="info">{GOAL_ERRORS.saveOffline}</Banner> : null}
        <div className="mt-2 flex justify-end gap-2">
          <Button
            aria-label={GOAL_SUMMARY.backLabel}
            variant="secondary"
            onClick={() => {
              router.back();
            }}
          >
            {GOAL_QUESTIONNAIRE.backAction}
          </Button>
          {hasChanges ? (
            <Button
              disabled={!isOnline}
              loading={saveGoal.isPending}
              onClick={() => {
                void handleSave();
              }}
            >
              {GOAL_SUMMARY.saveAction}
            </Button>
          ) : null}
        </div>
      </section>
    </Card>
  );
}
