import { bodyMapPalette } from "@keylow/tokens";
import { render } from "@testing-library/react-native";
import { makeMutable } from "react-native-reanimated";

import { Body3DCanvas } from "../../components/ui/Body3D/Body3DCanvas";
import { looksOf } from "../../components/ui/Body3D/looks";
import { FRAME_ASPECT, wholeBodyView } from "../support/zoomView";

import type { Body3DCanvasProps } from "../../components/ui/Body3D/types";

// The looks come from `BodyFigure`'s reading, and its folder reads the saved body choice.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// GL does not run in Jest, so the library's canvas draws its children into the test tree and the hooks that
// reach the renderer are stood in for. The frame callback, the reaction and `invalidate` are kept, so the test
// can run them as the render loop and the UI thread would.
const mockInvalidate = jest.fn();
const mockCamera = {
  zoom: 1,
  position: { set: jest.fn<undefined, [number, number, number]>() },
  updateProjectionMatrix: jest.fn(),
};
const mockFrame: { run: ((state: object, deltaSeconds: number) => void) | undefined } = {
  run: undefined,
};
jest.mock("@react-three/fiber/native", () => ({
  Canvas: ({ children }: { children: unknown }) => children,
  useFrame: (callback: (state: object, deltaSeconds: number) => void) => {
    mockFrame.run = callback;
  },
  useThree: (select: (state: object) => unknown) =>
    select({
      camera: mockCamera,
      invalidate: mockInvalidate,
      size: { width: 300, height: 220 },
    }),
}));

// Every reaction the canvas registered, in order. A test finds the one for a shared value by the value it reads.
const mockReactions: { prepare: () => unknown; react: () => void }[] = [];
jest.mock("react-native-reanimated", () => ({
  ...jest.requireActual<object>("react-native-reanimated"),
  useAnimatedReaction: (prepare: () => unknown, react: () => void) => {
    mockReactions.push({ prepare, react });
  },
}));
// The reaction runs on the UI thread and asks the JavaScript thread to draw. Here the ask is made at once.
jest.mock("react-native-worklets", () => ({
  ...jest.requireActual<object>("react-native-worklets/lib/module/mock"),
  scheduleOnRN: (callback: () => void) => {
    callback();
  },
}));

// A body whose box is not centred on the origin, so a turn about the origin would swing it.
const CENTRE = { x: 0.2, z: 0.5 };
const mockBodyGroup = {
  rotation: { y: 0 },
  position: {
    x: 0,
    y: 0,
    z: 0,
    set(x: number, y: number, z: number) {
      this.x = x;
      this.y = y;
      this.z = z;
    },
  },
};
jest.mock("@keylow/body-3d", () => ({
  BODY_FIELD_OF_VIEW_DEGREES: 30,
  BODY_LIGHTING: {
    dark: { ambientIntensity: 1, keyIntensity: 1, keyPosition: [0, 0, 1] },
    light: { ambientIntensity: 1, keyIntensity: 1, keyPosition: [0, 0, 1] },
  },
  colourFixedMaterials: jest.fn(),
  createLookFade: () => ({ moveTo: jest.fn(), step: () => false }),
  dressBody: () => ({
    group: mockBodyGroup,
    materials: {},
    box: { min: { x: -0.4, z: 0 }, max: { x: 0.8, z: 1 } },
    dispose: jest.fn(),
  }),
  frameBody: () => [0, 0, 5],
  pointsPerMetre: () => 100,
}));
jest.mock("@keylow/body-model/male.glb", () => 1, { virtual: true });
const mockModel = Promise.resolve({});
jest.mock("../../components/ui/Body3D/bundledModel", () => ({ bundledModel: () => mockModel }));

const colours = { muscle: "a", otherMuscle: "b", core: "c", clay: "d", skin: "e" };
const emphasis: Body3DCanvasProps["emphasis"] = {
  selected: undefined,
  selectedColor: "c",
  restingColor: "d",
  dim: 1,
  unselectedOpacity: 1,
};

async function drawBody(yaw = makeMutable(0), view = wholeBodyView()) {
  await render(
    <Body3DCanvas
      colours={colours}
      emphasis={emphasis}
      fadeMilliseconds={220}
      looks={looksOf("heat", {}, bodyMapPalette("dark"))}
      scheme="dark"
      view={view}
      yaw={yaw}
      frameAspect={FRAME_ASPECT}
    />,
  );
  return yaw;
}

function runFrame() {
  if (mockFrame.run === undefined) {
    throw new Error("The body has not asked for frames.");
  }
  mockFrame.run({}, 0.016);
}

