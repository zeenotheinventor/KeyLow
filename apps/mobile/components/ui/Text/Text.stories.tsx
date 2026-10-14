import { View } from "react-native";

import { Text } from "./Text";

import type { TextTone } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Text",
  component: Text,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center gap-4 p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof Text>;

export default meta;

type Story = StoryObj<typeof meta>;

export const DisplayNumeral: Story = { args: { variant: "display-numeral", children: "2,480" } };

export const H1: Story = { args: { variant: "h1", children: "Find food" } };

export const H2: Story = { args: { variant: "h2", children: "Search for a food" } };

export const Body: Story = {
  args: {
    variant: "body",
    children: "Type at least 2 characters to search your foods, UK CoFID and Open Food Facts.",
  },
};

export const BodyStrong: Story = { args: { variant: "body-strong", children: "Porridge oats" } };

export const Caption: Story = { args: { variant: "caption", children: "UK CoFID" } };

export const NumeralSmall: Story = { args: { variant: "numeral-small", children: "142 kcal" } };

const tones: TextTone[] = ["primary", "secondary", "muted"];

// Lime and the status colours are fills with text on top, so their tones are shown on their fills.
export const Tones: Story = {
  render: () => (
    <>
      {tones.map((tone) => (
        <Text key={tone} tone={tone} variant="body-strong">
          {`The ${tone} tone`}
        </Text>
      ))}
      <View className="rounded-medium bg-accent p-3">
        <Text tone="accent-foreground" variant="body-strong">
          The accent-foreground tone
        </Text>
      </View>
      <View className="rounded-medium bg-danger p-3">
        <Text tone="on-status" variant="body-strong">
          The on-status tone
        </Text>
      </View>
    </>
  ),
};

// Tabular figures give every digit the same width, so a column of numbers lines up on the right.
export const TabularFigures: Story = {
  render: () => (
    <View className="items-start gap-1">
      {["1,111", "8,888", "10,011", "2,480"].map((value) => (
        <Text key={value} variant="numeral-small">
          {value}
        </Text>
      ))}
    </View>
  ),
};
