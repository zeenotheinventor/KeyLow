import { View } from "react-native";

import { ListRow } from "../ListRow";
import { Text } from "../Text";
import { Card } from "./Card";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Card",
  component: Card,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  args: { children: null },
} satisfies Meta<typeof Card>;

export default meta;

type Story = StoryObj<typeof meta>;

function Contents() {
  return (
    <View className="gap-1">
      <Text variant="body-strong">Appearance</Text>
      <Text tone="secondary">Dark, light, or match the device.</Text>
    </View>
  );
}

// The default: a card on the screen's background, with 16 points of padding.
export const Surface: Story = {
  render: (args) => (
    <Card {...args}>
      <Contents />
    </Card>
  ),
};

// A card that sits on a surface takes the raised level, so the stack of surfaces stays legible.
export const Raised: Story = {
  render: (args) => (
    <Card {...args}>
      <Card level="raised">
        <Contents />
      </Card>
    </Card>
  ),
};

// The Appearance card of the More board has 12 points of padding.
export const Compact: Story = {
  args: { padding: 3 },
  render: (args) => (
    <Card {...args}>
      <Contents />
    </Card>
  ),
};

// A card of rows, as the More board's Food card draws it: the rows bring their own padding.
export const Rows: Story = {
  args: { padding: 0 },
  render: (args) => (
    <Card {...args}>
      <ListRow
        icon="Utensils"
        subtitle="Foods you created or copied"
        title="Your foods"
        onPress={() => undefined}
      />
    </Card>
  ),
};
