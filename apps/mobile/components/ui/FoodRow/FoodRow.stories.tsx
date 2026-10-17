import { View } from "react-native";

import { Card } from "../Card";
import { IconButton } from "../IconButton";
import { FoodRow } from "./FoodRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/FoodRow",
  component: FoodRow,
  decorators: [
    (Story) => (
      // The rows bring their own padding, so the card has none.
      <View className="flex-1 justify-center p-4">
        <Card padding={0}>
          <Story />
        </Card>
      </View>
    ),
  ],
  // What the search helpers in @keylow/core write for "stock cubes", for Savoury Stock Cube.
  args: {
    nameSegments: [
      { text: "Savoury ", matched: false },
      { text: "Stock", matched: true },
      { text: " Cube", matched: false },
    ],
    energy: "250",
    macros: {
      protein: "8",
      carbs: "25",
      fat: "12",
      description: "protein 8 grams, fat 12 grams, carbohydrate 25 grams",
    },
    onPress: () => undefined,
  },
} satisfies Meta<typeof FoodRow>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithBrand: Story = {
  args: {
    nameSegments: [
      { text: "Chicken ", matched: false },
      { text: "Stock Cubes", matched: true },
    ],
    brand: "Northfield Mills",
    energy: "245",
    macros: {
      protein: "10",
      carbs: "18",
      fat: "15",
      description: "protein 10 grams, fat 15 grams, carbohydrate 18 grams",
    },
  },
};

// A name that needs two lines, with the brand wrapping after it.
export const LongName: Story = {
  args: {
    nameSegments: [
      { text: "Reduced Salt Chicken ", matched: false },
      { text: "Stock", matched: true },
    ],
    brand: "Orchard Lane",
    energy: "210",
    macros: {
      protein: "9.4",
      carbs: "16",
      fat: "13",
      description: "protein 9.4 grams, fat 13 grams, carbohydrate 16 grams",
    },
  },
};

// A drink's macros are per 100 ml, which the row writes after them.
export const PerBasis: Story = {
  args: {
    nameSegments: [{ text: "Cold brew coffee", matched: false }],
    energy: "5",
    macros: {
      protein: "0.3",
      carbs: "0.6",
      fat: "0",
      description: "protein 0.3 grams, fat 0 grams, carbohydrate 0.6 grams",
    },
    basis: "per 100 ml",
  },
};

// A food with no energy given says so in place of the macros and shows no value.
export const NoEnergy: Story = {
  args: {
    nameSegments: [
      { text: "Vegetable ", matched: false },
      { text: "Stock", matched: true },
      { text: " Pot", matched: false },
    ],
    energy: undefined,
    macros: undefined,
    note: "Energy not given",
  },
};

// The row of a product being added: a spinner takes the place of the energy and the chevron.
export const Pending: Story = {
  args: {
    nameSegments: [
      { text: "Chicken ", matched: false },
      { text: "Stock Cubes", matched: true },
    ],
    brand: "Northfield Mills",
    energy: undefined,
    macros: undefined,
    busyLabel: "Adding to your foods",
  },
};

// The rows around a pending one are dimmed and do nothing.
export const Disabled: Story = { args: { disabled: true } };

// The food log's rows. The texts are what @keylow/core writes for the sample day of the boards.
const banana = {
  nameSegments: [{ text: "Banana", matched: true }],
  caption: "1 medium (100 g)",
  energy: "95",
  macros: {
    protein: "1.2",
    carbs: "20.3",
    fat: "0.1",
    description: "protein 1.2 grams, fat 0.1 grams, carbohydrate 20.3 grams",
  },
};

const chickenBreast = {
  nameSegments: [{ text: "Chicken breast, grilled", matched: true }],
  caption: "12:40 · 150 g",
  energy: "222",
  macros: {
    protein: "48",
    carbs: "0",
    fat: "3.3",
    description: "protein 48 grams, fat 3.3 grams, carbohydrate 0 grams",
  },
};

// Search results: the food icon tile, the serving, the stats line and the quiet add button.
export const Search: Story = { args: { ...banana, layout: "search", onAdd: () => undefined } };

// Recent: the caption is the amount last logged, the row is 56 points tall and the name is semibold.
export const Recent: Story = {
  args: {
    ...banana,
    layout: "recent",
    nameSegments: [{ text: "Greek yoghurt 0% fat", matched: false }],
    caption: "1 pot (170 g)",
    energy: "97",
    macros: {
      protein: "17.3",
      carbs: "6.5",
      fat: "0.3",
      description: "protein 17.3 grams, fat 0.3 grams, carbohydrate 6.5 grams",
    },
    onAdd: () => undefined,
  },
};

// A logged food: no tile, the time in the caption, a chevron, and swipe to delete.
export const Diary: Story = {
  args: { ...chickenBreast, layout: "diary", onDelete: () => undefined },
};

