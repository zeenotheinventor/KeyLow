import { summariseCelebrations } from "@keylow/core";
import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

import { AchievementMoment } from "./AchievementMoment";

import type { CelebrationSummary } from "@keylow/core";
import type { Meta, StoryObj } from "@storybook/react-native";
import type { ReactNode } from "react";

function momentFor(...args: Parameters<typeof summariseCelebrations>): CelebrationSummary {
  const summary = summariseCelebrations(...args);
  if (summary === null) {
    throw new Error("The story needs a drain with something in it.");
  }
  return summary;
}

const meta = {
  title: "Achievements/AchievementMoment",
  component: AchievementMoment,
  args: { onDismiss: () => undefined, onSeeAll: () => undefined },
} satisfies Meta<typeof AchievementMoment>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 3: the Gold moment, Month Strong, with the points and a freeze.
export const Gold: Story = {
  args: {
    summary: momentFor({
      entries: [{ id: "month-strong", isNew: true }],
      extras: { freezes: 1, levelName: null },
    }),
  },
};

// Platinum uses the accent ring.
export const Platinum: Story = {
  args: {
    summary: momentFor({
      entries: [{ id: "full-circle", isNew: true }],
      extras: null,
    }),
  },
};

// Other badges in the same drain are named in one line under the moment.
export const WithOtherBadges: Story = {
  args: {
    summary: momentFor({
      entries: [
        { id: "month-strong", isNew: true },
        { id: "notebook", isNew: false },
        { id: "bullseye", isNew: false },
      ],
      extras: null,
    }),
  },
};

// A story cannot reach the device's setting, so this answers Reduce Motion as on while it is drawn. It is set
// while rendering, before the moment's own effects read it, and put back when the story goes.
function ReduceMotionOn({ children }: { children: ReactNode }) {
  const [original] = useState(() => {
    const read = AccessibilityInfo.isReduceMotionEnabled;
    AccessibilityInfo.isReduceMotionEnabled = () => Promise.resolve(true);
    return read;
  });
  useEffect(
    () => () => {
      AccessibilityInfo.isReduceMotionEnabled = original;
    },
    [original],
  );
  return children;
}

// With Reduce Motion on the ring and the sparks are drawn in place and nothing moves. The words stay.
export const GoldReduceMotion: Story = {
  ...Gold,
  decorators: [
    (Story) => (
      <ReduceMotionOn>
        <Story />
      </ReduceMotionOn>
    ),
  ],
};
