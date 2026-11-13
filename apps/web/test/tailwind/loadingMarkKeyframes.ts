// The "Loading the bar" loop as CSS keyframes, sampled from the pose maths of the canvas prototype
// (`design-canvas-assistant-render/assistant/loading-mark-prototype.html`, `POSES.load`), which the phone
// runs as `apps/mobile/components/LoadingMark/loadingMarkPose.ts`. `tailwind/animations/loading-mark.json`
// is this function's output, and a test fails when the two differ. To change the loop, edit this file and
// write the output over the JSON:
//
//   node --experimental-strip-types -e "import('./test/tailwind/loadingMarkKeyframes.ts').then((m) => process.stdout.write(JSON.stringify(m.loadingMarkAnimations(), null, 2) + '\n'))" > tailwind/animations/loading-mark.json

export const LOOP_MILLISECONDS = 2200;
/** The loop's first drawn frame is the complete logo, which is 0.72 of the way through the pose. */
export const FIRST_FRAME_POSITION = 0.72;

const PLATE_TRAVEL = 52;
const ARC_LENGTH = 205;
// A dash longer than the circle, so the pattern never repeats round the arc.
const DASH_GAP = 1000;
const AXIS = Math.SQRT1_2;
const KNOCK_DEPTH = 7;
// One keyframe every percent of the loop, which is 22 ms.
const STEP = 0.01;

function span(t: number, from: number, to: number): number {
  return Math.max(0, Math.min(1, (t - from) / (to - from)));
}

function inOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Overshoots its seat a little and settles, which is how a plate seats on the bar.
function backOut(x: number): number {
  const overshoot = 1.4;
  const y = x - 1;
  return 1 + (overshoot + 1) * y * y * y + overshoot * y * y;
}

function knock(t: number, at: number): number {
  const sinceKnock = t - at;
  return sinceKnock < 0 ? 0 : Math.exp(-sinceKnock * 22) * Math.sin(sinceKnock * 46);
}

function round(value: number): number {
  // Adding 0 turns a negative zero into zero.
  return Math.round(value * 1000) / 1000 + 0;
}

function arc(drawnLength: number, erased: number) {
  const length = Math.max(0, drawnLength - erased);
  return {
    strokeDasharray: `${round(length)} ${DASH_GAP}`,
    strokeDashoffset: `${round(-erased)}`,
    opacity: length < 0.5 ? "0" : "1",
  };
}

function poses(t: number) {
  const off = inOut(span(t, 0.82, 0.98));
  const travelOne = PLATE_TRAVEL * (1 - backOut(span(t, 0.03, 0.2))) + PLATE_TRAVEL * off;
  const travelTwo = PLATE_TRAVEL * (1 - backOut(span(t, 0.29, 0.46))) + PLATE_TRAVEL * off;
  const fadeOut = 1 - span(t, 0.86, 0.98);
  const erased = ARC_LENGTH * off;
  const dip = round(KNOCK_DEPTH * (knock(t, 0.14) + knock(t, 0.4)) * AXIS);
  const shiftOne = round(travelOne * AXIS);
  const shiftTwo = round(-travelTwo * AXIS);

  return {
    "loading-knock": { transform: `translate(${dip}px, ${dip}px)` },
    "loading-plate-one": {
      transform: `translate(${shiftOne}px, ${-shiftOne + 0}px)`,
      opacity: `${round(Math.min(span(t, 0.03, 0.09), fadeOut))}`,
    },
    "loading-plate-two": {
      transform: `translate(${shiftTwo}px, ${-shiftTwo + 0}px)`,
      opacity: `${round(Math.min(span(t, 0.29, 0.35), fadeOut))}`,
    },
    "loading-arc-one": arc(ARC_LENGTH * inOut(span(t, 0.13, 0.36)), erased),
    "loading-arc-two": arc(ARC_LENGTH * inOut(span(t, 0.39, 0.62)), erased),
  };
}

type PartName = keyof ReturnType<typeof poses>;
type Frame = Record<string, string>;

const partNames: PartName[] = [
  "loading-knock",
  "loading-plate-one",
  "loading-plate-two",
  "loading-arc-one",
  "loading-arc-two",
];

/** One part's frames at every step, leaving out a frame that sits between two frames equal to it. */
function keyframesOf(part: PartName): Record<string, Frame> {
  const steps = Math.round(1 / STEP);
  const frames = Array.from({ length: steps + 1 }, (_, step) => poses(step * STEP)[part]);
  const keyframes: Record<string, Frame> = {};
  frames.forEach((frame, step) => {
    const before = JSON.stringify(frames[step - 1]);
    const after = JSON.stringify(frames[step + 1]);
    const isEdge = step === 0 || step === steps;
    if (isEdge || JSON.stringify(frame) !== before || JSON.stringify(frame) !== after) {
      keyframes[step === 0 ? "from" : step === steps ? "to" : `${step}%`] = frame;
    }
  });
  return keyframes;
}

/** The `keyframes` and `animation` of the Tailwind theme, in the shape `tailwind/animations/*.json` holds. */
export function loadingMarkAnimations() {
  const delay = -Math.round(FIRST_FRAME_POSITION * LOOP_MILLISECONDS);
  return {
    keyframes: Object.fromEntries(partNames.map((part) => [part, keyframesOf(part)])),
    animation: Object.fromEntries(
      partNames.map((part) => [part, `${part} ${LOOP_MILLISECONDS}ms linear ${delay}ms infinite`]),
    ),
  };
}

/** The pose of every part at one moment of the loop, `t` from 0 to 1. */
export { poses as loadingMarkPoses };
