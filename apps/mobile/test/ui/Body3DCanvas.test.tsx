import { bodyMapPalette } from "@keylow/tokens";
import { render } from "@testing-library/react-native";

import { Body3DCanvas } from "../../components/ui/Body3D/Body3DCanvas";
import { looksOf } from "../../components/ui/Body3D/looks";

import type { Body3DCanvasProps } from "../../components/ui/Body3D/types";
import type { RootState } from "@react-three/fiber/native";

// The looks come from `BodyFigure`'s reading, and its folder reads the saved body choice.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// GL does not run in Jest, so the canvas of react-three-fiber is stood in for. It keeps the props it was
// given, so the test can run `onCreated` as the library would once the renderer exists.
const mockCanvasProps: { onCreated?: ((state: RootState) => void) | undefined } = {};
jest.mock("@react-three/fiber/native", () => ({
  Canvas: (props: { onCreated?: (state: RootState) => void }) => {
    mockCanvasProps.onCreated = props.onCreated;
    return null;
  },
  useFrame: jest.fn(),
  useThree: jest.fn(),
}));
jest.mock("@keylow/body-3d", () => ({
  BODY_FIELD_OF_VIEW_DEGREES: 30,
  BODY_LIGHTING: {
    dark: { ambientIntensity: 1, keyIntensity: 1, keyPosition: [0, 0, 1] },
    light: { ambientIntensity: 1, keyIntensity: 1, keyPosition: [0, 0, 1] },
  },
  dressBody: jest.fn(),
  frameBody: jest.fn(),
}));
jest.mock("@keylow/body-model/male.glb", () => 1, { virtual: true });
jest.mock("../../components/ui/Body3D/bundledModel", () => ({ bundledModel: jest.fn() }));

const colours = { muscle: "a", otherMuscle: "b", core: "c", clay: "d", skin: "e" };
const looks = looksOf("heat", {}, bodyMapPalette("dark"));
const emphasis: Body3DCanvasProps["emphasis"] = {
  selected: undefined,
  selectedColor: "c",
  restingColor: "d",
  dim: 1,
  unselectedOpacity: 1,
};

// The part of the renderer that the canvas touches.
const rendererWithDebug = () => ({ debug: { onShaderError: null as (() => void) | null } });

async function createRenderer(onError?: () => void) {
  const gl = rendererWithDebug();
  await render(
    <Body3DCanvas
      colours={colours}
      emphasis={emphasis}
      fadeMilliseconds={220}
      looks={looks}
      onError={onError}
      scheme="dark"
    />,
  );
  mockCanvasProps.onCreated?.({ gl } as unknown as RootState);
  return gl;
}

describe("Body3DCanvas", () => {
  it("should call onError when three.js reports a shader that cannot be linked", async () => {
    const onError = jest.fn();
    const gl = await createRenderer(onError);

    gl.debug.onShaderError?.();

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("should not call onError while every shader links", async () => {
    const onError = jest.fn();

    await createRenderer(onError);

    expect(onError).not.toHaveBeenCalled();
  });

  it("should take over three.js's shader error report, and not throw without an onError", async () => {
    const gl = await createRenderer();

    expect(() => gl.debug.onShaderError?.()).not.toThrow();
    expect(gl.debug.onShaderError).toEqual(expect.any(Function));
  });
});
