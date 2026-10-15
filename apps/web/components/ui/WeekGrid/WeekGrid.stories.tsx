import { WeekGrid } from "./WeekGrid";

import type { WeekGridDay } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

// The week on the web diary canvas: Monday 12 to Sunday 18 October 2026, target 2,200 kcal. Monday and
// Tuesday are complete, Tuesday is over the target, and today is Thursday the 15th.
const day = (
  localDate: string,
  totals: [kcal: number, protein: number, carbs: number, fat: number] | null,
  isComplete = false,
): WeekGridDay => ({
  localDate,
  totals:
    totals === null
      ? null
      : { kcal: totals[0], protein_g: totals[1], carbs_g: totals[2], fat_g: totals[3] },
  isComplete,
});

const monday = day("2026-10-12", [2140, 158, 214, 66], true);
const tuesday = day("2026-10-13", [2260, 149, 231, 74], true);
const wednesday = day("2026-10-14", [1286, 111, 129, 35]);
const thursday = day("2026-10-15", [1039, 86, 129, 19]);
const toCome = [day("2026-10-16", null), day("2026-10-17", null), day("2026-10-18", null)];

const meta = {
  title: "UI/WeekGrid",
  component: WeekGrid,
  args: {
    label: "Week of Mon 12 Oct",
    days: [monday, tuesday, wednesday, thursday, ...toCome],
    today: "2026-10-15",
    calorieTarget: 2200,
    dayHref: (localDate: string) => `/diary?date=${localDate}`,
    onCopyToToday: () => undefined,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-[1132px] p-4 xl:p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof WeekGrid>;

export default meta;

type Story = StoryObj<typeof meta>;

// Mid week: Monday and Tuesday complete, Wednesday and today incomplete, three days still to come.
export const FullWeek: Story = {};

// Tuesday is over the target in every story. Here today is too, as on the week-copied board: the bar is full
// with a brighter outline of its own colour, never a warning colour.
export const OverTargetDay: Story = {
  args: { days: [monday, tuesday, wednesday, day("2026-10-15", [2325, 197, 258, 54]), ...toCome] },
};

// Early in the week most days are still to come: they are dimmed and say No entries yet.
export const WeekWithFutureDays: Story = {
  args: {
    days: [
      day("2026-10-12", [1850, 120, 200, 60]),
      day("2026-10-13", [412, 30, 40, 12]),
      ...[14, 15, 16, 17, 18].map((date) => day(`2026-10-${date}`, null)),
    ],
    today: "2026-10-13",
  },
};

// No target set: the calories stand alone and there is no bar.
export const NoTarget: Story = { args: { calorieTarget: null } };

// A past day with nothing logged says so, and has no Copy to today.
export const PastDayWithoutEntries: Story = {
  args: { days: [monday, tuesday, day("2026-10-14", null), thursday, ...toCome] },
};

// Offline, every Copy to today is dimmed and stops responding. The date links stay.
export const CopyDisabled: Story = { args: { copyDisabled: true } };

// The phone layout: one card of eight rows.
export const OnPhone: Story = {
  globals: { viewport: { value: "mobile", isRotated: false } },
};

// The wide layout: eight columns of cards.
export const OnDesktop: Story = {
  globals: { viewport: { value: "desktop", isRotated: false } },
};
