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

const LOG_LENGTH = 8;

// A drag turns the body and it settles on Front or Back, a click taps, a 500 ms hold names the muscle under the pointer,
// and a pinch on a touch screen or a trackpad pinch (ctrl and the wheel) zooms. A plain wheel scrolls the page. The
// buttons stand in for the ones the screen draws, and the log shows what the body called.
function InteractiveBody(args: Body3DProps) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [resetCount, setResetCount] = useState(0);
  const [zoomInCount, setZoomInCount] = useState(0);
  const [zoomOutCount, setZoomOutCount] = useState(0);
  const [log, setLog] = useState<string[]>([]);
  const record = (entry: string) => {
    setLog((previous) => [entry, ...previous].slice(0, LOG_LENGTH));
  };
  return (
    <>
      <Body3D
        {...args}
        side={side}
        zoomInCount={zoomInCount}
        zoomOutCount={zoomOutCount}
        zoomResetCount={resetCount}
        onLongPressMuscle={(muscle) => {
          record(`Hold: ${muscle}`);
        }}
        onSideChange={(next) => {
          setSide(next);
          record(`Side: ${next}`);
        }}
        onTap={() => {
          record("Tap");
        }}
        onZoomChange={(zoom) => {
          record(`Zoom: ${zoom}`);
        }}
      />
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => {
            setZoomOutCount(zoomOutCount + 1);
          }}
        >
          Zoom out
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setZoomInCount(zoomInCount + 1);
          }}
        >
          Zoom in
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setResetCount(resetCount + 1);
          }}
        >
          Reset
        </Button>
      </div>
      <ol aria-label="What the body called" className="h-48 w-full text-caption" role="log">
        {log.map((entry, index) => (
          <li key={`${entry}-${log.length - index}`}>{entry}</li>
        ))}
      </ol>
    </>
  );
}

// The stage is wider than the body, as the screen's is, so a drag starts anywhere on it. Drag to turn, click to tap, hold
// the chest for half a second, pinch or ctrl and scroll to zoom, and Reset eases back (at once with reduced motion).
export const Interactive: Story = {
  args: { touchWidth: 360 },
  render: (args) => <InteractiveBody {...args} />,
};

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
