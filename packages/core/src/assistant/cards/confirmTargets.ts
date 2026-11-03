import {
  CONFIRM_TARGETS_BUTTONS,
  describeConfirmTargetsQuestion,
} from "../../copy/assistantTargetCards";

/** The two buttons under the model's own question: "Change target" and "Keep 2,140". */
export const confirmTargetsButtons = (currentKcal: number | null) => ({
  confirmLabel: CONFIRM_TARGETS_BUTTONS.confirm,
  cancelLabel: CONFIRM_TARGETS_BUTTONS.keep(currentKcal),
});

type ConfirmTargetsChange = {
  currentKcal: number | null;
  newKcal: number;
  programmeActive: boolean;
};

/** A formatter for the question the turn loop may use. The board's words are in `describeConfirmTargetsQuestion`. */
export const confirmTargetsQuestion = ({
  currentKcal,
  newKcal,
  programmeActive,
}: ConfirmTargetsChange): string =>
  describeConfirmTargetsQuestion(currentKcal, newKcal, programmeActive);
