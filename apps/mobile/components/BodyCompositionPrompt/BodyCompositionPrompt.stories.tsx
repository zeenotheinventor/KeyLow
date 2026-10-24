import { BODY_COMPOSITION, HEALTH_ACCESS } from "@keylow/core/copy";
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
} satisfies Meta<typeof BodyCompositionPrompt>;

export default meta;

type Story = StoryObj<typeof BodyCompositionPrompt>;

const doNothing = () => undefined;

// The stacked compact layout of `connected · partial`, one story for each kind that was not allowed.
export const Neither: Story = {
  args: { ...HEALTH_ACCESS.connectedPartial.neither, onAction: doNothing },
};

export const LeanMassMissing: Story = {
  args: { ...HEALTH_ACCESS.connectedPartial.leanMassMissing, onAction: doNothing },
};

export const BodyFatMissing: Story = {
  args: { ...HEALTH_ACCESS.connectedPartial.bodyFatMissing, onAction: doNothing },
};

// The Weight screen's prompts, as `body-composition: components` draws them.
export const NotAllowed: Story = {
  args: { variant: "not-allowed", ...BODY_COMPOSITION.notAllowed, onAction: doNothing },
};

export const NoReadingsYet: Story = {
  args: { variant: "no-readings-yet", ...BODY_COMPOSITION.noReadings },
};

// The one row of `partial`, for the kind that cannot be read yet.
export const PartialLeanMass: Story = {
  args: { variant: "compact", ...BODY_COMPOSITION.partial.lean_mass_kg, onAction: doNothing },
};

export const PartialBodyFat: Story = {
  args: { variant: "compact", ...BODY_COMPOSITION.partial.body_fat_pct, onAction: doNothing },
};

export const LoadError: Story = {
  args: {
    variant: "error",
    title: BODY_COMPOSITION.error.title,
    text: BODY_COMPOSITION.error.body,
    retry: BODY_COMPOSITION.error.retry,
    onRetry: doNothing,
  },
};
