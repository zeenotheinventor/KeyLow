import { useEditProgram } from "@keylow/api-client";
import {
  PROGRAM_EDIT,
  PROGRAM_EDIT_FAILED_BANNER,
  TARGETS_SAVED_TOAST,
  describeEditFootnote,
} from "@keylow/core/copy";
import { goalsAllowed, isRateGoal } from "@keylow/core/setup";
import { Stack, useFocusEffect } from "expo-router";
import { vars } from "nativewind";
import { useCallback, useEffect, useRef, useState } from "react";
import { BackHandler, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DietOptions, GoalOptions, ProteinOptions, RateOptions } from "../../SetupOptions";
import { Banner, Button, Text, useToast } from "../../ui";
import { changesOf, chooseGoal, initialDraftOf } from "../programEditDraft";
import { ProgramEditFrame } from "../ProgramEditFrame";
import { useCloseProgramEdit } from "../useCloseProgramEdit";

import type { ProgramEditFormProps } from "./types";

// The footer sits on the screen's bottom inset with the 8 points the board adds, and never closer than 12.
const FOOTER_EXTRA_PADDING = 8;
const MINIMUM_FOOTER_BOTTOM_PADDING = 12;

/**
 * Edit programme, as `program-edit: default` draws it: one scrolling form of four groups (goal, rate, protein and
 * diet style) over a footer with Save changes. The rate is asked for Lose and Gain only. Lose is not offered under
 * 18, by core's `goalsAllowed`, the rule the wizard follows. A save is one write and a recompute through
 * `useEditProgram`, and goes back to the Programme screen with the Toast Targets saved. A failed save says the
 * targets have not changed, keeps every choice and is retried with the same button. Close leaves without saving
 * and without asking. Nothing of the programme is logged.
 */
export function ProgramEditForm({
  program,
  ageYears,
  weightKg,
  weightUnit,
  expenditureKcal,
  today,
}: ProgramEditFormProps) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const close = useCloseProgramEdit();
  const editProgram = useEditProgram();
  const [draft, setDraft] = useState(() => initialDraftOf(program, ageYears));
  const [hasSaveFailed, setHasSaveFailed] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  // One save per press: the guard is a ref because a second press can arrive before the screen has drawn the
  // first, and the mutation's pending state is only read on the next draw.
  const isSaveStarted = useRef(false);
  const isMounted = useRef(false);
  // Busy from the press until the screen has gone, so the moment between the save settling and the navigation
  // cannot be used to leave twice or to save again.
  const isBusy = editProgram.isPending || hasSaved;
  const allowedGoals = goalsAllowed(ageYears);
  const goalNote = allowedGoals.includes("lose")
    ? PROGRAM_EDIT.goalNotes.default
    : PROGRAM_EDIT.goalNotes.under18;

  // Not set in the render, so a screen the strict mode mounts twice ends up marked mounted.
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Only while this is the focused screen. Like the dimmed Close, the press is taken and does nothing while busy.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => isBusy);

      return () => {
        subscription.remove();
      };
    }, [isBusy]),
  );

  async function save() {
    if (isSaveStarted.current) {
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
    // The save is done whether or not the screen is still here, and the navigation is only for a screen that is.
    if (!isMounted.current) {
      return;
    }
    setHasSaved(true);
    toast.show({ message: TARGETS_SAVED_TOAST, tone: "success", icon: "Check" });
    close();
  }

  return (
    <ProgramEditFrame isCloseInert={isBusy} onClose={close}>
      {/* A swipe from the edge of the screen goes back on iOS, so it is off while busy, as Close and the Android back button are. */}
      <Stack.Screen options={{ gestureEnabled: !isBusy }} />
      <ScrollView contentContainerClassName="gap-6 px-4 pb-5 pt-5">
        <View className="gap-3">
          <Text role="heading" variant="h2">
            {PROGRAM_EDIT.groups.goal.title}
          </Text>
          <GoalOptions
            allowedGoals={allowedGoals}
            label={PROGRAM_EDIT.groups.goal.title}
            value={draft.goal}
            onChange={(goal) => {
              setDraft((current) => chooseGoal(current, goal));
            }}
          />
          <Banner body={goalNote.body} title={goalNote.title} />
        </View>
        {isRateGoal(draft.goal) ? (
          <View className="gap-3">
            <View className="gap-0.5">
              <Text role="heading" variant="h2">
                {PROGRAM_EDIT.groups.rate.title}
              </Text>
              <Text tone="secondary" variant="caption">
                {PROGRAM_EDIT.groups.rate.helper}
              </Text>
            </View>
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
          </View>
        ) : null}
        <View className="gap-3">
          <View className="gap-0.5">
            <Text role="heading" variant="h2">
              {PROGRAM_EDIT.groups.protein.title}
            </Text>
            <Text tone="secondary" variant="caption">
              {PROGRAM_EDIT.groups.protein.helper}
            </Text>
          </View>
          <ProteinOptions
            label={PROGRAM_EDIT.groups.protein.title}
            value={draft.proteinPreset}
            weightKg={weightKg}
            onChange={(proteinPreset) => {
              setDraft((current) => ({ ...current, proteinPreset }));
            }}
          />
        </View>
        <View className="gap-3">
          <View className="gap-0.5">
            <Text role="heading" variant="h2">
              {PROGRAM_EDIT.groups.dietStyle.title}
            </Text>
            <Text tone="secondary" variant="caption">
              {PROGRAM_EDIT.groups.dietStyle.helper}
            </Text>
          </View>
          <DietOptions
            label={PROGRAM_EDIT.groups.dietStyle.title}
            value={draft.dietStyle}
            onChange={(dietStyle) => {
              setDraft((current) => ({ ...current, dietStyle }));
            }}
          />
        </View>
      </ScrollView>
      <View
        className="gap-3 border-t border-border bg-surface-sheet px-4 pt-4 pb-[var(--footer-bottom-padding)]"
        // The padding is a runtime value no class can name, so it goes through a variable.
        style={vars({
          "--footer-bottom-padding": Math.max(
            insets.bottom + FOOTER_EXTRA_PADDING,
            MINIMUM_FOOTER_BOTTOM_PADDING,
          ),
        })}
      >
        {hasSaveFailed ? (
          <Banner sentence title={PROGRAM_EDIT_FAILED_BANNER} variant="error" />
        ) : null}
        <Text tone="secondary" variant="caption">
          {describeEditFootnote(expenditureKcal)}
        </Text>
        <Button
          fullWidth
          haptic="confirm"
          loading={isBusy}
          size="lg"
          onPress={() => {
            void save();
          }}
        >
          {PROGRAM_EDIT.saveLabel}
        </Button>
      </View>
    </ProgramEditFrame>
  );
}
