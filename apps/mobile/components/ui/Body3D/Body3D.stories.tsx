import { BODY_MAP } from "@keylow/core/copy";
import { useState } from "react";
import { View } from "react-native";

import { Body3D } from "./Body3D";
import { BodyFigure } from "../BodyFigure";
import { heatSteps, inTurn } from "../BodyFigure/storyValues";
import { SegmentedControl } from "../SegmentedControl";
import { Text } from "../Text";

import type { Body3DProps } from "./types";
import type { SegmentedControlOption } from "../SegmentedControl";
import type { BodySide } from "@keylow/body-3d/rotation";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/Body3D",
  component: Body3D,
  decorators: [
    (Story) => (
      <View className="flex-1 items-center justify-center p-4">
        <Story />
      </View>
    ),
  ],
  // The size of the body map's figure. The scheme comes from the theme toolbar, so the story shows in
  // dark and in light.
  args: { label: "Body, male, 3D", w: 120 },
} satisfies Meta<typeof Body3D>;

export default meta;

type Story = StoryObj<typeof meta>;

type BesideTheFigureProps = Pick<
  Body3DProps,
  "label" | "w" | "selected" | "dim" | "unselectedOpacity"
> &
  Required<Pick<Body3DProps, "scale" | "values">>;

// The 3D body on the left and the 2D figure of the same values on the right, so the colours can be compared. The
// 2D figure is the one `BodyFigure`'s own story of that name draws.
function BesideTheFigure({ label, w, ...valueProps }: BesideTheFigureProps) {
  return (
    <View className="flex-row items-center gap-4">
      <Body3D label={label} w={w} {...valueProps} />
      <BodyFigure label="Body map, front" side="front" w={w} {...valueProps} />
    </View>
  );
}

const sideOptions: SegmentedControlOption<BodySide>[] = [
  { value: "front", label: BODY_MAP.sideSwitch.front },
  { value: "back", label: BODY_MAP.sideSwitch.back },
];

// A screen keeps the side and the tap count, so the story does too: a drag that settles on the other side sets
// the side, the control sets it too, and a tap counts. The readout is the side the body has settled on.
function Turning(props: Body3DProps) {
  const [side, setSide] = useState<BodySide>("front");
  const [tapCount, setTapCount] = useState(0);
  return (
    <View className="items-center gap-4">
      <Body3D
        {...props}
        onSideChange={setSide}
        onTap={() => {
          setTapCount((count) => count + 1);
        }}
        side={side}
      />
      <Text variant="caption" tone="muted">
        {BODY_MAP.rotateHint}
      </Text>
      <Text aria-live="polite">{`Side: ${side}`}</Text>
      <Text aria-live="polite">{`Taps: ${tapCount}`}</Text>
      <View className="w-48">
        <SegmentedControl
          label={BODY_MAP.sideSwitch.name}
          onChange={setSide}
          options={sideOptions}
          value={side}
        />
      </View>
      <Text tone="secondary" variant="caption">
        {BODY_MAP.sideSwitchDescription}
      </Text>
    </View>
  );
}

const besideTheFigure: Story["render"] = (args) => (
  <BesideTheFigure {...args} scale={args.scale ?? "heat"} values={args.values ?? {}} />
);

// The male body with every muscle at rest, seen through a faint skin. The theme toolbar shows it in light and dark.
export const AtRest: Story = { args: { values: {} }, render: besideTheFigure };

export const Wide: Story = { args: { w: 240 } };

// Heat steps 0 to 5 from rested to peak, the golden pattern of `BodyFigure`'s Heat story. Peak glows.
export const Heat: Story = { args: { scale: "heat", values: heatSteps }, render: besideTheFigure };

// Under, maintaining, productive, over and not targeted.
export const Volume: Story = {
  args: { scale: "volume", values: inTurn(5) },
  render: besideTheFigure,
};

// Behind, on plan, ahead and not in plan.
export const Gap: Story = { args: { scale: "gap", values: inTurn(4) }, render: besideTheFigure };

// The selected muscle is pulled towards the primary text colour, as the 2D figure outlines it in that colour.
export const Selected: Story = {
  args: { scale: "heat", values: heatSteps, selected: "chest_upper" },
  render: besideTheFigure,
};

// The whole figure at 30 % strength, as the actual map fades out for the projected one.
export const Dimmed: Story = {
  args: { scale: "heat", values: heatSteps, dim: 0.3 },
  render: besideTheFigure,
};

// Only the muscles at heat step 5 glow.
export const Glow: Story = {
  args: { scale: "heat", values: { quads: 5, chest_lower: 5, biceps: 5, abs: 4 } },
  render: besideTheFigure,
};

/**
 * Drag the body sideways to turn it: a drag across its width is half a turn, it follows the finger, and on
 * release it settles on the nearer of Front and Back. Front and Back turn it too, by the shorter arc. A short
 * tap counts and a drag never does. A vertical swipe on the body scrolls the page. The image is a single
 * `img` with no action of its own, so nothing here depends on a gesture alone: the control turns the body, and
 * a screen's own toggle button does what a tap does.
 */
export const Rotatable: Story = {
  args: { scale: "heat", values: heatSteps, w: 160 },
  render: (args) => <Turning {...args} />,
};
