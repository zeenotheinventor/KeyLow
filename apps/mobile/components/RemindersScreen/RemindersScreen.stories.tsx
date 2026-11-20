import { useEffect, useState } from "react";

import { RemindersScreen } from "./RemindersScreen";
import { defaultReminderSettings, writeReminderSettings } from "../../lib/reminderSettings";

import type { ReminderSettings } from "../../lib/reminderSettings";
import type { Meta, StoryObj } from "@storybook/react-native";

// The screen reads the settings kept on the device, so each story saves the ones it shows and draws the
// screen once they are saved.
function SavedSettings({ saved }: { saved: Partial<ReminderSettings> }) {
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    void writeReminderSettings({ ...defaultReminderSettings, ...saved }).then(() => {
      setIsSaved(true);
    });
  }, [saved]);

  return isSaved ? <RemindersScreen /> : null;
}

const defaults = {};
const bothOn = { badgesEnabled: true, streakNudgeEnabled: true };
const bothOff = { badgesEnabled: false, streakNudgeEnabled: false };

const meta = {
  title: "More/RemindersScreen",
  component: RemindersScreen,
} satisfies Meta<typeof RemindersScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

// Board 6: Badges and levels on, Keep your streak off, which is how a person finds the screen.
export const AchievementsDefaults: Story = { render: () => <SavedSettings saved={defaults} /> };

export const AchievementsBothOn: Story = { render: () => <SavedSettings saved={bothOn} /> };

export const AchievementsBothOff: Story = { render: () => <SavedSettings saved={bothOff} /> };
