import { bodyMapPalette } from "@keylow/tokens";

import { body3DCanvasElement } from "../../components/ui/Body3D/body3DCanvasElement";
import { looksOf } from "../../components/ui/Body3D/looks";

// The looks come from `BodyFigure`'s reading, and its folder reads the saved body choice.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const mockCanvas = () => null;
let mockCanvasModuleThrows = false;
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => {
  if (mockCanvasModuleThrows) {
    throw new Error("Cannot find native module 'ExpoGL'");
  }
  return { Body3DCanvas: mockCanvas };
});

describe("body3DCanvasElement", () => {
  it("should be null when the canvas module cannot be read, as on a build without expo-gl", () => {
    mockCanvasModuleThrows = true;

    expect(
      body3DCanvasElement({
        colours: { muscle: "a", otherMuscle: "b", core: "c", clay: "d", skin: "e" },
        scheme: "dark",
        looks: looksOf("heat", {}, bodyMapPalette("dark")),
        emphasis: {
          selected: undefined,
          selectedColor: "f",
          restingColor: "g",
          dim: 1,
          unselectedOpacity: 1,
        },
        fadeMilliseconds: 220,
      }),
    ).toBeNull();
  });
});
