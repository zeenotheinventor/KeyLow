import { GOAL_QUESTION_STEPS, GOAL_QUESTIONNAIRE, GOAL_QUESTIONS } from "@keylow/core/copy";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { BackHandler } from "react-native";

import { goalQuestionPath, goalSummaryPath } from "../../../lib/goalRoutes";
import { ConfirmDialog } from "../../ui";
import { DaysStep } from "../DaysStep";
import { EquipmentStep } from "../EquipmentStep";
import { ExperienceStep } from "../ExperienceStep";
import { FocusStep } from "../FocusStep";
import { isGoalStepAnswered } from "../goalDraftReducer";
import { GoalStep } from "../GoalStep";
import { MinutesStep } from "../MinutesStep";
import { QuestionScreen } from "../QuestionScreen";
import { useCloseGoalFlow } from "../useCloseGoalFlow";
import { useGoalDraft } from "../useGoalDraft";

import type { GoalQuestionScreenProps } from "./types";

/**
 * One question of the goal questionnaire. The answers are kept in the flow's provider, so Back loses none,
 * and nothing is saved here: the summary saves them at the end. Close asks first when the answers differ from those the flow opened with, so there is something to
 * lose, and the Android back button does what Close and Back do.
 */
export function GoalQuestionScreen({ step: stepName }: GoalQuestionScreenProps) {
  const router = useRouter();
  const { draft, hasChanges, answer } = useGoalDraft();
  const closeFlow = useCloseGoalFlow();
  const [isAsking, setIsAsking] = useState(false);
  const step = GOAL_QUESTION_STEPS.indexOf(stepName) + 1;
  const isFirst = step === 1;
  const isLast = step === GOAL_QUESTION_STEPS.length;
  const question = GOAL_QUESTIONS[stepName];

  const requestClose = useCallback(() => {
    if (hasChanges) {
      setIsAsking(true);
    } else {
      closeFlow();
    }
  }, [closeFlow, hasChanges]);

  // Set by the first Next or Back, so a second press in the same moment does not push or pop twice. It is
  // let go when this question is in front again.
  const hasMoved = useRef(false);
  useFocusEffect(
    useCallback(() => {
      hasMoved.current = false;
    }, []),
  );

  // The question before this one is the screen under it, since the questions are only reached by Next.
  const goBack = useCallback(() => {
    if (!hasMoved.current) {
      hasMoved.current = true;
      router.back();
    }
  }, [router]);

  function goNext() {
    if (!hasMoved.current) {
      hasMoved.current = true;
      router.push(isLast ? goalSummaryPath() : goalQuestionPath(step + 1));
    }
  }

  // Only while this question is the focused one. The first question has nothing before it, so the button
  // closes the flow, asking first as Close does.
  useFocusEffect(
    useCallback(() => {
      const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
        if (isFirst) {
          requestClose();
        } else {
          goBack();
        }
        return true;
      });

      return () => {
        subscription.remove();
      };
    }, [goBack, isFirst, requestClose]),
  );

  function renderAnswers() {
    switch (stepName) {
      case "goal":
        return (
          <GoalStep
            value={draft.goal}
            onChange={(goal) => {
              answer({ goal });
            }}
          />
        );
      case "focus":
        return (
          <FocusStep
            value={draft.focus}
            onChange={(focus) => {
              answer({ focus });
            }}
          />
        );
      case "days":
        return (
          <DaysStep
            value={draft.days_per_week}
            onChange={(days) => {
              answer({ days_per_week: days });
            }}
          />
        );
      case "minutes":
        return (
          <MinutesStep
            value={draft.session_minutes}
            onChange={(minutes) => {
              answer({ session_minutes: minutes });
            }}
          />
        );
      case "equipment":
        return (
          <EquipmentStep
            value={draft.equipment ?? []}
            onChange={(equipment) => {
              answer({ equipment });
            }}
          />
        );
      case "experience":
        return (
          <ExperienceStep
            value={draft.experience}
            onChange={(experience) => {
              answer({ experience });
            }}
          />
        );
    }
  }

  return (
    <>
      <QuestionScreen
        help={question.help}
        isNextEnabled={isGoalStepAnswered(draft, step)}
        note={question.note}
        step={step}
        title={question.title}
        onBack={isFirst ? undefined : goBack}
        onClose={requestClose}
        onNext={goNext}
      >
        {renderAnswers()}
      </QuestionScreen>
      <ConfirmDialog
        body={GOAL_QUESTIONNAIRE.closeBody}
        cancelLabel={GOAL_QUESTIONNAIRE.closeKeepAction}
        confirmLabel={GOAL_QUESTIONNAIRE.closeConfirmAction}
        open={isAsking}
        title={GOAL_QUESTIONNAIRE.closeConfirmation}
        tone="primary"
        onCancel={() => {
          setIsAsking(false);
        }}
        onConfirm={() => {
          setIsAsking(false);
          closeFlow();
        }}
      />
    </>
  );
}
