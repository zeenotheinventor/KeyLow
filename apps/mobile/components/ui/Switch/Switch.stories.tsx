import { FOOD_FORM } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { Text } from "../Text";
import { Switch } from "./Switch";

import type { SwitchProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

type InteractiveSwitchProps = Extract<SwitchProps, { isDecorative?: false }>;

// The food form draws the switch at the end of a row whose words are the screen's, so a story does too.
function PortionDefaultRow({ initial }: { initial: boolean }) {
  const [isOn, setIsOn] = useState(initial);
  return (
    <View className="h-control-md flex-row items-center justify-between">
      <Text variant="label-small">{FOOD_FORM.makeDefault}</Text>
      <Switch isOn={isOn} label="Default portion" onValueChange={setIsOn} />
    </View>
  );
}

const meta = {
  title: "UI/Switch",
  component: Switch,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // Every story renders its own kept choice, so these only satisfy the props.
  args: { isOn: false, label: "Default portion", onValueChange: () => undefined },
  // The props are a union of the pressable switch and the drawing of one, so the controls are the
  // pressable switch's.
} satisfies Meta<InteractiveSwitchProps>;

export default meta;

type Story = StoryObj<typeof meta>;

// The portion that is not the default, then the one that is.
export const Off: Story = { render: () => <PortionDefaultRow initial={false} /> };

export const On: Story = { render: () => <PortionDefaultRow initial /> };
