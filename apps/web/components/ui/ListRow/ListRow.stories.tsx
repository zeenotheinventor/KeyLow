import { FileJson, FileText, Heart, Pencil, Shield } from "lucide-react";
import { useState } from "react";
import { userEvent } from "storybook/test";

import { ListRow } from "./ListRow";

import type { Meta, StoryObj } from "@storybook/nextjs";

// A row lives in a list on a card, so every story draws it on one. The props are a union (a link, a
// button or plain text), which Storybook's args typing cannot hold, so each story renders its own row.
const meta = {
  title: "UI/ListRow",
  decorators: [
    (Story) => (
      <div className="max-w-xl p-6">
        <ul className="overflow-hidden rounded-large border border-border bg-surface shadow-card">
          <Story />
        </ul>
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ListRow title="Your foods" subtitle="Foods you created or copied" href="/foods" />,
};

// A value sits before the chevron, as the Targets row on More shows the calorie target.
export const WithValue: Story = {
  render: () => (
    <ListRow title="Targets" subtitle="Set by you" value="2,200 kcal" href="/more/targets" />
  ),
};

// A row that runs an action, such as signing out, has no chevron.
export const Action: Story = {
  render: () => (
    <ListRow
      title="Sign out"
      subtitle="sam.taylor@example.com"
      onClick={() => undefined}
      chevron={false}
    />
  ),
};

// The icon sits in a small tile, as the About board draws the Legal rows.
export const WithIcon: Story = {
  render: () => (
    <>
      <ListRow icon={Shield} title="Privacy Policy" href="/privacy" />
      <ListRow icon={FileText} title="Terms" href="/terms" />
    </>
  ),
};

// The weigh-in list's rows: the figure strong with its unit after it, an imported reading with the heart, and a
// reading the trend left out with its badge and a muted figure.
export const WeighIns: Story = {
  render: () => (
    <>
      <ListRow
        icon={Pencil}
        title="Today"
        subtitle="07:10 · Added by you"
        value="81.4"
        unit="kg"
        valueLook="numeral"
      />
      <ListRow
        icon={Heart}
        title="Yesterday"
        subtitle="08:17 · Health Connect"
        value="81.8"
        unit="kg"
        valueLook="numeral"
      />
      <ListRow
        icon={Pencil}
        title="Wed 14 Oct"
        subtitle="08:31 · Added by you"
        badge={{ label: "Left out of trend", tone: "warning" }}
        value="88.9"
        unit="kg"
        valueLook="numeral"
        valueTone="muted"
      />
    </>
  ),
};

// A button row whose press is being worked on, such as a routine day picked to start: a spinner in place of the
// chevron, busy and enabled so focus stays, and a press does nothing until it clears.
export const Loading: Story = {
  render: () => (
    <>
      <ListRow
        title="Pull"
        subtitle="1 exercise · 3 sets"
        value="Tuesday"
        onClick={() => undefined}
        loading
      />
      <ListRow
        title="Legs"
        subtitle="5 exercises · 16 sets"
        value="Thursday"
        onClick={() => undefined}
        disabled
      />
    </>
  ),
};

// A row that is done has a tick at its end, named by its label, as the export's file row shows it. A long name
// wraps inside the row.
export const WithTick: Story = {
  render: () => (
    <>
      <ListRow
        icon={FileJson}
        title="ki-lo-export-2026-10-25.json"
        subtitle="1.8 MB · Ready to save"
        trailing={{ kind: "tick", label: "Ready" }}
      />
      <ListRow
        icon={FileJson}
        title="ki-lo-export-2026-10-25-with-a-very-long-name-that-wraps-inside-the-row.json"
        subtitle="1.8 MB · Downloaded"
        trailing={{ kind: "tick", label: "Downloaded" }}
      />
    </>
  ),
};

// The Targets page's four figures while a programme runs: the macro's colour as a key before the title, which is
// set in the body weight, and the figure strong with its unit after it. The row goes nowhere.
export const WithMacro: Story = {
  render: () => (
    <>
      <ListRow macro="calories" title="Calories" value="2,140" unit="kcal" valueLook="numeral" />
      <ListRow macro="protein" title="Protein" value="126" unit="g" valueLook="numeral" />
      <ListRow macro="carbs" title="Carbohydrate" value="245" unit="g" valueLook="numeral" />
      <ListRow macro="fat" title="Fat" value="73" unit="g" valueLook="numeral" />
    </>
  ),
};

// The Assistant settings page's switch row. The toggle is the row's one control, named by its label. The first
// row is off, the second on, the third busy (a change is being saved) and so dimmed, keeping focus.
export const WithToggle: Story = {
  render: () => (
    <>
      <ListRow
        title="Use the assistant"
        toggle={{ isOn: false, label: "Use the assistant", onValueChange: () => undefined }}
      />
      <ListRow
        title="Use the assistant"
        toggle={{ isOn: true, label: "Use the assistant", onValueChange: () => undefined }}
      />
      <ListRow
        title="Use the assistant"
        toggle={{
          isOn: true,
          label: "Use the assistant",
          onValueChange: () => undefined,
          disabled: true,
        }}
      />
    </>
  ),
};

function InteractiveToggleRow() {
  const [isOn, setIsOn] = useState(false);
  return (
    <ListRow
      title="Use the assistant"
      toggle={{ isOn, label: "Use the assistant", onValueChange: setIsOn }}
    />
  );
}

// A row that follows its own presses, to try the switch with a keyboard.
export const ToggleInteractive: Story = {
  render: () => <InteractiveToggleRow />,
};

// The Assistant changes list's rows: Undo is a text button in the accent ink and its own tab stop, a done row has
// its title muted with "Undone" at its end, and a row that cannot be undone says so in plain text. The last Undo is busy.
export const WithEndAction: Story = {
  render: () => (
    <>
      <ListRow
        title="Logged 2 eggs and toast at 08:10"
        subtitle="08:11 · 2 entries"
        trailing={{ kind: "action", label: "Undo", onPress: () => undefined }}
      />
      <ListRow
        title="Copied 8 entries from yesterday"
        subtitle="12:30"
        titleTone="secondary"
        trailing={{ kind: "label", label: "Undone" }}
      />
      <ListRow
        title="Logged a flat white at 07:30"
        subtitle="07:31 · changed in your diary since"
        trailing={{ kind: "label", label: "Can't undo" }}
      />
      <ListRow
        title="Archived recipe Pasta bake"
        subtitle="19:05"
        trailing={{ kind: "action", label: "Undo", onPress: () => undefined, busy: true }}
      />
    </>
  ),
};

// An action that deletes draws its title in the danger colour and has no chevron, as Delete all conversations does.
export const DangerTitle: Story = {
  render: () => (
    <ListRow
      title="Delete all conversations"
      titleTone="danger"
      onClick={() => undefined}
      chevron={false}
    />
  ),
};

export const Plain: Story = {
  render: () => <ListRow title="Expenditure" subtitle="Estimate" />,
};

export const Disabled: Story = {
  render: () => (
    <ListRow
      title="Weight"
      subtitle="Coming soon"
      onClick={() => undefined}
      disabled
      chevron={false}
    />
  ),
};

// A story cannot hold a real :hover or :active, so these two apply the classes the hover and press
// states apply. The unit of truth is still the component's own classes.
export const Hover: Story = {
  render: () => (
    <ListRow
      title="Your foods"
      subtitle="Foods you created or copied"
      href="/foods"
      className="bg-hover-overlay"
    />
  ),
};

export const Pressed: Story = {
  render: () => (
    <ListRow
      title="Your foods"
      subtitle="Foods you created or copied"
      href="/foods"
      className="scale-[0.985] bg-press-overlay"
    />
  ),
};

// Focus is real: the play function tabs onto the row, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  render: () => <ListRow title="Your foods" subtitle="Foods you created or copied" href="/foods" />,
  play: async () => {
    await userEvent.tab();
  },
};
