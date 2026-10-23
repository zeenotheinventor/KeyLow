import { View } from "react-native";

import { WeightImportStatus } from "./WeightImportStatus";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Weight/WeightImportStatus",
  component: WeightImportStatus,
  args: {
    connection: "connected",
    isImporting: false,
    lastImportedAt: null,
    now: new Date("2026-10-23T12:00:00.000Z"),
    onConnect: () => undefined,
  },
  decorators: [
    (Story) => (
      // The status sits at the right of the Weigh-ins heading's row.
      <View className="items-end p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof WeightImportStatus>;

export default meta;

type Story = StoryObj<typeof meta>;

// The chart board: the last import line.
export const LastImport: Story = { args: { lastImportedAt: "2026-10-23T11:58:00.000Z" } };

// The importing board: the line is replaced while an import runs.
export const Checking: Story = { args: { isImporting: true } };

// The not-connected board: the quiet link that opens the permission flow.
export const NotConnected: Story = { args: { connection: "not-connected" } };
