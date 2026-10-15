import { View } from "react-native";

import { Icon } from "./Icon";

import type { IconName, IconSizeName, IconTone } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Icon",
  component: Icon,
  decorators: [
    (Story) => (
      <View className="flex-1 items-start justify-center gap-4 p-4">
        <Story />
      </View>
    ),
  ],
  args: { name: "Search" },
} satisfies Meta<typeof Icon>;

export default meta;

type Story = StoryObj<typeof meta>;

const sizes: IconSizeName[] = ["sm", "md", "lg", "xl"];
const tones: IconTone[] = ["primary", "secondary", "muted"];
const names: IconName[] = [
  "Apple",
  "BookOpen",
  "Calendar",
  "Camera",
  "CameraOff",
  "Check",
  "ChefHat",
  "ChevronLeft",
  "ChevronRight",
  "CircleAlert",
  "CircleCheck",
  "CircleDashed",
  "Clock",
  "CloudOff",
  "Ellipsis",
  "FileText",
  "Info",
  "LayoutDashboard",
  "LoaderCircle",
  "Lock",
  "LogOut",
  "Mail",
  "Pencil",
  "Plus",
  "RefreshCcw",
  "RotateCw",
  "Scale",
  "ScanBarcode",
  "Search",
  "SearchX",
  "Shield",
  "SunMoon",
  "Trash2",
  "TriangleAlert",
  "Utensils",
  "WifiOff",
  "X",
];

export const Sizes: Story = {
  render: (args) => (
    <View className="flex-row items-end gap-4">
      {sizes.map((size) => (
        <Icon key={size} {...args} size={size} />
      ))}
    </View>
  ),
};

// Lime and the status colours are fills with an icon on top, so their tones are shown on their fills.
// Accent ink is the one thin glyph in lime: it turns to the primary text colour in light. The warning
// and danger glyphs sit on their muted fills, as a banner and an error tile draw them.
export const Tones: Story = {
  render: (args) => (
    <View className="flex-row items-center gap-4">
      {tones.map((tone) => (
        <Icon key={tone} {...args} tone={tone} />
      ))}
      <View className="rounded-small bg-accent p-2">
        <Icon {...args} tone="accent-foreground" />
      </View>
      <View className="rounded-small bg-danger p-2">
        <Icon {...args} tone="on-status" />
      </View>
      <Icon {...args} tone="accent-ink" />
      <View className="rounded-small bg-warning-muted p-2">
        <Icon {...args} tone="warning" />
      </View>
      <View className="rounded-small bg-danger-muted p-2">
        <Icon {...args} tone="danger" />
      </View>
    </View>
  ),
};

export const Labelled: Story = { args: { name: "ScanBarcode", size: "lg", label: "Scan barcode" } };

export const Names: Story = {
  render: (args) => (
    <View className="flex-row flex-wrap gap-4">
      {names.map((name) => (
        <Icon key={name} {...args} name={name} />
      ))}
    </View>
  ),
};
