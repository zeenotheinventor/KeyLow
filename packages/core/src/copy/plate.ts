import { RECIPE_BADGE } from "./recipeLog";
import { spokenAmount } from "./spokenAmount";

/**
 * The words of the plate, as the "Ki-Lo plate" boards draw them. Undo is `LOG_SEARCH.undo`, the message under
 * an empty amount is `DIARY_PROBLEMS.quantity`, Save is `FOOD_FORM.save`, Time is `TIME_ROW_LABEL`, and the
 * offline banner's title is `OFFLINE_BANNER.title`.
 */
export const PLATE = {
  title: "Your plate",
  clear: "Clear plate",
  /** The word under a recipe's name on a plate row. */
  recipe: RECIPE_BADGE,
  /** The label of the totals card: what the plate comes to. */
  onYourPlate: "On your plate",
  /** The main button of the portion picker when it puts an amount on the plate. */
  addToPlate: "Add to plate",
  /** The toast after Clear plate, which carries Undo. */
  cleared: "Plate cleared",
  /** The toast and the sheet's banner when the plate could not be logged. It never quotes a food or an amount. */
  notLogged: "Not logged. Check your connection and try again.",
  /** What sits under the offline banner's title while foods are being put on the plate. */
  offlineBody: "You can fill your plate. Logging it needs a connection.",
  discard: {
    title: "Discard your plate?",
    confirmLabel: "Discard",
    cancelLabel: "Keep adding",
  },
};

/** The count on the plate: "1 food", "4 foods". */
export const describeFoodCount = (count: number): string =>
  count === 1 ? "1 food" : `${count} foods`;

/** The label of the button that logs the plate: "Log food" for one food, "Log foods" for two or more. */
export const describeLogPlateAction = (count: number): string =>
  count === 1 ? "Log food" : "Log foods";

/** The name of that button: "Log foods, 4 foods on your plate". */
export const describeLogPlateActionName = (count: number): string =>
  `${describeLogPlateAction(count)}, ${describeFoodCount(count)} on your plate`;

/** The name of the plate chip in the header: "Your plate, 4 foods". */
export const describePlateChipName = (count: number): string =>
  `${PLATE.title}, ${describeFoodCount(count)}`;

/** The name of a row's plus: the food and the serving it puts on the plate. */
export const describeAddToPlateName = (foodName: string, serving: string): string =>
  `Add ${foodName}, ${serving}, to your plate`;

/** What a screen reader hears after a plus: no toast is drawn. */
export const describeAddedToPlate = (foodName: string): string => `${foodName} added to your plate`;

/**
 * The heading of the plate's totals card and the strip's name while there is a plate: "Today with your plate".
 * `dayTitle` is the title of the day the search was opened on, which is `describeDay(...).label` and so reads
 * Today, Yesterday or a short date such as "Wed 14 Oct".
 */
export const describePlateDay = (dayTitle: string): string => `${dayTitle} with your plate`;

/** The words the strip's name starts with: the day's title alone while the plate is empty, else `describePlateDay`. */
export const describeStripDay = (dayTitle: string, hasPlate: boolean): string =>
  hasPlate ? describePlateDay(dayTitle) : dayTitle;

/** The name of a row's remove button. */
export const describeRemoveFromPlate = (foodName: string): string =>
  `Remove ${foodName} from your plate`;

/** The name of a row's amount field. `units` is the plural unit word: "servings", "pots", "ml". */
export const describePlateAmountField = (foodName: string, units: string): string =>
  `Amount of ${foodName}, ${units}`;

/**
 * The name of the button that is a row's name and stats: "Chicken and rice, 1 serving, 374 kilocalories, change
 * amount or unit". `amountText` is what the field reads, `unitWord` the word after it and `energy` the row's
 * kilocalories as `formatCalories` writes them. The amount is left out while the field is empty.
 */
export const describePlateRowOpenName = (
  foodName: string,
  amountText: string,
  unitWord: string,
  energy: string,
): string =>
  [
    foodName,
    amountText.trim() === "" ? undefined : `${amountText} ${unitWord}`,
    spokenAmount(energy, "kilocalorie", "kilocalories"),
    "change amount or unit",
  ]
    .filter((part) => part !== undefined)
    .join(", ");

/** The body of the dialog that asks before the plate is thrown away. */
export const describeDiscardPlateBody = (count: number): string =>
  `The ${describeFoodCount(count)} on it won't be logged.`;

/** The toast after the plate is logged: the food's name for one food, else the count. */
export const describeLoggedPlate = (foodNames: readonly string[]): string => {
  const [onlyFood] = foodNames;

  return foodNames.length === 1 && onlyFood !== undefined
    ? `Logged ${onlyFood}`
    : `Logged ${describeFoodCount(foodNames.length)}`;
};
