import { useState } from "react";
import { View } from "react-native";

import { IconButton } from "../IconButton";
import { SearchField } from "./SearchField";

import type { SearchFieldProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

// A field keeps what is typed in the screen that holds it, so a story does the same.
function TypingSearchField(props: SearchFieldProps) {
  const [value, setValue] = useState(props.value);
  const clearField = () => {
    setValue("");
  };

  return (
    <SearchField
      {...props}
      trailing={<IconButton icon="ScanBarcode" label="Scan barcode" size="sm" variant="ghost" />}
      clear={props.clear === undefined ? undefined : { ...props.clear, onPress: clearField }}
      value={value}
      onChangeText={setValue}
    />
  );
}

const meta = {
  title: "UI/SearchField",
  component: SearchField,
  decorators: [
    (Story) => (
      // The field is docked at the bottom of the screen, so the story fills it and pushes the field down.
      <View className="flex-1 justify-end">
        <Story />
      </View>
    ),
  ],
  render: (args) => <TypingSearchField {...args} />,
  args: {
    label: "Search foods",
    placeholder: "Search for a food",
    value: "",
    onChangeText: () => undefined,
  },
} satisfies Meta<typeof SearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const Filled: Story = { args: { value: "chicken breast" } };

// The boards draw no clear control, so a screen only has one if it passes it.
export const WithClear: Story = {
  args: { value: "chicken breast", clear: { label: "Clear search", onPress: () => undefined } },
};

// Opens the keyboard, to show the field docked above it with the accent border of a focused field.
export const Focused: Story = { args: { autoFocus: true } };
