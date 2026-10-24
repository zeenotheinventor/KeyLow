import { View } from "react-native";

import { Body3D } from "./Body3D";
import { BodyFigure } from "../BodyFigure";
import { heatSteps, inTurn } from "../BodyFigure/storyValues";

import type { Body3DProps } from "./types";
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

type BesideTheFigureProps = Body3DProps & Required<Pick<Body3DProps, "scale" | "values">>;

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
