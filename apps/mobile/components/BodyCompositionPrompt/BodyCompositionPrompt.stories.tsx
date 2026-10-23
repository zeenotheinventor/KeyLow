import { HEALTH_ACCESS } from "@keylow/core/copy";
import { View } from "react-native";

import { BodyCompositionPrompt } from "./BodyCompositionPrompt";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Weight/BodyCompositionPrompt",
  component: BodyCompositionPrompt,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { onAction: () => undefined },
} satisfies Meta<typeof BodyCompositionPrompt>;

export default meta;

type Story = StoryObj<typeof meta>;

// The stacked compact layout of `connected · partial`, one story for each kind that was not allowed.
export const Neither: Story = { args: HEALTH_ACCESS.connectedPartial.neither };

export const LeanMassMissing: Story = { args: HEALTH_ACCESS.connectedPartial.leanMassMissing };

export const BodyFatMissing: Story = { args: HEALTH_ACCESS.connectedPartial.bodyFatMissing };
