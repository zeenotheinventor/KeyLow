import { bodyMapPalette } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";

import { Body3D } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { Body3DProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// GL does not run in Jest, and the canvas module brings in three, which Jest does not transform. The canvas
// is stood in for, so the test reaches the component's own markup and what it hands to the canvas.
const mockCanvas = jest.fn<null, [{ color: string }]>(() => null);
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => ({
  Body3DCanvas: (props: { color: string }) => mockCanvas(props),
}));

const label = "Body, 3D test shape";

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
    "should draw in the silhouette colour of the %s theme",
    async (scheme) => {
      await renderBody({}, scheme);

      expect(mockCanvas).toHaveBeenCalledWith({ color: bodyMapPalette(scheme).silhouette });
    },
  );

  it("should keep the figure's place, and not throw, when the canvas fails", async () => {
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    mockCanvas.mockImplementation(() => {
      throw new Error("The GL context could not start.");
    });

    await renderBody();

    expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
  });
});
