import { useState } from "react";

import { BodyFigure } from "./BodyFigure";
import { heatSteps, inTurn, legPressRoles } from "./storyValues";

import type { MuscleId } from "@keylow/core/training";
import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ComponentProps } from "react";

const meta = {
  title: "UI/BodyFigure",
  component: BodyFigure,
  decorators: [
    (Story) => (
      <div className="flex justify-center p-8 text-text-primary">
        <Story />
      </div>
    ),
  ],
  // The default is 120 pixels, the Train card size. The theme comes from the toolbar, so each
  // story shows in dark and in light.
  args: { side: "front", scale: "heat", values: heatSteps, label: "Body map, front", w: 120 },
} satisfies Meta<typeof BodyFigure>;

export default meta;

type Story = StoryObj<typeof meta>;

// Heat steps 0 to 5 from rested to peak. Peak glows.
export const Heat: Story = {};

export const HeatBack: Story = { args: { side: "back", label: "Body map, back" } };

// The five volume bands, cool to warm: not trained, maintaining, growing, productive and high.
export const Volume: Story = { args: { scale: "volume", values: inTurn(5) } };

export const VolumeBack: Story = {
  args: { scale: "volume", values: inTurn(5), side: "back", label: "Body map, back" },
};

// Behind, on plan, ahead and not in plan.
export const Gap: Story = { args: { scale: "gap", values: inTurn(4) } };

export const GapBack: Story = {
  args: { scale: "gap", values: inTurn(4), side: "back", label: "Body map, back" },
};

// The Leg Press by role, front and back: quads primary, glutes and hamstrings secondary, calves
// assisting. The rest are at rest.
export const Role: Story = {
  args: { scale: "role", values: legPressRoles },
  render: (args) => (
    <div className="flex items-center gap-4">
      <BodyFigure {...args} label="Leg Press muscles, front" side="front" />
      <BodyFigure {...args} label="Leg Press muscles, back" side="back" />
    </div>
  ),
};

// The selected muscle is outlined in the primary text colour.
export const Selected: Story = { args: { selected: "chest_upper" } };

// The details are open for one muscle, so the rest fade and it stays at full strength.
export const UnselectedFaded: Story = { args: { selected: "chest_upper", unselectedOpacity: 0.3 } };

// The whole figure at 30 % strength, as the actual map fades out for the projected one.
export const Dimmed: Story = { args: { dim: 0.3 } };

// Only the muscles at heat step 5 glow.
export const Glow: Story = { args: { values: { quads: 5, chest_lower: 5, biceps: 5, abs: 4 } } };

// A muscle with no value is at rest, so a figure with none is the grey body.
export const AtRest: Story = { args: { values: {}, w: 84 } };

export const Female: Story = { args: { body: "female" } };

export const FemaleBack: Story = {
  args: { body: "female", side: "back", label: "Body map, back" },
};

// The sizes the figure is drawn at: 64 pixels on the small cards, 120 on the Train card and 200 on the body map at 1280.
export const Sizes: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-end justify-center gap-6">
      <BodyFigure {...args} w={64} />
      <BodyFigure {...args} w={120} />
      <BodyFigure {...args} w={200} />
    </div>
  ),
};

// The figure takes its size from its width alone, so a parent that stretches or squeezes it does not
// collapse it: a flex row that would shrink it, and a grid cell that would stretch it.
export const InFlexAndGridParents: Story = {
  render: (args) => (
    <div className="flex w-full max-w-md flex-col gap-6">
      <div className="flex h-[200px] w-[100px] items-stretch gap-2 border border-border">
        <BodyFigure {...args} />
        <BodyFigure {...args} />
      </div>
      <div className="grid h-[400px] grid-cols-2 place-items-stretch gap-2 border border-border">
        <BodyFigure {...args} />
        <BodyFigure {...args} />
      </div>
    </div>
  ),
};

function InteractiveFigure(args: ComponentProps<typeof BodyFigure>) {
  const [selected, setSelected] = useState<MuscleId | undefined>(undefined);
  const [lastDetails, setLastDetails] = useState<MuscleId | undefined>(undefined);
  return (
    <div className="flex flex-col items-center gap-3">
      <BodyFigure
        {...args}
        onLongPressMuscle={setLastDetails}
        onPressMuscle={setSelected}
        selected={selected}
      />
      <p className="text-body text-text-secondary">Pressed: {selected ?? "nothing"}</p>
      <p className="text-body text-text-secondary">Details: {lastDetails ?? "nothing"}</p>
    </div>
  );
}

// With handlers each muscle is a button. Click one, or hold it, or Tab to it and press Enter or Space.
export const Interactive: Story = { render: (args) => <InteractiveFigure {...args} /> };