// Where a point of the model ends up after the group's turn and move, as three.js places it.
function placed(point: { x: number; z: number }, yaw: number) {
  return {
    x: point.x * Math.cos(yaw) + point.z * Math.sin(yaw) + mockBodyGroup.position.x,
    z: -point.x * Math.sin(yaw) + point.z * Math.cos(yaw) + mockBodyGroup.position.z,
  };
}

describe("Body3DCanvas turning", () => {
  beforeEach(() => {
    mockInvalidate.mockClear();
    mockReactions.length = 0;
    mockCamera.zoom = 1;
    mockCamera.position.set.mockClear();
    mockCamera.updateProjectionMatrix.mockClear();
    mockBodyGroup.rotation.y = 0;
    mockBodyGroup.position.set(0, 0, 0);
    mockFrame.run = undefined;
  });

  it("should turn the body to the yaw each frame reads", async () => {
    const yaw = await drawBody();

    yaw.set(1.2);
    runFrame();
    expect(mockBodyGroup.rotation.y).toBe(1.2);

    yaw.set(Math.PI);
    runFrame();
    expect(mockBodyGroup.rotation.y).toBe(Math.PI);
  });

  it("should face the back on the first frame when the yaw starts there", async () => {
    await drawBody(makeMutable(Math.PI));

    runFrame();

    expect(mockBodyGroup.rotation.y).toBe(Math.PI);
  });

  it.each([0, 0.7, Math.PI / 2, Math.PI, -2.1])(
    "should turn the body on the spot, with the middle of its box staying where it was, at a yaw of %f",
    async (turn) => {
      const yaw = await drawBody();

      yaw.set(turn);
      runFrame();

      const middle = placed(CENTRE, turn);
      expect(middle.x).toBeCloseTo(CENTRE.x);
      expect(middle.z).toBeCloseTo(CENTRE.z);
    },
  );

  it("should ask for a frame when the yaw changes, because the loop draws only on demand", async () => {
    const yaw = await drawBody();
    mockInvalidate.mockClear();

    yaw.set(0.4);
    // The UI thread reads the yaw in the reaction's first function and runs the second when it has changed.
    reactionReading(0.4).react();

    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });
});

function reactionReading(value: unknown) {
  const reaction = mockReactions.find((candidate) => candidate.prepare() === value);
  if (reaction === undefined) {
    throw new Error("No reaction reads that value.");
  }
  return reaction;
}

describe("Body3DCanvas zooming", () => {
  beforeEach(() => {
    mockInvalidate.mockClear();
    mockReactions.length = 0;
    mockCamera.zoom = 1;
    mockCamera.position.set.mockClear();
    mockCamera.updateProjectionMatrix.mockClear();
    mockFrame.run = undefined;
  });

  it("should leave the camera at the framing, and its projection alone, for the whole body", async () => {
    await drawBody();
    mockCamera.updateProjectionMatrix.mockClear();

    runFrame();

    expect(mockCamera.position.set).toHaveBeenLastCalledWith(0, 0, 5);
    expect(mockCamera.zoom).toBe(1);
    expect(mockCamera.updateProjectionMatrix).not.toHaveBeenCalled();
  });

  it("should zoom the camera to the zoom each frame reads, and rebuild the projection only when it changed", async () => {
    const view = wholeBodyView();
    await drawBody(makeMutable(0), view);
    mockCamera.updateProjectionMatrix.mockClear();

    view.set({ zoom: 1.5, x: 0, y: 0 });
    runFrame();
    runFrame();

    expect(mockCamera.zoom).toBe(1.5);
    expect(mockCamera.updateProjectionMatrix).toHaveBeenCalledTimes(1);
  });

  it("should move the camera up when the body is panned down, and left when it is panned right", async () => {
    const view = wholeBodyView();
    await drawBody(makeMutable(0), view);

    // At 100 points to the metre and twice the size, 100 points is half a metre.
    view.set({ zoom: 2, x: 100, y: 100 });
    runFrame();

    const [x, y, z] = mockCamera.position.set.mock.lastCall ?? [];
    expect(x).toBeCloseTo(-0.5);
    expect(y).toBeCloseTo(0.5);
    expect(z).toBe(5);
  });

  it("should ask for a frame when the view changes, because the loop draws only on demand", async () => {
    const view = wholeBodyView();
    await drawBody(makeMutable(0), view);
    view.set({ zoom: 1.7, x: 3, y: 4 });
    mockInvalidate.mockClear();

    // The UI thread reads the view in the reaction's first function and runs the second when it has changed.
    reactionReading(view.get()).react();

    expect(mockInvalidate).toHaveBeenCalledTimes(1);
  });

  it("should register one reaction for the view, and one for the turn", async () => {
    await drawBody();

    expect(mockReactions).toHaveLength(2);
  });
});
