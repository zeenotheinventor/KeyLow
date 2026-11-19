import { webBadgeDetail } from "@keylow/core/copy";

import { BadgeDetailDialog } from "./BadgeDetailDialog";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "Achievements/BadgeDetailDialog",
  component: BadgeDetailDialog,
  args: { onClose: () => undefined },
} satisfies Meta<typeof BadgeDetailDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 2's three states: earned with its date and points, locked with its progress, and hidden.
export const Earned: Story = {
  args: {
    id: "fortnight",
    detail: webBadgeDetail({
      id: "fortnight",
      result: { id: "fortnight", earned: true },
      unlockedAt: "2026-11-06T12:00:00.000Z",
    }),
  },
};

export const Locked: Story = {
  args: {
    id: "month-strong",
    detail: webBadgeDetail({
      id: "month-strong",
      result: { id: "month-strong", earned: false, progress: { current: 12, target: 30 } },
      unlockedAt: undefined,
    }),
  },
};

export const LockedPlatinum: Story = {
  args: {
    id: "full-circle",
    detail: webBadgeDetail({
      id: "full-circle",
      result: { id: "full-circle", earned: false, progress: { current: 12, target: 365 } },
      unlockedAt: undefined,
    }),
  },
};

export const OneOff: Story = {
  args: {
    id: "first-bite",
    detail: webBadgeDetail({
      id: "first-bite",
      result: { id: "first-bite", earned: false, progress: { current: 0, target: 1 } },
      unlockedAt: undefined,
    }),
  },
};

export const Hidden: Story = {
  args: {
    id: "leap-of-faith",
    detail: webBadgeDetail({
      id: "leap-of-faith",
      result: { id: "leap-of-faith", earned: false, progress: { current: 0, target: 1 } },
      unlockedAt: undefined,
    }),
  },
};
