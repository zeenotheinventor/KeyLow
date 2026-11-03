/*
 * The words of the assistant's food card, from the approved canvas "Ki-Lo assistant screens"
 * (assistant-card food-created). A string marked NOT ON THE CANVAS is a draft in the board's style that
 * the designers have not drawn, and waits for Zee's approval.
 */

/** "Added food My protein bar". */
export const describeFoodCreatedTitle = (name: string): string => `Added food ${name}`;

/** "Yours · 1 bar". NOT ON THE CANVAS for a food with no portion, which reads "Yours". */
export const describeFoodCreatedSub = (portionLabel: string | null): string =>
  portionLabel === null ? "Yours" : `Yours · ${portionLabel}`;

/** "Per bar" for the portion "1 bar". Any other count stays: "Per 2 slices". NOT ON THE CANVAS: "Per 100 g". */
export const describeFoodCreatedRowName = (portionLabel: string | null): string => {
  if (portionLabel === null) {
    return "Per 100 g";
  }
  const withoutOne = portionLabel.replace(/^(?:1|one)\s+/i, "").trim();
  return `Per ${withoutOne === "" ? portionLabel : withoutOne}`;
};

export const FOOD_CREATED_NOTE = "Not logged yet. Say when you had it, or log it from search.";

export const OPEN_IN_YOUR_FOODS = "Open in your foods";

/** NOT ON THE CANVAS: the line under "Undone" for a created food, in the words of its Undo. */
export const describeFoodCreatedUndone = (name: string): string =>
  `Removed ${name} from your foods`;

/** NOT ON THE CANVAS: several foods made in one turn have no board, so the plain count is used. */
export const describeFoodsCount = (count: number): string =>
  count === 1 ? "Added a food" : `Added ${count} foods`;
