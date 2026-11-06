"use client";

import { useEditProgram } from "@keylow/api-client";
import { PROGRAM_EDIT, TARGETS_SAVED_TOAST, setupGoalNoteFor } from "@keylow/core/copy";
import { changesOf, chooseGoal, initialDraftOf } from "@keylow/core/program";
import { goalsAllowed, isRateGoal } from "@keylow/core/setup";
import { useQueryClient } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { COLUMNS_CLASS_NAME } from "../columns";
import { ProgramEditFooter } from "../ProgramEditFooter";
import { ProgramEditFrame } from "../ProgramEditFrame";

import type { ProgramEditFormProps } from "./types";
import type { ReactNode } from "react";

import { DietOptions } from "@/components/setup/SetupOptions/DietOptions";
import { GoalOptions } from "@/components/setup/SetupOptions/GoalOptions";
import { ProteinOptions } from "@/components/setup/SetupOptions/ProteinOptions";
import { RateOptions } from "@/components/setup/SetupOptions/RateOptions";
import { Banner } from "@/components/ui/Banner";
import { useToast } from "@/components/ui/Toast";
import { dropStaleTargetReads } from "@/lib/dropStaleTargetReads";
import { useElementSize } from "@/lib/useElementSize";
import { useIsOnline } from "@/lib/useIsOnline";
import { vars } from "@/lib/vars";

const PROGRAM_HREF = "/more/program";

// A focused control scrolls into view clear of the footer and a little more, whatever height the footer has.
const CLEAR_OF_FOOTER_CLASS_NAME =
  "[&_a]:scroll-mb-[calc(var(--footer-height)+16px)] [&_button]:scroll-mb-[calc(var(--footer-height)+16px)]";

function Group({
  title,
  helper,
  children,
}: {
  title: string;
  helper?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-h2">{title}</h2>
        {helper !== undefined && <p className="text-caption text-text-secondary">{helper}</p>}
      </div>
      {children}
    </section>
  );
}

/**
 * Edit programme, as `program-edit` draws it: four groups of option cards (goal and rate in the first column,
 * protein and diet style in the second from the large breakpoint) over a sticky footer with Save changes. The
 * rate is asked for Lose and Gain only. Lose is not offered under 18, by core's `goalsAllowed`. A save is one write
 * and a recompute through `useEditProgram`, and returns to Programme with the toast Targets saved. A failed save says
 * the targets have not changed, keeps every choice and is retried with the same button. Offline, Save changes is off
 * with its reason in the footer from the start, and the choices stay free. The back link leaves without saving and
 * without asking. The form starts from the programme once and never again: a read that lands later does not
 * overwrite a choice. Nothing of the programme is logged.
 */
