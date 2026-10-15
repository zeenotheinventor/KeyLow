import { View } from "react-native";

import { BottomSheet } from "../BottomSheet";
import { ActionMenu } from "./ActionMenu";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ActionMenu",
  component: ActionMenu,
  decorators: [
    // The menu sits in a bottom sheet, which gives it 16 points at its sides.
    (Story) => (
      <View className="flex-1 justify-center px-4">
        <Story />
      </View>
    ),
  ],
  args: { items: [] },
} satisfies Meta<typeof ActionMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

// An enabled item beside a disabled one: the disabled item's icon and label are dimmed and its caption is not.
export const EnabledAndDisabled: Story = {
  args: {
    items: [
      { label: "Copy yesterday", icon: "Copy", onPress: () => undefined },
      {
        label: "Quick add",
        icon: "Plus",
        caption: "Needs a connection",
        disabled: true,
        onPress: () => undefined,
      },
    ],
  },
};

// The diary's menu: the one item, Copy yesterday.
export const CopyYesterday: Story = {
  args: { items: [{ label: "Copy yesterday", icon: "Copy", onPress: () => undefined }] },
};

// The nothing-to-copy board: the item disabled, with its reason under it.
export const NothingToCopy: Story = {
  args: {
    items: [
      {
        label: "Copy yesterday",
        icon: "Copy",
        caption: "Nothing logged yesterday",
        disabled: true,
        onPress: () => undefined,
      },
    ],
  },
};

export const WithTitle: Story = {
  args: {
    title: "More",
    items: [
      { label: "Copy yesterday", icon: "Copy", onPress: () => undefined },
      { label: "Edit targets", icon: "Target", onPress: () => undefined },
    ],
  },
};

// An action that removes something takes the danger colour.
export const Destructive: Story = {
  args: {
    items: [
      { label: "Copy yesterday", icon: "Copy", onPress: () => undefined },
      { label: "Delete entry", icon: "Trash2", destructive: true, onPress: () => undefined },
    ],
  },
};

// The menu as the diary shows it, in a bottom sheet.
export const InSheet: Story = {
  render: () => (
    <BottomSheet open onClose={() => undefined}>
      <ActionMenu items={[{ label: "Copy yesterday", icon: "Copy", onPress: () => undefined }]} />
    </BottomSheet>
  ),
};
