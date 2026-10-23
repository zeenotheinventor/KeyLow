import { UPDATING_LABEL } from "@keylow/core/copy";
import { act, fireEvent, render, screen } from "@testing-library/react-native";

import { UpdateScreen } from "../components/UpdateScreen";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

import type { UpdateScreenProps } from "../components/UpdateScreen";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("expo-status-bar", () => ({ StatusBar: () => null }));

// The app's theme is whatever the user chose, and the screen is the same in both.
async function renderScreen(props: UpdateScreenProps = {}, appTheme: ThemeScheme = "dark") {
  await render(
    <ThemeProvider fixedPreference={appTheme}>
      <UpdateScreen {...props} />
    </ThemeProvider>,
  );
}

const bar = () => screen.getByRole("progressbar", { name: UPDATING_LABEL });

// The logo is decoration, hidden from a screen reader and with no role, so it is found by its type. The
// screen's own container has no role either, and carries an id for this.
function logo() {
  const [image] = screen.root?.queryAll((node) => node.type === "Image") ?? [];
  if (image === undefined) {
    throw new Error("The update screen drew no logo");
  }
  return image;
}
const container = () => screen.getByTestId("update-screen", { includeHiddenElements: true });

describe("UpdateScreen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/UpdateScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should show the logo and one progress bar named from the core copy", async () => {
    await renderScreen();

    expect(logo()).toBeOnTheScreen();
    expect(screen.getAllByRole("progressbar")).toHaveLength(1);
    expect(bar()).toBeOnTheScreen();
  });

  it("should show no text", async () => {
    await renderScreen({ progress: 0.4 });

    expect(screen.queryByText(/./)).not.toBeOnTheScreen();
  });

  it("should hide the logo from a screen reader, as the bar already says what is happening", async () => {
    await renderScreen();

    expect(logo()).toHaveProp("aria-hidden", true);
  });

  describe("the bar", () => {
    it.each([
      [0.4, 40],
      [0.376, 38],
      [1, 100],
    ])("should say a progress of %s as %s per cent", async (progress, percentage) => {
      await renderScreen({ progress });

      expect(bar()).toHaveAccessibilityValue({ min: 0, max: 100, now: percentage });
    });

    it.each<[string, number | undefined]>([
      ["not reported", undefined],
      ["still at 0", 0],
    ])("should be indeterminate while the progress is %s", async (_description, progress) => {
      await renderScreen({ progress });

      expect(bar()).not.toHaveProp("aria-valuenow");
    });
  });

  describe("the splash look", () => {
    it("should draw the logo 200 points wide and square, centred, as the native splash does", async () => {
      await renderScreen();

      expect(logo().parent).toHaveStyle({ width: 200, aspectRatio: 1 });
      expect(container()).toHaveStyle({
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "center",
      });
    });

    it("should hold the bar in the logo's width, under it, with a 24 point gap", async () => {
      await renderScreen();

      expect(bar().parent).toHaveStyle({
        position: "absolute",
        top: "100%",
        marginTop: 24,
        left: 0,
        right: 0,
      });
    });

    it.each<ThemeScheme>(["dark", "light"])(
      "should be on the splash background when the app is in the %s theme",
      async (appTheme) => {
        await renderScreen({}, appTheme);

        expect(container()).toHaveStyle({ backgroundColor: resolvedColor("dark", "background") });
      },
    );

    it.each<ThemeScheme>(["dark", "light"])(
      "should draw the bar in the dark theme's colours when the app is in the %s theme",
      async (appTheme) => {
        await renderScreen({ progress: 0.5 }, appTheme);

        expect(bar()).toHaveStyle({ backgroundColor: resolvedColor("dark", "border") });
      },
    );
  });

  it("should say when it has been laid out", async () => {
    const onLayout = jest.fn();
    await renderScreen({ onLayout });

    await act(async () => {
      await fireEvent(container(), "layout", {
        nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 844 } },
      });
    });

    expect(onLayout).toHaveBeenCalledTimes(1);
  });
});
