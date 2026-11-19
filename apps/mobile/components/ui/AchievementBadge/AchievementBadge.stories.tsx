import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS } from "@keylow/core";
import { ACHIEVEMENT_CATEGORY_NAMES, ACHIEVEMENT_COPY } from "@keylow/core/copy";
import { ScrollView, View } from "react-native";

import { Text } from "../Text";
import { AchievementBadge } from "./AchievementBadge";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/AchievementBadge",
  component: AchievementBadge,
  decorators: [
    (Story) => (
      <ScrollView contentContainerClassName="flex-row flex-wrap items-end gap-4 p-4">
        <Story />
      </ScrollView>
    ),
  ],
  args: { id: "month-strong", size: 96 },
} satisfies Meta<typeof AchievementBadge>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 8's first row: one series, four tiers. The flame stays and the frame climbs.
export const TierLadder: Story = {
  render: () => (
    <>
      <AchievementBadge id="hat-trick" size={72} />
      <AchievementBadge id="fortnight" size={72} />
      <AchievementBadge id="month-strong" size={72} />
      <AchievementBadge id="full-circle" size={72} />
    </>
  ),
};

// A series carries its threshold on a ribbon, and a one-off has a motif of its own and no ribbon.
export const SeriesAndOneOffs: Story = {
  render: () => (
    <>
      <AchievementBadge id="hat-trick" size={96} />
      <AchievementBadge id="full-week" size={96} />
      <AchievementBadge id="jotter" size={96} />
      <AchievementBadge id="bullseye" size={96} />
      <AchievementBadge id="back-on-track" size={96} />
      <AchievementBadge id="perfect-week" size={96} />
      <AchievementBadge id="early-bird" size={96} />
      <AchievementBadge id="leap-of-faith" size={96} />
    </>
  ),
};

// Locked keeps the frame, motif and ribbon in grey, so the person can see what is coming.
export const Locked: Story = { args: { state: "locked", progress: "12 of 30 days" } };

// Hidden is a grey plain ring with three question marks, whatever the badge's tier.
export const Hidden: Story = { args: { id: "full-circle", state: "hidden" } };

// Board 8's last row: earned, locked and hidden side by side.
export const States: Story = {
  render: () => (
    <>
      <AchievementBadge id="month-strong" size={96} />
      <AchievementBadge id="month-strong" progress="12 of 30 days" size={96} state="locked" />
      <AchievementBadge id="month-strong" size={96} state="hidden" />
    </>
  ),
};

// The toast, the grid, the sheet and the big moment.
export const Sizes: Story = {
  render: () => (
    <>
      <AchievementBadge id="month-strong" size={44} />
      <AchievementBadge id="month-strong" size={56} />
      <AchievementBadge id="month-strong" size={96} />
      <AchievementBadge id="month-strong" size={148} />
    </>
  ),
};

// Board 9: every badge as earned, by category, in the catalogue's order, 72 points each.
export const All130: Story = {
  render: () => (
    <View className="w-full gap-6">
      {ACHIEVEMENT_CATEGORIES.map((category) => (
        <View className="gap-3" key={category}>
          <Text role="heading" variant="body-strong">
            {ACHIEVEMENT_CATEGORY_NAMES[category]}
          </Text>
          <View className="flex-row flex-wrap gap-x-3 gap-y-4">
            {ACHIEVEMENTS.filter((achievement) => achievement.category === category).map(
              ({ id, number }) => (
                <View className="w-[72px] items-center gap-1" key={id}>
                  <AchievementBadge decorative id={id} size={72} />
                  <Text className="text-center" tone="secondary" variant="caption">
                    {number}. {ACHIEVEMENT_COPY[id].name}
                  </Text>
                </View>
              ),
            )}
          </View>
        </View>
      ))}
    </View>
  ),
};
