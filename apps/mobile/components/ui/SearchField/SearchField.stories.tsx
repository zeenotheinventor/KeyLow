import { useState } from "react";
import { View } from "react-native";

import { Button } from "../Button";
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

// A screen that places the field among its content, such as the recipes tab, has no dock around it.
export const Inline: Story = {
  args: { placement: "inline", label: "Search recipes", placeholder: "Search recipes" },
  decorators: [
    (Story) => (
      <View className="px-4 pt-4">
        <Story />
      </View>
    ),
  ],
};

// The recipes tab draws the field disabled while its list loads.
export const Disabled: Story = {
  args: { ...Inline.args, disabled: true },
  decorators: Inline.decorators ?? [],
};

// The plate's Log foods button docked beside the field, which shrinks to make room. A React element is
// drawn in `render`, because Storybook walks every arg and cannot take an element there.
export const WithLogFoods: Story = {
  args: { value: "chicken" },
  render: (args) => (
    <TypingSearchField
      {...args}
      dockAction={<Button accessibilityLabel="Log foods, 4 foods on your plate">Log foods</Button>}
    />
  ),
};

// While the plate is being logged the button shows its spinner in place of its label.
export const WithLogFoodsLogging: Story = {
  args: { value: "chicken" },
  render: (args) => (
    <TypingSearchField
      {...args}
      dockAction={
        <Button loading accessibilityLabel="Log foods, 4 foods on your plate">
          Log foods
        </Button>
      }
    />
  ),
};