// A logged food with nothing to open: plain text with no chevron, and still swipe to delete.
export const DiaryNothingToOpen: Story = {
  args: { ...chickenBreast, layout: "diary", onDelete: () => undefined },
  // The meta gives every story a press, and its inferred type does not let a story take it away in `args`.
  render: (args) => <FoodRow {...args} onPress={undefined} />,
};

// A logged recipe as the diary draws it: a chef's hat before a one line name, the serving, and nothing to open.
export const DiaryRecipe: Story = {
  args: {
    layout: "diary",
    isLoggedRecipe: true,
    nameSegments: [{ text: "Chicken and rice", matched: false }],
    openLabel:
      "18:00, Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams",
    caption: "18:00 · 1 serving (275 g)",
    energy: "374",
    macros: { protein: "32", carbs: "43", fat: "8.1", description: "" },
    onDelete: () => undefined,
  },
  render: (args) => <FoodRow {...args} onPress={undefined} />,
};

// A long recipe name stays on one line and ends in an ellipsis, beside the hat.
export const DiaryRecipeLongName: Story = {
  ...DiaryRecipe,
  args: {
    ...DiaryRecipe.args,
    openLabel:
      "18:00, Slow cooked chicken and basmati rice with roasted peppers and lemon, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams",
    nameSegments: [
      {
        text: "Slow cooked chicken and basmati rice with roasted peppers and lemon",
        matched: false,
      },
    ],
  },
};

// The row after a swipe left: the danger Delete action, 88 points wide.
export const Swiped: Story = {
  args: { ...chickenBreast, layout: "diary", onDelete: () => undefined, startsSwiped: true },
};

// A title that needs both its lines, a caption longer than its line, and the stats line below them.
export const LongTitleAndCaption: Story = {
  args: {
    ...banana,
    layout: "search",
    nameSegments: [
      { text: "Reduced salt roast chicken ", matched: true },
      { text: "breast fillets in a garlic and herb marinade, skinless", matched: false },
    ],
    caption: "1 large fillet, cooked weight without the skin or the bone (165 g)",
    onAdd: () => undefined,
  },
};

// A narrow row, where the stats line breaks between its items and never inside one.
export const StatsLineWraps: Story = {
  args: {
    ...banana,
    layout: "search",
    brand: "Northfield Mills",
    energy: "1,373",
    onAdd: () => undefined,
  },
  decorators: [
    (Story) => (
      <View className="w-[260px] self-center">
        <Story />
      </View>
    ),
  ],
};

// A food missing a macro: Needs review in place of the dots, and a chevron in place of the plus.
export const NeedsReview: Story = {
  args: {
    ...banana,
    layout: "search",
    nameSegments: [{ text: "Rice pudding", matched: true }],
    caption: "1 pot (200 g)",
    energy: "130",
    needsReview: true,
    onAdd: () => undefined,
  },
};

// The plus dimmed while offline, with the row left readable and pressable.
export const AddDisabled: Story = {
  args: { ...banana, layout: "search", onAdd: () => undefined, addDisabled: true },
};

// A four-digit energy, with its thousands separator.
export const FourDigitEnergy: Story = {
  args: {
    ...chickenBreast,
    layout: "diary",
    nameSegments: [{ text: "Lasagne", matched: true }],
    caption: "19:30 · 1 portion (400 g)",
    energy: "1,373",
    macros: {
      protein: "63",
      carbs: "112",
      fat: "72",
      description: "protein 63 grams, fat 72 grams, carbohydrate 112 grams",
    },
    onDelete: () => undefined,
  },
};

// The golden recipe as the library writes a row: the serving and the yield, and the values of one serving.
const chickenAndRice = {
  layout: "recipe",
  nameSegments: [{ text: "Chicken and rice", matched: false }],
  openLabel:
    "Chicken and rice, 1 serving 275 grams, makes 4, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams, open",
  caption: "1 serving (275 g) · makes 4",
  energy: "374",
  macros: { protein: "32", carbs: "43", fat: "8.1", description: "" },
} as const;

export const Recipe: Story = { args: chickenAndRice };

// The match is the only semibold part of the title while a search is typed.
export const RecipeMatched: Story = {
  args: {
    ...chickenAndRice,
    nameSegments: [
      { text: "Chi", matched: true },
      { text: "cken and rice", matched: false },
    ],
  },
};

// The row menu ticket puts its More button here; the slot sits beside the row and does not press it.
export const RecipeWithMore: Story = {
  args: chickenAndRice,
  // An element is drawn in `render`, because Storybook walks every arg to infer its type.
  render: (args) => (
    <FoodRow
      {...args}
      trailing={<IconButton icon="Ellipsis" label="More for Chicken and rice" variant="ghost" />}
    />
  ),
};
