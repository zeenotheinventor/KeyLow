import { useState } from "react";

import { CalorieRing } from "./CalorieRing";

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ComponentProps } from "react";

const meta = {
  title: "UI/CalorieRing",
  component: CalorieRing,
  decorators: [
    (Story) => (
      <div className="flex justify-center p-8">
        <Story />
      </div>
    ),
  ],
  args: { eaten: 1039, target: 2200 },
} satisfies Meta<typeof CalorieRing>;

export default meta;

type Story = StoryObj<typeof meta>;

// The day's figures from the design's diary board: 1,161 left.
export const UnderTarget: Story = {};

export const AtTarget: Story = { args: { eaten: 2200 } };

// Past the target the ring is full and gains two outlines of its own colour, one outside the stroke and
// one inside (ruling 17). The numeral reads the amount over, in the primary ink.
export const OverTarget: Story = { args: { eaten: 2412 } };

// A target of zero means none is set: an empty ring, the calories eaten as the numeral under "eaten",
// and no eaten or target lines.
export const NoTarget: Story = { args: { target: 0 } };

// Under 180 the numeral is the heading size and the eaten and target lines are left off.
export const Compact: Story = { args: { size: 160 } };

export const Estimate: Story = { args: { estimate: true } };

// A target the person set is not an estimate, so "(est.)" is left off.
export const NotAnEstimate: Story = { args: { estimate: false } };

export const NothingEaten: Story = { args: { eaten: 0 } };

type CountingRingProps = ComponentProps<typeof CalorieRing>;

function CountingRing(props: CountingRingProps) {
  const [eaten, setEaten] = useState(props.eaten);

  return (
    <div className="flex flex-col items-center gap-4">
      <CalorieRing {...props} eaten={eaten} />
      <button
        type="button"
        className="min-h-touch-target rounded-medium bg-surface px-4 text-body-strong text-text-primary"
        onClick={() => {
          setEaten((current) => current + 300);
        }}
      >
        Add 300 calories
      </button>
    </div>
  );
}

// Each press adds calories, so the numeral counts to its new value and flashes the accent as it lands.
export const CountsUp: Story = { render: (args) => <CountingRing {...args} /> };

const reducedMotionQuery = "(prefers-reduced-motion: reduce)";

const mediaListFor = (query: string): MediaQueryList => ({
  matches: query === reducedMotionQuery,
  media: query,
  onchange: null,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
  addListener: () => undefined,
  removeListener: () => undefined,
  dispatchEvent: () => false,
});

// The page is told the system's reduced motion setting is on while the story is shown, so the count-up
// can be seen to skip: the numeral jumps to its new value and nothing flashes. The ring's own CSS
// transition follows the real setting.
export const ReducedMotion: Story = {
  beforeEach: () => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = mediaListFor;
    return () => {
      window.matchMedia = original;
    };
  },
  render: (args) => <CountingRing {...args} />,
};
