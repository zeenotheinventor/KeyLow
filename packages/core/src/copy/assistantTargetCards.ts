import { formatCalories, formatGrams } from "../format/numbers";

/*
 * The words of the assistant's targets confirmation and card, from the approved canvas "Ki-Lo assistant
 * screens" (assistant confirm, assistant-card targets-changed). A string marked NOT ON THE CANVAS is a
 * draft in the board's style that the designers have not drawn, and waits for Zee's approval.
 */

const kcalText = (kcal: number): string => `${formatCalories(kcal)} kcal`;

export const CONFIRM_TARGETS_BUTTONS = {
  confirm: "Change target",
  /** "Keep 2,140". NOT ON THE CANVAS when there is no target to keep: "Don't change". */
  keep: (currentKcal: number | null): string =>
    currentKcal === null ? "Don't change" : `Keep ${formatCalories(currentKcal)}`,
};

/**
 * "Change your calorie target from 2,140 to 2,000 kcal? This ends your programme and its weekly check-in.
 * Today and later days use your own targets." Without a programme only the first sentence is the board's
 * and the rest is left off, and with no target set the question reads "Set your calorie target to 2,000
 * kcal?". Both are NOT ON THE CANVAS.
 */
export const describeConfirmTargetsQuestion = (
  currentKcal: number | null,
  newKcal: number,
  programmeActive: boolean,
): string => {
  if (currentKcal === null) {
    return `Set your calorie target to ${kcalText(newKcal)}?`;
  }
  const change = `Change your calorie target from ${formatCalories(currentKcal)} to ${kcalText(newKcal)}?`;
  return programmeActive
    ? `${change} This ends your programme and its weekly check-in. Today and later days use your own targets.`
    : change;
};

/** "Changed your calorie target to 2,000 kcal". */
export const describeTargetsChangedTitle = (kcal: number): string =>
  `Changed your calorie target to ${kcalText(kcal)}`;

/** "Was 2,140 kcal from your programme". NOT ON THE CANVAS without a programme: "Was 1,900 kcal". */
export const describeTargetsChangedSub = (previousKcal: number, fromProgramme: boolean): string =>
  fromProgramme
    ? `Was ${kcalText(previousKcal)} from your programme`
    : `Was ${kcalText(previousKcal)}`;

/** The note after a programme ended: the board's, with the number Undo puts back. */
export const describeTargetsChangedNote = (previousKcal: number | null): string =>
  `Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo puts back ${
    previousKcal === null ? "your targets" : kcalText(previousKcal)
  } and your programme.`;

/** NOT ON THE CANVAS: the programme ended but Undo cannot work, so the note says it is off. */
export const TARGETS_CHANGED_NOTE_PROGRAMME_ENDED_WITHOUT_UNDO =
  "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo is off for this change.";

/** NOT ON THE CANVAS: with no programme the old numbers are kept nowhere, so Undo is off. */
export const TARGETS_CHANGED_NOTE_WITHOUT_UNDO =
  "Undo is off for this change. Ki-Lo does not keep your old numbers, so change them again in More, Targets.";

/** "Put back 2,140 kcal and your programme", the line under "Undone". */
export const describeTargetsChangedUndone = (previousKcal: number | null): string =>
  `Put back ${previousKcal === null ? "your targets" : kcalText(previousKcal)} and your programme`;

export type AdjustedMacros = {
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
};

/**
 * NOT ON THE CANVAS (KEY-824, a draft for Zee). The line the code adds after the model's question when only
 * the calories change: "Your macros will be adjusted proportionally: protein 118 g, carbs 229 g, fat 68 g."
 * A macro that is null is left out.
 */
export const describeMacrosAdjustedNote = ({
  protein_g,
  carbs_g,
  fat_g,
}: AdjustedMacros): string => {
  const figures = [
    ...(protein_g === null ? [] : [`protein ${formatGrams(protein_g)} g`]),
    ...(carbs_g === null ? [] : [`carbs ${formatGrams(carbs_g)} g`]),
    ...(fat_g === null ? [] : [`fat ${formatGrams(fat_g)} g`]),
  ];
  return `Your macros will be adjusted proportionally: ${figures.join(", ")}.`;
};

/** NOT ON THE CANVAS (KEY-824, a draft for Zee): the name of the card row that follows the calories change. */
export const MACROS_ADJUSTED_ROW_NAME = "Macros adjusted proportionally";

/**
 * NOT ON THE CANVAS (KEY-824, a draft for Zee): the card row's figures, "P 118 g · C 229 g · F 68 g", in the
 * style of `assistant-card · food-created`'s row. A macro that is null is left out.
 */
export const describeMacrosAdjustedAmount = ({
  protein_g,
  carbs_g,
  fat_g,
}: AdjustedMacros): string =>
  [
    ...(protein_g === null ? [] : [`P ${formatGrams(protein_g)} g`]),
    ...(carbs_g === null ? [] : [`C ${formatGrams(carbs_g)} g`]),
    ...(fat_g === null ? [] : [`F ${formatGrams(fat_g)} g`]),
  ].join(" · ");
