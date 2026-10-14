import { View } from "react-native";

import { Badge } from "./Badge";

import type { BadgeTone } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Badge",
  decorators: [
    (Story) => (
      <View className="flex-1 items-start justify-center gap-4 p-4">
        <Story />
      </View>
    ),
  ],
  // The props are a union of the source and the status badge, which a story's args cannot spread, so
  // the meta names no component and each story draws its own badge.
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

const tones: BadgeTone[] = [
  "neutral",
  "accent",
  "success",
  "warning",
  "danger",
  "protein",
  "carbs",
  "fat",
  "calories",
];

// The food detail's title block names where the food came from, one badge for each source.
export const SourceOpenFoodFacts: Story = { render: () => <Badge kind="source" source="off" /> };

export const SourceCoFid: Story = { render: () => <Badge kind="source" source="cofid" /> };

export const SourceYours: Story = { render: () => <Badge kind="source" source="user" /> };

// The food detail's portion rows mark the default portion with a neutral status.
export const Neutral: Story = { render: () => <Badge>Default</Badge> };

// Every tone of the design system card. In light the words stay in the primary text colour and the
// tone is the fill, and the dot where there is one (Q14).
export const Tones: Story = {
  render: () => (
    <>
      {tones.map((tone) => (
        <Badge key={tone} dot tone={tone}>
          {tone}
        </Badge>
      ))}
    </>
  ),
};

// The design system card's example of a status with a dot.
export const WithDot: Story = {
  render: () => (
    <Badge dot tone="warning">
      Needs review
    </Badge>
  ),
};
