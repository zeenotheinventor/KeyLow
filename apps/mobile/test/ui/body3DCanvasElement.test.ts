import { body3DCanvasElement } from "../../components/ui/Body3D/body3DCanvasElement";

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

    expect(body3DCanvasElement("silhouette")).toBeNull();
  });
});
