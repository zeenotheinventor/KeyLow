/**
 * The titles of the destinations in the tab bar, which are also the headings of their screens. Train's
 * title is `TRAIN_HOME.tabLabel`. Recipes left the bar and is a row of More's Nutrition section.
 */
export const TAB_TITLES = {
  dashboard: "Dashboard",
  diary: "Diary",
  more: "More",
};

/** Names the tab bar for a screen reader. */
export const TAB_BAR_LABEL = "Main";

/** The accessible name of the centre button, which opens the food search sheet. */
export const ADD_FOOD_BUTTON_LABEL = "Find food";

/**
 * The bar above the tab bar that opens the food search sheet, and its barcode control. The phone scans a
 * barcode with its camera. The web cannot scan, so its button looks one up and has its own words.
 */
export const SEARCH_LAUNCHER = {
  label: "Search for a food",
  scanLabel: "Scan barcode",
  lookUpLabel: "Look up a barcode",
};

/** The toast shown once, after the splash screen has gone, the first time the app starts on a new update. */
export const UPDATED_TOAST = "Ki-Lo has been updated!";

/** The name of the screen reader action that takes a toast down, as the swipe-up "Actions" menu reads it. */
export const TOAST_DISMISS_LABEL = "Dismiss";

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
    targets: {
      title: "Targets",
      subtitle: "Set by you",
      subtitleFromProgram: "From your programme",
    },
    program: { title: "Programme", subtitleWithoutProgram: "Let Ki-Lo set your targets" },
    recipes: { title: "Recipes" },
  },
  body: { title: "Body", weight: { title: "Weight" } },
  settings: {
    title: "Settings",
    appearance: {
      title: "Appearance",
      options: { dark: "Dark", light: "Light", system: "Match device" },
    },
    bodyMap: {
      title: "Body map",
      options: { twoD: "2D", threeD: "3D" },
      femaleNote:
        "3D draws the male body for now. Your figure is female, so the body map stays 2D.",
    },
    reminders: { title: "Reminders" },
    about: { title: "About" },
  },
  account: { title: "Account", signOut: "Sign out" },
};
