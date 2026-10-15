/**
 * Every primitive in the kit and the states it must have a story for, by the name of the story's
 * export. A primitive without an entry, or an entry without its story, fails the manifest test, so a
 * state cannot be left out of Storybook without the build saying so.
 *
 * States come from the design system card of the component and from the states the approved boards
 * use. A press is an interaction and not a state a story can hold, so it is covered by the component
 * tests and photographed on a device by holding the button down.
 */
export const storyManifest: Record<string, { states: string[] }> = {
  Badge: {
    states: [
      "SourceOpenFoodFacts",
      "SourceCoFid",
      "SourceYours",
      "Neutral",
      "Outlined",
      "Tones",
      "WithDot",
    ],
  },
  Banner: {
    states: [
      "Review",
      "Offline",
      "Info",
      "InfoBusy",
      "InfoWithAction",
      "AddFailed",
      "Sentence",
      "PartialSave",
    ],
  },
  Button: {
    states: [
      "Primary",
      "Secondary",
      "Destructive",
      "Ghost",
      "Small",
      "Large",
      "WithIcon",
      "WithLeadingMark",
      "FullWidth",
      "Disabled",
      "Loading",
    ],
  },
  CalorieRing: {
    states: [
      "UnderTarget",
      "AtTarget",
      "OverTarget",
      "Compact",
      "Estimate",
      "NotAnEstimate",
      "NothingEaten",
    ],
  },
  Card: { states: ["Surface", "Raised", "Compact", "Rows"] },
  Checkbox: { states: ["Unticked", "Ticked", "WithLinks", "Disabled", "DisabledTicked"] },
  ChipGroup: {
    states: ["TwoChips", "FiveChipsScroll", "LongLabel", "OneSelected", "NoneSelected"],
  },
  EmptyState: { states: ["NoResults", "YourFoodsEmpty", "WithoutAction", "Wide"] },
  ErrorState: { states: ["SearchFailed", "WithRetry", "WithAction"] },
  FoodRow: {
    states: [
      "Default",
      "WithBrand",
      "LongName",
      "PerBasis",
      "NoEnergy",
      "Pending",
      "Disabled",
      "Search",
      "Recent",
      "Diary",
      "Swiped",
      "LongTitleAndCaption",
      "StatsLineWraps",
      "NeedsReview",
      "AddDisabled",
      "FourDigitEnergy",
    ],
  },
  GroupedList: { states: ["Default", "WithSeeMore", "TitleOnly", "WithNotice"] },
  Icon: { states: ["Sizes", "Tones", "Labelled", "Names"] },
  IconButton: { states: ["Secondary", "Ghost", "Ring", "Disabled"] },
  Input: {
    states: [
      "Empty",
      "Compact",
      "Filled",
      "WithHelper",
      "WithLabelHint",
      "Focused",
      "WithError",
      "ErrorShownElsewhere",
      "WithAccessibleLabel",
      "Disabled",
      "Locked",
      "Password",
    ],
  },
  ListRow: { states: ["Default", "WithValue", "TitleOnly", "Disabled", "WithControl"] },
  MacroBars: { states: ["UnderTarget", "OverTarget", "NoTarget", "Compact"] },
  NumericInput: {
    states: [
      "Empty",
      "Filled",
      "Comfortable",
      "Macros",
      "WithHelper",
      "Focused",
      "WithError",
      "ErrorShownElsewhere",
      "WithMissingNote",
      "Disabled",
    ],
  },
  PressableSurface: { states: ["Default", "Disabled", "Busy"] },
  SegmentedControl: {
    states: [
      "PerHundredGrams",
      "PerHundredMillilitres",
      "AppearanceDark",
      "AppearanceLight",
      "AppearanceMatchDevice",
    ],
  },
  SearchField: { states: ["Empty", "Filled", "WithClear", "Focused"] },
  SearchLauncher: { states: ["Default", "AboveTabBar"] },
  SheetHeader: { states: ["Search", "Detail", "Form", "Scanner"] },
  Skeleton: { states: ["Row", "Group", "Detail"] },
  Switch: { states: ["Off", "On"] },
  TabBar: {
    states: [
      "IosDashboard",
      "IosDiary",
      "IosRecipes",
      "IosMore",
      "AndroidDashboard",
      "AndroidMore",
      "Interactive",
      "AndroidInteractive",
    ],
  },
  Text: {
    states: [
      "DisplayNumeral",
      "RingNumeral",
      "H1",
      "H2",
      "Body",
      "BodyStrong",
      "Caption",
      "LabelSmall",
      "NumeralSmall",
      "Tones",
      "TabularFigures",
    ],
  },
};
