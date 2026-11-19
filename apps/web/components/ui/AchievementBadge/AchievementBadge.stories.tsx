import { ACHIEVEMENT_CATEGORIES, ACHIEVEMENTS } from "@keylow/core";
import { ACHIEVEMENT_CATEGORY_NAMES, ACHIEVEMENT_COPY } from "@keylow/core/copy";

import { AchievementBadge } from "./AchievementBadge";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/AchievementBadge",
  component: AchievementBadge,
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-end gap-5 p-6">
        <Story />
      </div>
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
      <AchievementBadge id="hat-trick" size={140} />
      <AchievementBadge id="fortnight" size={140} />
      <AchievementBadge id="month-strong" size={140} />
      <AchievementBadge id="full-circle" size={140} />
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

// Board 9: every badge as earned, by category, in the catalogue's order, 72 pixels each.
export const All130: Story = {
  render: () => (
    <div className="flex w-full flex-col gap-7">
      {ACHIEVEMENT_CATEGORIES.map((category) => (
        <section className="flex flex-col gap-3" key={category}>
          <h2 className="text-lg font-semibold text-text-primary">
            {ACHIEVEMENT_CATEGORY_NAMES[category]}
          </h2>
          <div className="flex flex-wrap gap-x-3 gap-y-4">
            {ACHIEVEMENTS.filter((achievement) => achievement.category === category).map(
              ({ id, number }) => (
                <div className="flex w-[98px] flex-col items-center gap-1.5 text-center" key={id}>
                  <AchievementBadge decorative id={id} size={72} />
                  <p className="text-[11px] leading-[14px] font-semibold text-text-secondary">
                    {number}. {ACHIEVEMENT_COPY[id].name}
                  </p>
                </div>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  ),
};
