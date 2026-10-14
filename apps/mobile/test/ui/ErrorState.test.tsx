import { iconSize, motionDuration, themes } from "@keylow/tokens";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { ErrorState } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { ErrorStateProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

function renderErrorState(props: Partial<ErrorStateProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <ErrorState
        body="Check your connection and try again."
        title="Your foods could not be searched"
        {...props}
      />
    </ThemeProvider>,
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

// The icon tile is decoration, so it has no role to query by, and the view's fade is on a wrapper with no
// meaning of its own. Both are found by ids, which exist for this and nothing else.
const tile = () => screen.getByTestId("error-state-tile");
const fadingView = () => screen.getByTestId("error-state");

// The icon in the tile is decoration too, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("ErrorState", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("what it says", () => {
    it("should be an alert that reads the title and the sentence it is given", async () => {
      await renderErrorState();

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
    });

    // React Native's alert role does not announce on mount on Android, so the alert is a live region too.
    it("should be an assertive live region, so the failure is announced as it appears", async () => {
      await renderErrorState();

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched Check your connection and try again.",
        }),
      ).toHaveProp("aria-live", "assertive");
    });

    it("should set the title in the h2 style and the body in secondary body text", async () => {
      await renderErrorState();

      expect(screen.getByText("Your foods could not be searched")).toHaveStyle({
        fontSize: 20,
        lineHeight: 26,
        textAlign: "center",
      });
      expect(screen.getByText("Check your connection and try again.")).toHaveStyle({
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
      });
    });

    it("should draw no body when it has none", async () => {
      await renderErrorState({ body: undefined });

      expect(
        screen.getByRole("alert", { name: "Your foods could not be searched" }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Check your connection and try again.")).not.toBeOnTheScreen();
    });
  });

  describe("the retry", () => {
    it("should be a button named by its label, which calls onPress", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderErrorState({ retry: { label: "Try again", onPress } });

      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should draw no button without a retry, because some failures retry themselves", async () => {
      await renderErrorState();

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should be a secondary button with the retry icon", async () => {
      await renderErrorState({ retry: { label: "Try again", onPress: () => undefined } });

      expect(screen.getByRole("button", { name: "Try again" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface-raised"),
        borderColor: resolvedColor("dark", "border"),
      });
      // The tile's icon and the button's.
      expect(drawings()).toHaveLength(2);
    });

    it("should stay reachable on its own, outside the alert's reading", async () => {
      await renderErrorState({ retry: { label: "Try again", onPress: () => undefined } });

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });
  });

  describe("the icon tile", () => {
    it("should be a 56 point square with the medium radius, and hold a 32 point icon", async () => {
      await renderErrorState();

      expect(tile()).toHaveStyle({ width: 56, height: 56, borderRadius: 12 });
      expect(drawings()[0]).toHaveProp("width", iconSize.xl);
    });

    it.each(schemes)(
      "should be a danger tint with a danger icon in the %s scheme",
      async (scheme) => {
        await renderErrorState({}, scheme);

        expect(tile()).toHaveStyle({ backgroundColor: themes[scheme]["danger-muted"] });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme].danger);
      },
    );
  });

  describe("motion", () => {
    it("should fade in over the quick duration, in place of the design's cut-in", async () => {
      await renderErrorState();
      expect(getAnimatedStyle(fadingView()).opacity).toBe(0);

      await advance(motionDuration.quick + 50);

      expect(getAnimatedStyle(fadingView()).opacity).toBe(1);
    });

    it("should fade in without moving when the user has reduced motion on", async () => {
      setReduceMotion(true);
      await renderErrorState();
      await advance(motionDuration.quick + 50);

      const style = getAnimatedStyle(fadingView());
      expect(style.opacity).toBe(1);
      expect(style).not.toHaveProperty("transform");
    });
  });
});
