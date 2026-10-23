/** The titles of the four destinations in the tab bar, which are also the headings of their screens. */
export const TAB_TITLES = {
  dashboard: "Dashboard",
  diary: "Diary",
  recipes: "Recipes",
  more: "More",
};

/** Names the tab bar for a screen reader. */
export const TAB_BAR_LABEL = "Main";

/** The accessible name of the centre button, which opens the food search sheet. */
export const ADD_FOOD_BUTTON_LABEL = "Find food";

/** The bar above the tab bar that opens the food search sheet, and its barcode control. */
export const SEARCH_LAUNCHER = {
  label: "Search for a food",
  scanLabel: "Scan barcode",
};

/** The title every placeholder screen shows until its content is built. */
export const COMING_SOON_TITLE = "Coming soon";

/** The sentence under `COMING_SOON_TITLE` on each placeholder the boards draw. */
export const PLACEHOLDER_BODIES = {
  diary: "Your logged foods will appear here, day by day.",
};

/** The More screen: four sections, each a title over its rows, as the `tab-shell.more` board draws them. */
export const MORE_SCREEN = {
  food: {
    title: "Food",
    yourFoods: { title: "Your foods", subtitle: "Foods you created or copied" },
  },
  nutrition: {
    title: "Nutrition",
    targets: { title: "Targets", subtitle: "Set by you" },
  },
  body: { title: "Body", weight: { title: "Weight" } },
  settings: {
    title: "Settings",
    appearance: {
      title: "Appearance",
      options: { dark: "Dark", light: "Light", system: "Match device" },
    },
    reminders: { title: "Reminders" },
    about: { title: "About" },
  },
  account: { title: "Account", signOut: "Sign out" },
};
