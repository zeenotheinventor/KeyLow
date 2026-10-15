import { useState } from "react";
import { View } from "react-native";

import { Checkbox } from "./Checkbox";
import { CheckboxLink } from "./CheckboxLink";

import type { CheckboxProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const termsLabel =
  "I accept the Terms and the Privacy Policy, including storing my weight, food diary and body stats to run the app.";

// Every story keeps its own choice, as a screen does, so a press changes the box.
function KeptChoice({
  initial,
  ...props
}: Omit<CheckboxProps, "checked" | "onChange"> & { initial: boolean }) {
  const [checked, setChecked] = useState(initial);
  return <Checkbox {...props} checked={checked} onChange={setChecked} />;
}

const meta = {
  title: "UI/Checkbox",
  component: Checkbox,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // Every story renders its own kept choice, so these only satisfy the props.
  args: { checked: false, label: termsLabel, onChange: () => undefined },
} satisfies Meta<typeof Checkbox>;

export default meta;

type Story = StoryObj<typeof meta>;

// The sign-up acceptance box as the board first draws it: unticked.
export const Unticked: Story = { render: () => <KeptChoice initial={false} label={termsLabel} /> };

export const Ticked: Story = { render: () => <KeptChoice initial label={termsLabel} /> };

// The label with the two links the sign-up board draws. A link opens its page and leaves the box as it is.
export const WithLinks: Story = {
  render: () => (
    <KeptChoice
      initial={false}
      label={
        <>
          I accept the <CheckboxLink onPress={() => undefined}>Terms</CheckboxLink> and the{" "}
          <CheckboxLink onPress={() => undefined}>Privacy Policy</CheckboxLink>, including storing
          my weight, food diary and body stats to run the app.
        </>
      }
    />
  ),
};

export const Disabled: Story = {
  render: () => <KeptChoice disabled initial={false} label={termsLabel} />,
};

export const DisabledTicked: Story = {
  render: () => <KeptChoice disabled initial label={termsLabel} />,
};
