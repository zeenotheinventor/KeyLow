import { createElement } from "react";

import type { ReactElement } from "react";

type CanvasModule = typeof import("./Body3DCanvas");

// Undefined until the first try, then the module, or null when it could not be read.
let canvasModule: CanvasModule | null | undefined;

/**
 * The GL canvas drawn in the colour, or null when it cannot be read. `onFirstFrame` is called once when
 * its first frame is drawn. It is read when the first Body3D draws, not when the
 * app starts, and not by a test that only imports the kit, because it brings in three,
 * react-three-fiber and the GL native module. On a build made before expo-gl was added, reading it
 * throws, because the native module is missing, and an over-the-air update must not crash such a build.
 */
export function body3DCanvasElement(color: string, onFirstFrame?: () => void): ReactElement | null {
  if (canvasModule === undefined) {
    try {
      // The cast is safe because require returns the module untyped. A top-level import would read three
      // at the start of every app run and every test that imports the kit.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      canvasModule = require("./Body3DCanvas") as CanvasModule;
    } catch {
      canvasModule = null;
    }
  }
  return canvasModule === null
    ? null
    : createElement(canvasModule.Body3DCanvas, { color, onFirstFrame });
}
