// The pose of the "Loading the bar" logo at one moment of its loop, as plain numbers. It is the
// prototype page's POSES.load, and it runs on the UI thread inside the animated props, so every
// function here, and every helper it calls, starts with the "worklet" directive. One without it passes
// Jest, which runs everything on the JavaScript thread, and crashes the phone.

/** How far a plate sits from its seat when it is not on the bar, in view box units. */
const PLATE_TRAVEL = 52;
const ARC_LENGTH = 205;
// A dash longer than the circle, so the pattern never repeats round the arc.
const DASH_GAP = 1000;
const AXIS = Math.SQRT1_2;
/** The bar is dipped by the plates landing, up to this far along each axis before it is scaled by AXIS. */
const KNOCK_DEPTH = 7;

export type LinePose = { x1: number; y1: number; x2: number; y2: number };
export type PlatePose = LinePose & { opacity: number };
export type ArcPose = {
  /** The drawn length of the arc, in view box units. */
  length: number;
  /** The dash phase, never negative, that leaves the erased start of the arc blank. */
  offset: number;
  opacity: number;
};
export type LoadingMarkPose = {
  bar: LinePose;
  plateOne: PlatePose;
  plateTwo: PlatePose;
  arcOne: ArcPose;
  arcTwo: ArcPose;
};

function span(t: number, from: number, to: number): number {
  "worklet";
  return Math.max(0, Math.min(1, (t - from) / (to - from)));
}

function inOut(x: number): number {
  "worklet";
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

// Overshoots its seat a little and settles, which is how a plate seats on the bar.
function backOut(x: number): number {
  "worklet";
  const overshoot = 1.4;
  const y = x - 1;
  return 1 + (overshoot + 1) * y * y * y + overshoot * y * y;
}

function knock(t: number, at: number): number {
  "worklet";
  const sinceKnock = t - at;
  return sinceKnock < 0 ? 0 : Math.exp(-sinceKnock * 22) * Math.sin(sinceKnock * 46);
}

// The same pattern position as the page's negative offset, written as a positive one, because a
// negative phase is not safe to hand to the native dash on iOS.
function arcPose(drawnLength: number, erased: number): ArcPose {
  "worklet";
  const length = Math.max(0, drawnLength - erased);

  return {
    length,
    offset: (length + DASH_GAP - erased) % (length + DASH_GAP),
    opacity: length < 0.5 ? 0 : 1,
  };
}

/** `t` runs 0 to 1 through the loop. The same `t` always gives the same numbers. */
export function loadingMarkPose(t: number): LoadingMarkPose {
  "worklet";
  const off = inOut(span(t, 0.82, 0.98));
  const travelOne = PLATE_TRAVEL * (1 - backOut(span(t, 0.03, 0.2))) + PLATE_TRAVEL * off;
  const travelTwo = PLATE_TRAVEL * (1 - backOut(span(t, 0.29, 0.46))) + PLATE_TRAVEL * off;
  const fadeOut = 1 - span(t, 0.86, 0.98);
  const erased = ARC_LENGTH * off;
  const dip = KNOCK_DEPTH * (knock(t, 0.14) + knock(t, 0.4)) * AXIS;
  const shiftOne = travelOne * AXIS;
  const shiftTwo = -travelTwo * AXIS;

  return {
    bar: { x1: 72 + dip, y1: 184 + dip, x2: 184 + dip, y2: 72 + dip },
    plateOne: {
      x1: 150 + shiftOne + dip,
      y1: 60 - shiftOne + dip,
      x2: 196 + shiftOne + dip,
      y2: 106 - shiftOne + dip,
      opacity: Math.min(span(t, 0.03, 0.09), fadeOut),
    },
    plateTwo: {
      x1: 60 + shiftTwo + dip,
      y1: 150 - shiftTwo + dip,
      x2: 106 + shiftTwo + dip,
      y2: 196 - shiftTwo + dip,
      opacity: Math.min(span(t, 0.29, 0.35), fadeOut),
    },
    arcOne: arcPose(ARC_LENGTH * inOut(span(t, 0.13, 0.36)), erased),
    arcTwo: arcPose(ARC_LENGTH * inOut(span(t, 0.39, 0.62)), erased),
  };
}
