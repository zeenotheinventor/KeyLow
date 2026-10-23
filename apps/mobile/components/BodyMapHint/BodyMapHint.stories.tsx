import { View } from "react-native";

import { BodyMapHint } from "./BodyMapHint";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "BodyMap/BodyMapHint",
  component: BodyMapHint,
  // The strip lays itself over whatever it is placed in, as it does over the figures.
  decorators: [
    (Story) => (
      <View className="h-[308px] p-4">
        <Story />
      </View>
    ),
  ],
  args: { onDismiss: () => undefined },
} satisfies Meta<typeof BodyMapHint>;

export default meta;

type Story = StoryObj<typeof meta>;

// The line the body map draws once, on its first open, as the `body · actual-heat` board draws it.
export const FirstOpen: Story = {};
