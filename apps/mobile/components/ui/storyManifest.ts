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
  Banner: { states: ["Review", "Offline", "Info", "InfoBusy", "InfoWithAction", "AddFailed"] },
  Button: {
    states: [
      "Primary",
      "Secondary",
      "Destructive",
      "Ghost",
      "Large",
      "WithIcon",
      "FullWidth",
      "Disabled",
      "Loading",
    ],
  },
  EmptyState: { states: ["NoResults", "YourFoodsEmpty", "WithoutAction"] },
  ErrorState: { states: ["SearchFailed", "WithRetry"] },
  FoodRow: {
    states: ["Default", "WithBrand", "LongName", "PerBasis", "NoEnergy", "Pending", "Disabled"],
  },
  GroupedList: { states: ["Default", "WithSeeMore", "TitleOnly"] },
  Icon: { states: ["Sizes", "Tones", "Labelled", "Names"] },
  IconButton: { states: ["Secondary", "Ghost", "Disabled"] },
  ListRow: { states: ["Default", "WithValue", "TitleOnly", "Disabled"] },
  PressableSurface: { states: ["Default", "Disabled", "Busy"] },
  SearchField: { states: ["Empty", "Filled", "WithClear", "Focused"] },
  SheetHeader: { states: ["Search", "Detail", "Form", "Scanner"] },
  Skeleton: { states: ["Row", "Group"] },
  Text: {
    states: [
      "DisplayNumeral",
      "H1",
      "H2",
      "Body",
      "BodyStrong",
      "Caption",
      "NumeralSmall",
      "Tones",
      "TabularFigures",
    ],
  },
};
