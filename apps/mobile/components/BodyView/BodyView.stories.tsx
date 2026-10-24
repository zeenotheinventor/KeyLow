import { MUSCLE_IDS } from "@keylow/core/training";
import { useEffect } from "react";
import { View } from "react-native";

import { BodyViewIn3D } from "./BodyViewIn3D";

import type { Body3DProps } from "../ui";
import type { Meta, StoryObj } from "@storybook/react-native";

const heatSteps = Object.fromEntries(MUSCLE_IDS.map((muscle, index) => [muscle, index % 6]));

// A 3D body that never draws a frame, so the 2D figure stays until the 8 seconds are up.
function NeverDrawsBody3D() {
  return null;
}

// A 3D body that cannot start, as one does on a phone with no GL.
function FailingBody3D({ onError }: Body3DProps) {
  useEffect(() => {
    onError?.();
  }, [onError]);
  return null;
}

const meta = {
  title: "BodyView",
  component: BodyViewIn3D,
  decorators: [
    (Story) => (
      <View className="flex-1 items-center justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // The body map screen draws it at 120 points. The scheme comes from the theme toolbar. `onFail` is
  // where the app remembers that 3D failed, and a story has nothing to remember.
  args: {
    side: "front",
    scale: "heat",
    values: heatSteps,
    label: "Body map, front",
    w: 120,
    onFail: () => undefined,
  },
} satisfies Meta<typeof BodyViewIn3D>;

export default meta;

type Story = StoryObj<typeof meta>;

// The 3D body is still loading, so the 2D figure shows. This one never draws, so after 8 seconds the
// 2D figure stays for good, which is also how a failure looks.
export const Loading: Story = { args: { Body3DComponent: NeverDrawsBody3D } };

// The real 3D body draws its first frame, and the 2D figure cross-fades to it over 220 ms.
export const Loaded: Story = {};

// The 3D body cannot start: the 2D figure stays, with no message and no retry.
export const Failed: Story = { args: { Body3DComponent: FailingBody3D } };
