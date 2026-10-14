import { View } from "react-native";

import { ListRow } from "./ListRow";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ListRow",
  component: ListRow,
  decorators: [
    (Story) => (
      // The design system's Card, which the mobile kit does not have yet: the surface a row sits on.
      <View className="flex-1 justify-center p-4">
        <View className="overflow-hidden rounded-large border border-border bg-surface elevation-card">
          <Story />
        </View>
      </View>
    ),
  ],
  args: { icon: "Utensils", title: "Your foods" },
} satisfies Meta<typeof ListRow>;

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

// The More screen's Sign out row: a title and nothing else, and it acts so it has no chevron.
export const TitleOnly: Story = {
  args: { icon: "X", title: "Sign out", chevron: false, onPress: () => undefined },
};

// The More screen's Weight row: it is not there yet, so it is dimmed and does nothing.
export const Disabled: Story = {
  args: { icon: "ScanBarcode", title: "Weight", subtitle: "Coming soon", disabled: true },
};
