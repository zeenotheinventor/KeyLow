import { View } from "react-native";

import { AssistantActionCard } from "./AssistantActionCard";

import type { AssistantActionCardDay, AssistantActionCardRow } from "./types";
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

const compoundDetail = "3 sets · 8 to 10 reps · RIR 2";
const isolationDetail = "3 sets · 12 to 15 reps · RIR 1";
const fiveExerciseSummary = "5 exercises · 15 sets · about 50 min";
const eightExerciseSummary = "8 exercises · 24 sets · about 75 min";

const pushExercises = [
  { name: "Barbell bench press", detail: compoundDetail },
  { name: "Overhead press", detail: compoundDetail },
  { name: "Incline dumbbell press", detail: compoundDetail },
  { name: "Lateral raise", detail: isolationDetail },
  { name: "Triceps pushdown", detail: isolationDetail },
];

const pullExercises = [
  { name: "Lat pulldown", detail: compoundDetail },
  { name: "Barbell row", detail: compoundDetail },
  { name: "Seated cable row", detail: compoundDetail },
  { name: "Face pull", detail: isolationDetail },
  { name: "Barbell curl", detail: isolationDetail },
];

const legsExercises = [
  { name: "Barbell squat", detail: compoundDetail },
  { name: "Romanian deadlift", detail: compoundDetail },
  { name: "Leg press", detail: compoundDetail },
  { name: "Seated leg curl", detail: isolationDetail },
  { name: "Standing calf raise", detail: isolationDetail },
];

const threeDays: AssistantActionCardDay[] = [
  { name: "Monday · Push", summary: fiveExerciseSummary, exercises: pushExercises },
  { name: "Wednesday · Pull", summary: fiveExerciseSummary, exercises: pullExercises },
  { name: "Friday · Legs", summary: fiveExerciseSummary, exercises: legsExercises },
];

const upperExercises = [
  { name: "Barbell bench press", detail: compoundDetail },
  { name: "Barbell row", detail: compoundDetail },
  { name: "Overhead press", detail: compoundDetail },
  { name: "Lat pulldown", detail: compoundDetail },
  { name: "Lateral raise", detail: isolationDetail },
  { name: "Face pull", detail: isolationDetail },
  { name: "Barbell curl", detail: isolationDetail },
  { name: "Triceps pushdown", detail: isolationDetail },
];

const sevenDays: AssistantActionCardDay[] = [
  "Monday · Chest",
  "Tuesday · Back",
  "Wednesday · Legs",
  "Thursday · Upper",
  "Friday · Lower",
  "Saturday · Shoulders",
  "Sunday · Arms",
].map((name) => ({ name, summary: eightExerciseSummary, exercises: upperExercises }));

const routineCreatedNote =
  "This is not your active routine. Ask to make it active, or do it in Routines.";
const routineCreatedLink = { label: "Open in routine editor", onPress: () => undefined };
const routineActiveNote =
  "It is your active routine now, so Undo is off. Undo making it active first.";
const routineCreatedSubtitle = "From your goal: look better, intermediate";

const threeDayRoutine = {
  icon: "Check",
  title: "Built routine Push Pull Legs, 3 days",
  subtitle: routineCreatedSubtitle,
  days: threeDays,
  total: "The week: 45 sets · 3 days",
  note: routineCreatedNote,
  link: routineCreatedLink,
  undo: undoAvailable,
} as const;

const sevenDayRoutine = {
  icon: "Check",
  title: "Built routine Seven day split, 7 days",
  subtitle: routineCreatedSubtitle,
  days: sevenDays,
  total: "The week: 168 sets · 7 days",
  note: routineCreatedNote,
  link: routineCreatedLink,
  undo: undoAvailable,
} as const;

const undoOffForActiveRoutine = {
  note: routineActiveNote,
  undo: { state: "unavailable", label: "Can't undo" },
} as const;

// `assistant-card · routine-created`, "3 days, as it arrives": every day closed, the card's own state.
export const RoutineThreeDays: Story = { args: threeDayRoutine };

// `assistant-card · routine-created`, "3 days, a day opened": Monday open, its exercises listed in place.
export const RoutineThreeDaysOpen: Story = {
  args: { ...threeDayRoutine, initiallyOpenDay: 0 },
};

// `assistant-card · routine-created`, "7 days of 8, as it arrives": the card's longest, all closed.
export const RoutineSevenDays: Story = { args: sevenDayRoutine };

// `assistant-card · routine-created`, "7 days of 8, a day opened": Thursday open.
export const RoutineSevenDaysOpen: Story = {
  args: { ...sevenDayRoutine, initiallyOpenDay: 3 },
};

// `assistant-card · routine-created`, "Can't undo": the routine was made active since, and the days stay.
export const RoutineThreeDaysCantUndo: Story = {
  args: { ...threeDayRoutine, ...undoOffForActiveRoutine },
};

export const RoutineThreeDaysOpenCantUndo: Story = {
  args: { ...threeDayRoutine, ...undoOffForActiveRoutine, initiallyOpenDay: 0 },
};

export const RoutineSevenDaysCantUndo: Story = {
  args: { ...sevenDayRoutine, ...undoOffForActiveRoutine },
};

export const RoutineSevenDaysOpenCantUndo: Story = {
  args: { ...sevenDayRoutine, ...undoOffForActiveRoutine, initiallyOpenDay: 3 },
};
