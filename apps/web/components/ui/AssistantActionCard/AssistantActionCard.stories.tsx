import { Apple, ChefHat, Check, Copy, MessageSquareText, RotateCcw, Target } from "lucide-react";

import { AssistantActionCard } from "./AssistantActionCard";
import { AssistantLinkRow } from "./AssistantLinkRow";
import {
  argsOfDraft,
  goalsUpdated,
  routineActive,
  routineArchived,
  routineUpdated,
  setUpdated,
  sevenDayRoutine,
  threeDayRoutine,
  workoutDeleted,
} from "./trainingCardArgs";

import type { AssistantActionCardRow } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

// Each story is one `web-assistant-card` board, or the `web-assistant` board named in its comment, with the
// board's own words. The card sits in the assistant panel, which is the sheet surface, 400 px wide.
const meta = {
  title: "UI/AssistantActionCard",
  component: AssistantActionCard,
  decorators: [
    (Story) => (
      <div className="flex w-[400px] max-w-full flex-col gap-3 bg-surface-sheet p-4">
        <Story />
      </div>
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

// `web-assistant-card · logged`: a write, its entries, the total, and Undo.
export const Logged: Story = {
  args: {
    icon: Check,
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

// `web-assistant-card · day-copied`: no rows, and a subtitle under the title.
export const DayCopied: Story = {
  args: {
    icon: Copy,
    iconTone: "secondary",
    title: "Copied 8 entries from yesterday",
    subtitle: "Saturday 24 October to today · 1,940 kcal",
    undo: undoAvailable,
  },
};

// `web-assistant-card · recipe-created`: the per-serving numbers as the subtitle, and a link into the editor.
export const RecipeCreated: Story = {
  args: {
    icon: ChefHat,
    title: "Added recipe Chicken and rice, 4 servings",
    subtitle: "Per serving 550 kcal · P 37 g · C 79 g · F 8.6 g",
    link: { label: "Open in recipe editor", onPress: () => undefined },
    undo: undoAvailable,
  },
};

// `web-assistant-card · undone`: no action, the title in the secondary colour, and the icon muted.
export const Undone: Story = {
  args: {
    icon: RotateCcw,
    iconTone: "muted",
    title: "Undone",
    subtitle: "Removed 2 eggs and toast from 08:10",
    undo: { state: "done", label: "Undo" },
  },
};

// `web-assistant-card · undo-unavailable`: the entries changed since, so the label is plain words and a note says why.
export const UndoUnavailable: Story = {
  args: {
    icon: Check,
    title: "Logged 2 eggs and toast at 08:10",
    rows: eggsAndToastRows,
    total: eggsAndToastTotal,
    note: "You changed these entries in your diary since, so Undo is off. Edit or delete them in the diary.",
    undo: { state: "unavailable", label: "Can't undo" },
  },
};

// `web-assistant-card · food-created`: one row, a note and a link.
export const FoodCreated: Story = {
  args: {
    icon: Apple,
    title: "Added food My protein bar",
    subtitle: "Yours · 1 bar",
    rows: [{ name: "Per bar", detail: "P 20 g · C 19 g · F 6 g", value: "210 kcal" }],
    note: "Not logged yet. Say when you had it, or log it from search.",
    link: { label: "Open in your foods", onPress: () => undefined },
    undo: undoAvailable,
  },
};

// `web-assistant-card · targets-changed`: a subtitle and a note, with Undo.
export const TargetsChanged: Story = {
  args: {
    icon: Target,
    iconTone: "secondary",
    title: "Changed your calorie target to 2,000 kcal",
    subtitle: "Was 2,140 kcal from your programme",
    note: "Your programme has ended, so Ki-Lo stops adjusting your targets each week. Undo puts back 2,140 kcal and your programme.",
    undo: undoAvailable,
  },
};

// The card of a sent feature request: the same card, and no Undo.
export const FeatureRequested: Story = {
  args: {
    icon: MessageSquareText,
    iconTone: "secondary",
    title: "Sent a feature request",
    undo: { state: "unavailable", label: "Can't undo" },
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

// `web-assistant · recipe-import`: a guessed amount carries the Estimate badge beside its detail.
export const RecipeImport: Story = {
  args: {
    icon: ChefHat,
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

// `web-assistant · recipe-unresolved`: one ingredient not matched, its detail in the warning ink with the
// Not matched badge, and a link to choose a food for it.
export const RecipeUnresolved: Story = {
  args: {
    icon: ChefHat,
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

// The link on its own under an answer that made no card, as its own bordered row.
export const StandaloneLink: Story = {
  args: Logged.args,
  render: () => (
    <AssistantLinkRow isStandalone label="Open in routine editor" onPress={() => undefined} />
  ),
};

// The training stories are made by core's own card builders and `describeAssistantCard` (see
// `trainingCardArgs.ts`), as the `web-assistant-card` boards were, so their words are core's.

// `web-assistant-card · routine-created`, "3 days, as it arrives": every day closed, the card's own state.
export const RoutineThreeDays: Story = { args: argsOfDraft(threeDayRoutine) };

// `web-assistant-card · routine-created`, "3 days, a day opened": Monday open, its exercises listed in place.
export const RoutineThreeDaysOpen: Story = {
  args: argsOfDraft(threeDayRoutine, { initiallyOpenDay: 0 }),
};

// `web-assistant-card · routine-created`, "7 days, as it arrives": the card's longest, all closed.
export const RoutineSevenDays: Story = { args: argsOfDraft(sevenDayRoutine) };

// `web-assistant-card · routine-created`, "7 days, a day opened, scrolled": Thursday open.
export const RoutineSevenDaysOpen: Story = {
  args: argsOfDraft(sevenDayRoutine, { initiallyOpenDay: 3 }),
};

// `web-assistant-card · routine-created`, "Can't undo, now active": the routine was made active since.
export const RoutineThreeDaysCantUndo: Story = {
  args: argsOfDraft(threeDayRoutine, { outcome: { state: "unavailable", reason: "active" } }),
};

// `web-assistant-card · undo-unavailable-training`, "Built routine, during a workout".
export const RoutineThreeDaysCantUndoYet: Story = {
  args: argsOfDraft(threeDayRoutine, { workoutInProgress: true }),
};

// `web-assistant-card · routine-updated`, "With Undo".
export const RoutineUpdated: Story = { args: argsOfDraft(routineUpdated) };

// `web-assistant-card · routine-states`, "Active, with Undo".
export const RoutineActive: Story = { args: argsOfDraft(routineActive) };

// `web-assistant-card · routine-states`, "Archived, with Undo".
export const RoutineArchived: Story = { args: argsOfDraft(routineArchived) };

// `web-assistant-card · goals-updated`, "With Undo".
export const GoalsUpdated: Story = { args: argsOfDraft(goalsUpdated) };

// `web-assistant-card · set-updated`, "One set, kg".
export const SetUpdated: Story = { args: argsOfDraft(setUpdated) };

// `web-assistant-card · undo-unavailable-training`, "During a workout".
export const SetUpdatedCantUndoYet: Story = {
  args: argsOfDraft(setUpdated, { workoutInProgress: true }),
};

// `web-assistant-card · workout-deleted`, "With Undo": no link, because the workout is gone from the history.
export const WorkoutDeleted: Story = { args: argsOfDraft(workoutDeleted) };
