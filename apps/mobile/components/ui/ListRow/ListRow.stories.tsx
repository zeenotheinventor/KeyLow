import { useState } from "react";
import { View } from "react-native";

import { Card } from "../Card";
import { SegmentedControl } from "../SegmentedControl";
import { ListRow } from "./ListRow";

import type {
  ListRowToPressProps,
  ListRowWithControlProps,
  ListRowWithToggleProps,
  ListRowWithTrailingProps,
} from "./types";
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

// A row whose press is under way (KEY-505): busy, with a spinner in place of the chevron.
export const Loading: Story = {
  args: { subtitle: "Foods you created or copied", onPress: () => undefined, loading: true },
};

// The assistant's starter: no icon tile, and an arrow up where the chevron goes, for "send this".
export const WithTrailingIcon: Story = {
  args: {
    icon: undefined,
    title: "What's left for today?",
    trailingIcon: "ArrowUp",
    onPress: () => undefined,
  },
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

// The Weight screen's weigh-in row that the trend left out: a warning badge before the value, and no chevron
// because the row goes nowhere.
export const WithBadge: Story = {
  args: {
    icon: "Pencil",
    title: "Sat 10 Oct",
    subtitle: "08:00 · Added by you",
    badge: { label: "Left out of trend", tone: "warning" },
    value: "99.0",
    unit: "kg",
  },
};

// The weigh-in list's row as the Weight board draws it: 52 points, a 32 point tile, a label-small title over a
// muted caption, and the weight and unit as one semibold figure.
export const Compact: Story = {
  args: {
    size: "compact",
    icon: "Heart",
    title: "Today",
    subtitle: "07:42 · Health Connect",
    value: "81.6",
    unit: "kg",
  },
};

// The same row for a weigh-in the trend left out: the badge before the value, and the value muted.
export const CompactLeftOut: Story = {
  args: {
    size: "compact",
    icon: "Pencil",
    title: "Sat 10 Oct",
    subtitle: "08:00 · Added by you",
    badge: { label: "Left out of trend", tone: "warning" },
    value: "99.0",
    unit: "kg",
    valueTone: "muted",
  },
};

// The Targets screen's value row while a programme runs: the macro's colour as a key before the title, a value
// and unit, and no chevron because the row goes nowhere.
export const WithMacroKey: Story = {
  args: { macro: "protein", title: "Protein", value: "126", unit: "g", icon: undefined },
};

// The Targets screen's Calories row: the calories colour as the key, the same one the diary's progress strip uses.
export const WithCaloriesKey: Story = {
  args: { macro: "calories", title: "Calories", value: "2,140", unit: "kcal", icon: undefined },
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

// A row that is not available yet: dimmed, and it does nothing.
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

// The Assistant settings screen's Delete all conversations row: the title in the danger colour and no chevron.
export const DangerTitle: Story = {
  args: {
    icon: undefined,
    title: "Delete all conversations",
    titleTone: "danger",
    chevron: false,
    onPress: () => undefined,
  },
};

// A switch at the end, kept by the screen, so the story keeps it too and a press moves it.
function UseTheAssistant({ title }: { title: string }) {
  const [isOn, setIsOn] = useState(false);

  return <ListRow title={title} toggle={{ isOn, label: title, onValueChange: setIsOn }} />;
}

// The Assistant settings screen's "Use the assistant" row: a title and the kit's switch, and no icon or chevron.
// Its props are the row with a toggle, which takes no press, so it has a story type of its own.
export const WithToggle: StoryObj<Meta<ListRowWithToggleProps>> = {
  args: { title: "Use the assistant" },
  render: (args) => <UseTheAssistant title={args.title} />,
};

// The changes list's row with Undo: a title and a sub line, and the text button in the accent ink at the end.
// Its props are the row with a trailing action, which takes no press, so it has a story type of its own.
export const TrailingAction: StoryObj<Meta<ListRowWithTrailingProps>> = {
  args: {
    title: "Logged 2 eggs and toast at 08:10",
    subtitle: "08:11 · 2 entries",
    trailing: { kind: "action", label: "Undo", onPress: () => undefined },
  },
};

// The same row once it was undone: the title muted and the plain word Undone at the end.
export const TrailingLabel: StoryObj<Meta<ListRowWithTrailingProps>> = {
  args: {
    title: "Copied 8 entries from yesterday",
    subtitle: "12:30",
    titleTone: "secondary",
    trailing: { kind: "label", label: "Undone" },
  },
};

// The Export my data screen's file row: a file icon, the file's name and its size, and the success tick named
// "Ready" at the end. Once the file is saved the same row says "Saved". Its props are the row with a trailing
// tick, which takes no press, so it has a story type of its own.
export const TrailingTick: StoryObj<Meta<ListRowWithTrailingProps>> = {
  args: {
    icon: "FileJson",
    title: "ki-lo-export-2026-11-04.json",
    subtitle: "1.8 MB · Ready to save",
    trailing: { kind: "tick", label: "Ready" },
  },
};

// The palate's usual food: a long name that wraps, its days and typical amount, and a Not true button named
// for the item. A snug row is 56 points high where the changes list's row is 60.
export const PalateItem: StoryObj<Meta<ListRowWithTrailingProps>> = {
  args: {
    title: "Apples, eating, raw, flesh and skin",
    subtitle: "28 days · usually 100 g",
    density: "snug",
    trailing: {
      kind: "action",
      label: "Not true",
      accessibleName: "Not true: Apples, eating, raw, flesh and skin",
      onPress: () => undefined,
    },
  },
};

// The palate's "Show all 10": the title in the accent ink and a chevron down.
export const AccentTitle: StoryObj<Meta<ListRowToPressProps>> = {
  args: {
    icon: undefined,
    title: "Show all 10",
    titleTone: "accent",
    chevron: false,
    trailingIcon: "ChevronDown",
    onPress: () => undefined,
  },
};

// The palate's link to Foods to avoid: a row that goes to another screen, so it is a link.
export const LinkRow: StoryObj<Meta<ListRowToPressProps>> = {
  args: {
    icon: undefined,
    title: "Foods to avoid",
    titleTone: "accent",
    subtitle: "None yet",
    role: "link",
    onPress: () => undefined,
  },
};
