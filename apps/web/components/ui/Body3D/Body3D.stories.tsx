import { useEffect, useState } from "react";

import { BodyFigure } from "../BodyFigure";
import { heatSteps, inTurn } from "../BodyFigure/storyValues";
import { Button } from "../Button";
import { Body3D } from "./Body3D";

import type { Body3DProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactNode } from "react";

// The body is drawn for a dark stage in both themes. The web tokens have no dark scope inside the light theme, so the
// stage is the page's own background and each story opens in the dark theme. In light the body keeps its dark
// colours and lights on the light page.
function Stage({ children }: { children: ReactNode }) {
  return (
    <div className="flex justify-center p-8">
      <div className="flex flex-col items-center gap-4 rounded-medium bg-background p-6 text-text-primary">
        {children}
      </div>
    </div>
  );
}

const meta = {
  title: "UI/Body3D",
  component: Body3D,
  globals: { theme: "dark" },
  decorators: [
    (Story) => (
      <Stage>
        <Story />
      </Stage>
    ),
  ],
  // The same values as the BodyFigure stories, so a muscle is the same colour in both. The width is the 200 pixels of
  // the body map at 1280.
  args: { scale: "heat", values: heatSteps, label: "Body map in 3D, front", w: 200 },
} satisfies Meta<typeof Body3D>;

export default meta;

type Story = StoryObj<typeof meta>;

// Heat steps 0 to 5 from rested to peak, in turn. Peak glows. The body loads on first use, so the stage is empty for a moment.
export const Heat: Story = {};

export const HeatBack: Story = { args: { side: "back", label: "Body map in 3D, back" } };

// The five volume bands, cool to warm.
export const Volume: Story = { args: { scale: "volume", values: inTurn(5) } };

// Behind, on plan, ahead and not in plan.
export const Gap: Story = { args: { scale: "gap", values: inTurn(4) } };

// The selected muscle is lighter, and the rest fade while its details are open.
export const Selected: Story = { args: { selected: "chest_upper", unselectedOpacity: 0.3 } };

// The whole body at 30 % strength, as the actual map fades out for the projected one.
export const Dimmed: Story = { args: { dim: 0.3 } };

function TurningBody(args: Body3DProps) {
  const [side, setSide] = useState<"front" | "back">("front");
  return (
    <>
      <Body3D {...args} side={side} />
      <Button
        variant="secondary"
        onClick={() => {
          setSide(side === "front" ? "back" : "front");
        }}
      >
        Turn to the {side === "front" ? "back" : "front"}
      </Button>
    </>
  );
}

// A new side turns the body there by the shorter arc over 220 ms, or at once with reduced motion.
export const Turning: Story = { render: (args) => <TurningBody {...args} /> };

const realGetContext = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, "getContext");

function RefusesWebGL({ children }: { children: ReactNode }) {
  // The body asks once, as it mounts, so the context is refused before it renders.
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    value: () => null,
    configurable: true,
    writable: true,
  });
  useEffect(
    () => () => {
      if (realGetContext !== undefined) {
        Object.defineProperty(HTMLCanvasElement.prototype, "getContext", realGetContext);
      }
    },
    [],
  );
  return children;
}

function FallbackBody(args: Body3DProps) {
  const [hasFailed, setHasFailed] = useState(false);
  return hasFailed ? (
    <BodyFigure label="Body map, front" scale="heat" side="front" values={heatSteps} w={200} />
  ) : (
    <Body3D
      {...args}
      onError={() => {
        setHasFailed(true);
      }}
    />
  );
}

// With WebGL off the body draws nothing, writes nothing and calls onError once. The caller draws the 2D figure in its
// place, as this story does, and the screen shows only that figure.
export const WithoutWebGL: Story = {
  decorators: [
    (Story) => (
      <RefusesWebGL>
        <Story />
      </RefusesWebGL>
    ),
  ],
  render: (args) => <FallbackBody {...args} />,
};
