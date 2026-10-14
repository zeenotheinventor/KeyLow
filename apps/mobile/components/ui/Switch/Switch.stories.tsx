import { FOOD_FORM } from "@keylow/core/copy";
import { useState } from "react";
import { Text as NativeText, View } from "react-native";

import { Switch } from "./Switch";

import type { Meta, StoryObj } from "@storybook/react-native";

// The food form draws the switch at the end of a row whose words are the screen's, so a story does too.
function PortionDefaultRow({ initial }: { initial: boolean }) {
  const [isOn, setIsOn] = useState(initial);
  return (
    <View className="h-control-md flex-row items-center justify-between">
      {/* The board sets the row's words at 14 over 20, semibold, which is between the type scale's sizes. */}
      <NativeText className="text-[14px] font-semibold leading-[20px] tabular-nums text-text-primary">
        {FOOD_FORM.makeDefault}
      </NativeText>
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
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

// The portion that is not the default, then the one that is.
export const Off: Story = { render: () => <PortionDefaultRow initial={false} /> };

export const On: Story = { render: () => <PortionDefaultRow initial /> };
