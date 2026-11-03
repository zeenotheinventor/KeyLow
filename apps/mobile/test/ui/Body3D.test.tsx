import { bodyMapPalette, motionDuration, themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { Body3D } from "../../components/ui";
import { looksOf } from "../../components/ui/Body3D/looks";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Body3DProps } from "../../components/ui";
import type { Body3DCanvasProps } from "../../components/ui/Body3D/types";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// GL does not run in Jest, and the canvas module brings in three, which Jest does not transform. The canvas
// is stood in for, so the test reaches the component's own markup and what it hands to the canvas.
const mockCanvas = jest.fn<null, [Body3DCanvasProps]>(() => null);
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: Body3DCanvasProps) => mockCanvas(props),
}));

const label = "Body, male, 3D";

function renderBody(props: Partial<Body3DProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Body3D label={label} w={120} {...props} />
    </ThemeProvider>,
  );
}

describe("Body3D", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockCanvas.mockReset();
    mockCanvas.mockReturnValue(null);
  });

  it("should be one image named by its label", async () => {
    await renderBody();

    expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
  });

  it("should take the width it is given and the height of the 200 by 440 figure", async () => {
    await renderBody({ w: 100 });

    expect(screen.getByRole("img", { name: label })).toHaveStyle({ width: 100, height: 220 });
  });

  it.each<ThemeScheme>(["dark", "light"])(
    "should give the canvas the body colours of the %s theme, from the tokens",
    async (scheme) => {
      const palette = bodyMapPalette(scheme);

      await renderBody({}, scheme);

      expect(mockCanvas).toHaveBeenCalledWith(
        expect.objectContaining({
          colours: {
            muscle: palette.silhouette,
            otherMuscle: palette.otherMuscle,
            core: palette.core,
            clay: palette.clay,
            skin: palette.skin,
          },
        }),
      );
    },
  );

  it.each<ThemeScheme>(["dark", "light"])(
    "should light the body for the %s theme",
    async (scheme) => {
      await renderBody({}, scheme);

      expect(mockCanvas).toHaveBeenCalledWith(expect.objectContaining({ scheme }));
    },
  );

  it.each<ThemeScheme>(["dark", "light"])(
    "should give the canvas the looks BodyFigure's reading gives, in the %s theme",
    async (scheme) => {
      const values = { chest_upper: 5, quads: 2 };

      await renderBody({ scale: "heat", values }, scheme);

      expect(mockCanvas).toHaveBeenLastCalledWith(
        expect.objectContaining({ looks: looksOf("heat", values, bodyMapPalette(scheme)) }),
      );
    },
  );

  it("should draw every muscle at rest on heat when it is given no values", async () => {
    await renderBody();

    expect(mockCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({ looks: looksOf("heat", {}, bodyMapPalette("dark")) }),
    );
  });

  it("should read the values on the scale it is given", async () => {
    await renderBody({ scale: "volume", values: { abs: 2 } });

    expect(mockCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({ looks: looksOf("volume", { abs: 2 }, bodyMapPalette("dark")) }),
    );
  });

  it("should hand the canvas the emphasis with BodyFigure's defaults, in the primary text colour and the resting grey", async () => {
    await renderBody();

    expect(mockCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({
        emphasis: {
          selected: undefined,
          selectedColor: themes.dark["text-primary"],
          restingColor: bodyMapPalette("dark").silhouette,
          dim: 1,
          unselectedOpacity: 1,
        },
      }),
    );
  });

  it("should hand the canvas the selected muscle, the dim and the unselected opacity", async () => {
    await renderBody({ selected: "biceps", dim: 0.3, unselectedOpacity: 0.5 });

    expect(mockCanvas.mock.lastCall?.[0].emphasis).toEqual({
      selected: "biceps",
      selectedColor: themes.dark["text-primary"],
      restingColor: bodyMapPalette("dark").silhouette,
      dim: 0.3,
      unselectedOpacity: 0.5,
    });
  });

  it("should ask the canvas for the 220 ms fade", async () => {
    await renderBody();

    expect(mockCanvas).toHaveBeenLastCalledWith(
      expect.objectContaining({ fadeMilliseconds: motionDuration.standard }),
    );
  });

  it("should call onFirstFrame when the canvas draws its first frame", async () => {
    const onFirstFrame = jest.fn();
    mockCanvas.mockImplementation(({ onFirstFrame: drawn }) => {
      drawn?.();
      return null;
    });

    await renderBody({ onFirstFrame });

    expect(onFirstFrame).toHaveBeenCalledTimes(1);
  });

  it("should not call onFirstFrame while the canvas has drawn nothing", async () => {
    const onFirstFrame = jest.fn();

    await renderBody({ onFirstFrame });

    expect(onFirstFrame).not.toHaveBeenCalled();
  });

  it("should call onError once when the canvas throws", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    const onError = jest.fn();
    mockCanvas.mockImplementation(() => {
      throw new Error("The GL context could not start.");
    });

    await renderBody({ onError });

    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("should not call onError when the canvas draws", async () => {
    const onError = jest.fn();

    await renderBody({ onError });

    expect(onError).not.toHaveBeenCalled();
  });

  it("should keep the figure's place, and not throw, when the canvas fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockCanvas.mockImplementation(() => {
      throw new Error("The GL context could not start.");
    });

    await renderBody();

    expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
  });
});
