import { useState } from "react";
import { View } from "react-native";

import { Card } from "../Card";
import { SegmentedControl } from "../SegmentedControl";
import { ListRow } from "./ListRow";

import type { ListRowToPressProps, ListRowWithControlProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ListRow",
  component: ListRow,
  decorators: [
    (Story) => (
      // The rows bring their own padding, so the card has none.
      <View className="flex-1 justify-center p-4">
        <Card padding={0}>
          <Story />
        </Card>
      </View>
    ),
  ],
  args: { icon: "Utensils", title: "Your foods" },
} satisfies Meta<ListRowToPressProps>;

export default meta;

type Story = StoryObj<typeof meta>;

// The More screen's Your foods row: an icon, a title, a subtitle and a chevron.
export const Default: Story = {
  args: { subtitle: "Foods you created or copied", onPress: () => undefined },
};

// A row with a trailing value and unit that goes nowhere, so it has no chevron.
export const WithValue: Story = {
  args: {
    icon: "Search",
    title: "Expenditure",
    subtitle: "Estimate",
    value: "2,480",
    unit: "kcal",
  },
};

// The recipe library's Archived recipes row: a count in secondary text, and a chevron.
export const WithQuietValue: Story = {
  args: {
    icon: "Archive",
    title: "Archived recipes",
    value: "2",
    valueLook: "quiet",
    onPress: () => undefined,
  },
};

// The More screen's Sign out row: a title and nothing else, and it acts so it has no chevron.
export const TitleOnly: Story = {
  args: { icon: "X", title: "Sign out", chevron: false, onPress: () => undefined },
};

// The More screen's Weight row: it is not there yet, so it is dimmed and does nothing.
export const Disabled: Story = {
  args: { icon: "ScanBarcode", title: "Weight", subtitle: "Coming soon", disabled: true },
};

// The recipe editor's Add ingredient row, which closes a card of rows: the icon bare, no chevron.
export const Footer: Story = {
  args: { icon: "Plus", title: "Add ingredient", variant: "footer", onPress: () => undefined },
};

type Appearance = "dark" | "light" | "system";

// A choice is kept by the screen that holds it, so the story keeps it too and a press moves it.
function AppearanceChoice() {
  const [value, setValue] = useState<Appearance>("dark");

  return (
    <SegmentedControl
      label="Appearance"
      options={[
        { value: "dark", label: "Dark" },
        { value: "light", label: "Light" },
        { value: "system", label: "Match device" },
      ]}
      value={value}
      onChange={setValue}
    />
  );
}

// The More screen's Appearance setting: a row that goes nowhere, with its control under the title. The card
// is 116 points tall, with 12 points of padding around the 44 point control.
// Its props are the row with a control, which takes no press, so it has a story type of its own.
// The control is drawn by `render`, because Storybook walks every arg to infer its type, and a React element in the args fails the whole story index on a device.
export const WithControl: StoryObj<Meta<ListRowWithControlProps>> = {
  args: { icon: "SunMoon", title: "Appearance", children: null },
  render: (args) => (
    <ListRow {...args}>
      <AppearanceChoice />
    </ListRow>
  ),
};
