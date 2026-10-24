import { act, render, screen } from "@testing-library/react-native";

import { BodyView } from "../components/BodyView";
import { resetBody3DSupportForTests } from "../components/BodyView/testing";
import { resetBodyMapRendererForTests } from "../lib/bodyMapRenderer/testing";
import { ThemeProvider } from "../lib/theme";
import { body3DCanvasReads } from "./support/body3DCanvasReads";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { BodyViewProps } from "../components/BodyView";

const mockStorageItems = new Map<string, string>();
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => {
      mockStorageItems.set(key, value);
      return Promise.resolve();
    },
  },
}));

const mockHasGlModule = jest.fn(() => true);
jest.mock("expo", () => {
  const actual = jest.requireActual<typeof import("expo")>("expo");
  return {
    ...actual,
    requireOptionalNativeModule: (name: string): unknown =>
      name === "ExpoGL" && !mockHasGlModule() ? null : actual.requireOptionalNativeModule(name),
  };
});

// The factory runs when the 3D canvas module is first read, by an import or by a `require`. This counter
// is never cleared, and every test in this file expects it to stay at zero. A file of its own keeps it
// away from the tests that do load 3D, and a fresh module registry gives it a clean start.
jest.mock("../components/ui/Body3D/Body3DCanvas", () => {
  jest.requireActual<typeof import("./support/body3DCanvasReads")>(
    "./support/body3DCanvasReads",
  ).body3DCanvasReads.count += 1;
  return { Body3DCanvas: () => null };
});

const label = "Body map, front";
const bodyProps: BodyViewProps = { side: "front", scale: "heat", values: {}, label, w: 120 };

async function renderBodyView(preference: "2d" | "3d", props: Partial<BodyViewProps> = {}) {
  mockStorageItems.set("bodyMap.renderer", preference);
  await render(
    <ThemeProvider fixedPreference="dark">
      <BodyView {...bodyProps} {...props} />
    </ThemeProvider>,
  );
  // The stored preference is read a moment after the first render, and 3D would have 8 seconds to fail.
  await act(() => {
    jest.advanceTimersByTime(5000);
  });
}

describe("the 3D code stays unread", () => {
  beforeAll(async () => {
    registerAppStyles(await compileKitStyles("", ["components/BodyView"]));
  });

  beforeEach(() => {
    jest.useFakeTimers();
    mockStorageItems.clear();
    resetBodyMapRendererForTests();
    resetBody3DSupportForTests();
    mockHasGlModule.mockReturnValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should not be read by importing BodyView", () => {
    expect(body3DCanvasReads.count).toBe(0);
  });

  it("should not be read for a person on 2D", async () => {
    await renderBodyView("2d");

    expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
    expect(body3DCanvasReads.count).toBe(0);
  });

  it("should not be read for the female figure on 3D", async () => {
    await renderBodyView("3d", { body: "female" });

    expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
    expect(body3DCanvasReads.count).toBe(0);
  });

  it("should not be read in a build without the GL module", async () => {
    mockHasGlModule.mockReturnValue(false);

    await renderBodyView("3d");

    expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
    expect(body3DCanvasReads.count).toBe(0);
  });
});
