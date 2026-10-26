import { View } from "react-native";

import { AssistantActionCard } from "./AssistantActionCard";

import type { AssistantActionCardRow } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// Each story is one `assistant-card` board, or the `assistant` board named in its comment, with the
// board's own words. The glyphs are the ones in the icon map, and RotateCcw is the one the Undone board draws.
const meta = {
  title: "UI/AssistantActionCard",
  component: AssistantActionCard,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof AssistantActionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

// The Undo label is `UNDO_LABEL` in `@keylow/core/copy`, as the diary toast draws it.
const undoAvailable = { state: "available", label: "Undo", onPress: () => undefined } as const;

const eggsAndToastRows: AssistantActionCardRow[] = [
  { name: "Egg, boiled", detail: "2 large eggs (100 g) · 08:10", value: "144 kcal" },
  { name: "Toast, white bread", detail: "1 slice (30 g) · 08:10", value: "88 kcal" },
];

const eggsAndToastTotal = "232 kcal · P 15 g · C 17 g · F 10 g";

// `assistant-card · logged`: a write, its entries, the total, and Undo.
export const Logged: Story = {
  args: {
    icon: "Check",
    title: "Logged 2 eggs and toast at 08:10",
    rows: eggsAndToastRows,
    total: eggsAndToastTotal,
    undo: undoAvailable,
  },
};

// The Undo while it runs: the same button, busy, which does nothing on a press.
export const UndoBusy: Story = {
  args: { ...Logged.args, undo: { state: "busy", label: "Undo" } },
};

// `assistant-card · day-copied`: no rows, and a subtitle under the title.
export const DayCopied: Story = {
  args: {
    icon: "Copy",
    iconTone: "secondary",
    title: "Copied 8 entries from yesterday",
    subtitle: "Saturday 24 October to today · 1,940 kcal",
    undo: undoAvailable,
  },
};

// `assistant-card · recipe-created`: the per-serving numbers as the subtitle, and a link into the editor.
export const RecipeCreated: Story = {
  args: {
    icon: "ChefHat",
    title: "Added recipe Chicken and rice, 4 servings",
    subtitle: "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g",
    link: { label: "Open in recipe editor", onPress: () => undefined },
    undo: undoAvailable,
  },
};

// `assistant-card · undone`: no action, the title in the secondary colour, and the icon muted.
export const Undone: Story = {
  args: {
    icon: "RotateCcw",
    iconTone: "muted",
    title: "Undone",
    subtitle: "Removed 2 eggs and toast from 08:10",
    undo: { state: "done", label: "Undo" },
  },
};

// `assistant-card · undo-unavailable`: the entries changed since, so the label is plain words and a note says why.
export const UndoUnavailable: Story = {
  args: {
    icon: "Check",
    title: "Logged 2 eggs and toast at 08:10",
    rows: eggsAndToastRows,
    total: eggsAndToastTotal,
    note: "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
    undo: { state: "unavailable", label: "Can't undo" },
  },
};

// `assistant-card · food-created`: one row, a note and a link.
export const FoodCreated: Story = {
  args: {
    icon: "Apple",
    title: "Added food My protein bar",
    subtitle: "Yours · 1 bar",
    rows: [{ name: "Per bar", detail: "P 20 g · C 19 g · F 6 g", value: "210 kcal" }],
    note: "Not logged yet. Say when you had it, or log it from search.",
    link: { label: "Open in your foods", onPress: () => undefined },
    undo: undoAvailable,
  },
};

// `assistant-card · targets-changed`: a subtitle and a note, with Undo.
export const TargetsChanged: Story = {
  args: {
    icon: "Target",
    iconTone: "secondary",
    title: "Changed your calorie target to 2,000 kcal",
    subtitle: "Was 2,140 kcal from your programme",
    note: "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo puts back 2,140 kcal and your programme.",
    undo: undoAvailable,
  },
};

// `assistant · clarify`, the second phone: the card after a clarifying question. The rice row reads
// "200 g · 13:00" with no hand measure and no Estimate badge.
export const ClarifyLogged: Story = {
  args: {
    icon: "Check",
    title: "Logged chicken and rice at 13:00",
    rows: [
      {
        name: "Chicken breast, grilled",
        detail: "1 chicken breast (130 g) · 13:00",
        value: "192 kcal",
      },
      { name: "White rice, boiled", detail: "200 g · 13:00", value: "276 kcal" },
    ],
    total: "468 kcal · P 47 g · C 62 g · F 3.5 g",
    note: "If it was more or less, change it in the diary.",
    undo: undoAvailable,
  },
};

// `assistant · confirm`: the card after a yes, "3 entries deleted".
export const ConfirmDeleted: Story = {
  args: {
    icon: "Trash2",
    iconTone: "secondary",
    title: "3 entries deleted",
    subtitle: "Chicken and rice, Greek yoghurt, apple · 13:00",
    undo: undoAvailable,
  },
};

const recipeRows: AssistantActionCardRow[] = [
  {
    name: "800 g chicken thighs, skinless",
    detail: "Chicken, thigh, skinless, raw · UK CoFID",
    match: "matched",
    matchLabel: "Matched",
  },
  {
    name: "750 g new potatoes",
    detail: "Potatoes, new, raw · UK CoFID",
    match: "matched",
    matchLabel: "Matched",
  },
  {
    name: "2 tbsp olive oil",
    detail: "Olive oil · UK CoFID",
    match: "matched",
    matchLabel: "Matched",
  },
  { name: "1 lemon", detail: "Lemon, whole · UK CoFID", match: "matched", matchLabel: "Matched" },
  {
    name: "4 garlic cloves",
    detail: "Garlic, raw · UK CoFID",
    match: "matched",
    matchLabel: "Matched",
  },
];

// `assistant · recipe-import`: every ingredient matched, and the milk the one estimated line, with the
// Estimate badge beside its detail.
export const RecipeImport: Story = {
  args: {
    icon: "ChefHat",
    title: "Added recipe Lemon chicken traybake, 4 servings",
    subtitle: "From example.com/lemon-traybake",
    rows: [
      ...recipeRows,
      {
        name: "A splash of milk",
        detail: "Milk, semi-skimmed · 50 ml (a splash, estimated) · UK CoFID",
        match: "matched",
        matchLabel: "Matched",
        estimateLabel: "Estimate",
      },
    ],
    total: "Per serving 570 kcal · P 42 g · C 36 g · F 29 g",
    link: { label: "Open in recipe editor", onPress: () => undefined },
    undo: undoAvailable,
  },
};

// `assistant · recipe-unresolved`: one ingredient not matched, its detail in the warning ink with the
// Not matched badge, and a link to choose a food for it.
export const RecipeUnresolved: Story = {
  args: {
    icon: "ChefHat",
    title: "Added recipe Lemon chicken traybake, 4 servings",
    subtitle: "From example.com/lemon-traybake",
    rows: [
      ...recipeRows,
      {
        name: "A splash of white wine",
        detail: "Not counted. Choose a food in the recipe editor.",
        match: "unresolved",
        matchLabel: "Not matched",
      },
    ],
    total: "Per serving 564 kcal · P 42 g · C 35 g · F 29 g",
    link: { label: "Choose a food for the wine", onPress: () => undefined },
    undo: undoAvailable,
  },
};
