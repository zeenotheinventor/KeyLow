/*
 * The words of the Foods to avoid screen and of the "Your food" group that opens it from the Assistant
 * settings (the boards `settings · foods-to-avoid` and `settings · assistant-your-food`, in
 * `docs/design/kitchen/proposals/`). The row of "What you usually eat" takes its words from
 * `PALATE_WORDS`.
 */

export const FOODS_TO_AVOID = {
  title: "Foods to avoid",
  back: "Back to Assistant",
  intro: "The assistant leaves these out of the recipes and meal plans it suggests.",
  /** The add field's accessible name. The board draws only its placeholder. */
  fieldLabel: "Food",
  placeholder: "Add a food, such as peanuts",
  kindLabel: "Kind",
  dislike: "Dislike",
  allergy: "Allergy",
  add: "Add",
  listTitle: "Your list",
  disclaimer:
    "Allergies are matched by food name only. Ki-Lo has no allergen data, so a food can contain peanuts without saying so. Always check labels and ingredients yourself.",
  // NOT ON THE CANVAS: no board draws the empty list, the refusal of a word already on it or a failure.
  // The failure words follow the patterns of the diary (`DIARY_LOAD_FAILED`, `SAVE_FAILED_BANNER`).
  emptyTitle: "Nothing on your list yet",
  emptyBody:
    "Add a food above and the assistant will leave it out of the recipes and meal plans it suggests.",
  duplicate: "That is already on your list.",
  loadFailedTitle: "Couldn't load your list",
  loadFailedBody: "Check your connection and try again.",
  removeFailed: "Not removed. Check your connection and try again.",
} as const;

export const YOUR_FOOD = {
  groupTitle: "Your food",
  groupCaption: "The assistant uses these when it suggests recipes and meal plans.",
  avoidRowSubtitle: "Dislikes and allergies",
  // NOT ON THE CANVAS: the stand-in body of the palate screen until it is built.
  comingSoon: "Coming soon",
} as const;

/** "peanuts" is listed as "Peanuts", as the board writes it. */
export const describeAvoidedFoodName = (label: string): string =>
  `${label.slice(0, 1).toUpperCase()}${label.slice(1)}`;

/** The accessible name of a row's remove button: "Remove peanuts". */
export const describeRemoveAvoidedFood = (label: string): string => `Remove ${label.toLowerCase()}`;

/**
 * What to say when a word is on the list under the other kind than the one chosen, so a person does not
 * think an allergy is recorded when it was stored as a dislike. `existingKind` is the kind it is stored as.
 * NOT ON THE CANVAS.
 */
export const describeAvoidedKindConflict = (
  label: string,
  existingKind: "dislike" | "allergy",
): string =>
  existingKind === "dislike"
    ? `${describeAvoidedFoodName(label)} is on your list as a dislike. Remove it first to add it as an allergy.`
    : `${describeAvoidedFoodName(label)} is on your list as an allergy. Remove it first to add it as a dislike.`;
