import { groupEntriesByHour } from "@keylow/core/diary";
import { formatCalories } from "@keylow/core/format";
import { describeMacros } from "@keylow/core/search";
import { ScrollView, View } from "react-native";

import { FoodRow } from "../FoodRow";
import { HourRow } from "./HourRow";

import type { TimelineEntry } from "@keylow/core/diary";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/HourRow",
  component: HourRow,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center px-4">
        <Story />
      </View>
    ),
  ],
  args: { hour: 8, label: "08:00", onAdd: () => undefined },
} satisfies Meta<typeof HourRow>;

export default meta;

type Story = StoryObj<typeof meta>;

type LoggedFood = TimelineEntry & {
  name: string;
  caption: string;
  kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
};

// The boards' sample day, Thursday 15 October 2026 in London (British Summer Time, one hour ahead of UTC).
// The rows are what @keylow/core writes for them: the amount and time caption, the macros and the sentence.
function food(
  id: string,
  clockTime: string,
  name: string,
  amount: string,
  kcal: number,
  protein_g: number,
  fat_g: number,
  carbs_g: number,
): LoggedFood {
  const loggedAt = `2026-10-15T${String(Number(clockTime.slice(0, 2)) - 1).padStart(2, "0")}${clockTime.slice(2)}:00Z`;
  return {
    id,
    logged_at: loggedAt,
    created_at: loggedAt,
    name,
    caption: `${clockTime} · ${amount}`,
    kcal,
    protein_g,
    fat_g,
    carbs_g,
  };
}

const sampleDay = [
  food("1", "08:05", "Porridge oats", "50 g", 187, 5.6, 4.2, 30.2),
  food("2", "08:05", "Semi-skimmed milk", "200 ml", 92, 7, 3.4, 9.6),
  food("3", "08:10", "Banana", "1 medium (100 g)", 95, 1.2, 0.1, 20.3),
  food("4", "12:40", "Chicken breast, grilled", "150 g", 222, 48, 3.3, 0),
  food("5", "12:40", "Basmati rice, boiled", "180 g", 216, 4.9, 0.7, 47.5),
  food("6", "12:45", "Meal deal crisps", "Quick add", 130, 2, 7, 15),
  food("7", "15:20", "Greek yoghurt 0% fat", "1 pot (170 g)", 97, 17.3, 0.3, 6.5),
];

const hours = groupEntriesByHour(sampleDay, "Europe/London");

function foodRows(entries: readonly LoggedFood[]) {
  return entries.map((entry) => {
    const { protein, carbs, fat, accessibleDescription } = describeMacros(entry);
    return (
      <FoodRow
        key={entry.id}
        caption={entry.caption}
        energy={formatCalories(entry.kcal)}
        layout="diary"
        macros={{
          protein: protein ?? "",
          carbs: carbs ?? "",
          fat: fat ?? "",
          description: accessibleDescription,
        }}
        nameSegments={[{ text: entry.name, matched: false }]}
        onPress={() => undefined}
      />
    );
  });
}

// An hour with nothing logged is the chip and the plus.
export const EmptyHour: Story = {};

// One food under the chip, in a card 8 points in from the guide line.
export const OneFood: Story = {
  args: { hour: 15, label: "15:00" },
  render: (args) => <HourRow {...args}>{foodRows(hours[15]?.entries ?? [])}</HourRow>,
};

// Foods in one hour stack in the one card, with a hairline between them.
export const ThreeFoods: Story = {
  render: (args) => <HourRow {...args}>{foodRows(hours[8]?.entries ?? [])}</HourRow>,
};

// The current hour: the chip carries an accent dot and is named "11:00, now".
export const CurrentHour: Story = { args: { hour: 11, label: "11:00", isNow: true } };

// Offline: the plus is dimmed to 40 percent and does nothing, and the foods stay readable.
export const AddDisabled: Story = {
  args: { hour: 12, label: "12:00", addDisabled: true },
  render: (args) => <HourRow {...args}>{foodRows(hours[12]?.entries ?? [])}</HourRow>,
};

// The food log's 24 rows in a list, with the guide line running through them and the current hour at 11:00.
export const TwentyFourHours: Story = {
  decorators: [
    (Story) => (
      <View className="flex-1">
        <Story />
      </View>
    ),
  ],
  render: (args) => (
    <ScrollView>
      <View className="py-2" role="list">
        {hours.map((group) => (
          <HourRow
            key={group.hour}
            {...args}
            hour={group.hour}
            isNow={group.hour === 11}
            label={group.label}
          >
            {foodRows(group.entries)}
          </HourRow>
        ))}
      </View>
    </ScrollView>
  ),
};