export function ProgramEditForm({
  program,
  ageYears,
  weightKg,
  weightUnit,
  expenditureKcal,
  today,
}: ProgramEditFormProps) {
  const router = useRouter();
  const toast = useToast();
  const queryClient = useQueryClient();
  const isOnline = useIsOnline();
  const editProgram = useEditProgram();
  const { reference: footerReference, size: footerSize } = useElementSize<HTMLElement>();
  const saveButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState(() => initialDraftOf(program, ageYears));
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  // One save per press: a second press can arrive before the screen has drawn the first, and the mutation's
  // pending state is only read on the next draw.
  const isSaveStarted = useRef(false);
  const isMounted = useRef(false);
  // Busy from the press until the page has gone, so the moment between the save settling and the navigation
  // cannot be used to leave twice or to save again.
  const isBusy = editProgram.isPending || hasSaved;
  const allowedGoals = goalsAllowed(ageYears);
  const goalNote = setupGoalNoteFor(allowedGoals);

  // The footer's one notice slot: going offline replaces an earlier failed save, which must not come back
  // as a second banner when the connection returns.
  if (!isOnline && hasSaveFailed) {
    setHasSaveFailed(false);
  }

  // Not set in the render, so a page the strict mode mounts twice ends up marked mounted.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // The failed save leaves focus on the button that was pressed, which was off while it ran, so it goes back there.
  useEffect(() => {
    if (hasSaveFailed && !editProgram.isPending) {
      saveButton.current?.focus();
    }
  }, [hasSaveFailed, editProgram.isPending]);

  async function save() {
    if (isSaveStarted.current || !isOnline) {
      return;
    }
    isSaveStarted.current = true;
    setHasSaveFailed(false);
    try {
      await editProgram.mutateAsync({ changes: changesOf(draft), today });
    } catch {
      // The error's own words are never shown: a failed write and a failed recompute look the same here.
      isSaveStarted.current = false;
      if (isMounted.current) {
        setHasSaveFailed(true);
      }
      return;
    }
    // The save is done whether or not the page is still here. Programme and the targets drawn elsewhere hold the
    // figures from before it, and the refresh `useEditProgram` starts is not waited for (a refetch pauses
    // offline, and the page must never hang on one). So they are dropped, and the next screen reads fresh and
    // shows its loading state until the new figures land, never the old ones under "Targets saved".
    dropStaleTargetReads(queryClient);
    // The provider sits above every page, so the toast tells a person who left by Back that it saved.
    toast.show({ message: TARGETS_SAVED_TOAST, tone: "success", icon: Check });
    // The way on is only for a page that is still here.
    if (!isMounted.current) {
      return;
    }
    setHasSaved(true);
    router.push(PROGRAM_HREF);
  }

  function noticeOf() {
    if (!isOnline) {
      return "offline";
    }
    return hasSaveFailed ? "save-failed" : null;
  }

  return (
    <ProgramEditFrame
      isBackInert={isBusy}
      footer={
        <ProgramEditFooter
          ref={footerReference}
          saveButtonRef={saveButton}
          notice={noticeOf()}
          expenditureKcal={expenditureKcal}
          isSaving={isBusy}
          isSaveOff={!isOnline}
          onSave={() => {
            void save();
          }}
        />
      }
    >
      <div
        className={`${COLUMNS_CLASS_NAME} ${CLEAR_OF_FOOTER_CLASS_NAME}`}
        // The footer's height is measured at runtime, so it goes through a variable that the scroll margin reads.
        style={vars({ "--footer-height": `${footerSize?.height ?? 0}px` })}
      >
        <div className="flex flex-col gap-6">
          <Group title={PROGRAM_EDIT.groups.goal.title}>
            <GoalOptions
              allowedGoals={allowedGoals}
              label={PROGRAM_EDIT.groups.goal.title}
              value={draft.goal}
              onChange={(goal) => {
                setDraft((current) => chooseGoal(current, goal));
              }}
            />
            <Banner title={goalNote.title}>{goalNote.body}</Banner>
          </Group>
          {isRateGoal(draft.goal) && (
            <Group title={PROGRAM_EDIT.groups.rate.title} helper={PROGRAM_EDIT.groups.rate.helper}>
              <RateOptions
                goal={draft.goal}
                label={PROGRAM_EDIT.groups.rate.title}
                value={draft.ratePctPerWeek}
                weightKg={weightKg}
                weightUnit={weightUnit}
                onChange={(ratePctPerWeek) => {
                  setDraft((current) => ({ ...current, ratePctPerWeek }));
                }}
              />
            </Group>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Group
            title={PROGRAM_EDIT.groups.protein.title}
            helper={PROGRAM_EDIT.groups.protein.helper}
          >
            <ProteinOptions
              label={PROGRAM_EDIT.groups.protein.title}
              value={draft.proteinPreset}
              weightKg={weightKg}
              onChange={(proteinPreset) => {
                setDraft((current) => ({ ...current, proteinPreset }));
              }}
            />
          </Group>
          <Group
            title={PROGRAM_EDIT.groups.dietStyle.title}
            helper={PROGRAM_EDIT.groups.dietStyle.helper}
          >
            <DietOptions
              label={PROGRAM_EDIT.groups.dietStyle.title}
              value={draft.dietStyle}
              onChange={(dietStyle) => {
                setDraft((current) => ({ ...current, dietStyle }));
              }}
            />
          </Group>
        </div>
      </div>
    </ProgramEditFrame>
  );
}
