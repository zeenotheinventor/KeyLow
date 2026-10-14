import { controlHeight } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";

import { GoogleButton } from "../components/GoogleButton";
import { ThemeProvider } from "../lib/theme";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";
import { viewsDrawn } from "./support/viewsDrawn";

import type { GoogleButtonProps } from "../components/GoogleButton";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderButton(props: Partial<GoogleButtonProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <GoogleButton onPress={() => undefined} {...props} />
    </ThemeProvider>,
  );
}

function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("GoogleButton", () => {
  let styles: string;

  beforeAll(async () => {
    styles = await compileKitStyles("", ["components/GoogleButton"]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
  });

  it("should be a button named Continue with Google", async () => {
    await renderButton();

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeOnTheScreen();
  });

  it("should call onPress when it is pressed", async () => {
    const onPress = jest.fn();
    const user = userEvent.setup();
    await renderButton({ onPress });

    await user.press(screen.getByRole("button", { name: "Continue with Google" }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("should draw the Google mark once, as decoration", async () => {
    await renderButton();

    const [mark, ...others] = drawings();
    expect(others).toHaveLength(0);
    expect(mark?.props["aria-hidden"]).toBe(true);
    expect(mark?.props.width).toBe(20);
    expect(mark?.props.height).toBe(20);
  });

  it.each<ThemeScheme>(["dark", "light"])(
    "should be a large secondary button in the %s scheme",
    async (scheme) => {
      await renderButton({}, scheme);

      expect(screen.getByRole("button", { name: "Continue with Google" })).toHaveStyle({
        height: controlHeight.lg,
        backgroundColor: resolvedColor(scheme, "surface-raised"),
        borderColor: resolvedColor(scheme, "border"),
        borderWidth: 1,
        borderRadius: 12,
      });
      expect(viewsDrawn({ flexDirection: "row", columnGap: 12 })).toHaveLength(1);
    },
  );

  describe("disabled", () => {
    it("should be dimmed to 40 percent and ignore a press", async () => {
      const onPress = jest.fn();
      const user = userEvent.setup();
      await renderButton({ disabled: true, onPress });

      const button = screen.getByRole("button", { name: "Continue with Google" });
      await user.press(button);

      expect(button).toBeDisabled();
      // NativeWind hands the opacity over as a 32 bit float.
      expect(button).toHaveStyle({ opacity: Math.fround(0.4) });
      expect(onPress).not.toHaveBeenCalled();
    });

    it("should be at full strength when it is not disabled", async () => {
      await renderButton();

      expect(screen.getByRole("button", { name: "Continue with Google" })).not.toHaveStyle({
        opacity: Math.fround(0.4),
      });
    });
  });
});
