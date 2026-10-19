import { iconSize, motionDuration, themes } from "@keylow/tokens";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { ErrorState } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

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

  describe("its size", () => {
    it("should fill the height of its parent by default", async () => {
      await renderErrorState();

      expect(fadingView().parent).toHaveStyle({ flexGrow: 1 });
    });

    it("should take only the height of its words as a section", async () => {
      await renderErrorState({ size: "section" });

      expect(fadingView().parent).not.toHaveStyle({ flexGrow: 1 });
    });
  });

  describe("as a card, as the training boards draw their error states", () => {
    it("should sit in a card with 20 points above, 20 at the sides and 16 below, like the empty card", async () => {
      await renderErrorState({ variant: "card" });

      expect(screen.getByRole("alert").parent).toHaveStyle({
        alignItems: "center",
        rowGap: 8,
        paddingTop: 20,
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 16,
      });
    });

    it("should be drawn on the surface with the card's border", async () => {
      await renderErrorState({ variant: "card" });

      expect(fadingView().children[0]).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface"),
        borderWidth: 1,
      });
    });

    it("should take only the height of its words, not the height of its parent", async () => {
      await renderErrorState({ variant: "card" });

      expect(viewsDrawn({ flex: 1, justifyContent: "center" })).toHaveLength(0);
    });

    it("should keep the alert, the danger tile and the retry, with the retry 8 points below the words", async () => {
      const onPress = jest.fn();
      await renderErrorState({
        variant: "card",
        retry: { label: "Try again", onPress },
      });

      expect(screen.getByRole("alert")).toBeOnTheScreen();
      expect(tile()).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" }).parent?.parent).toHaveStyle({
        marginTop: 8,
      });
    });

    it("should leave the default view as it was: filling the parent, in no card, 24 points at the sides", async () => {
      await renderErrorState();

      expect(fadingView().parent).toHaveStyle({ flexGrow: 1, justifyContent: "center" });
      expect(fadingView().children[0]).not.toHaveStyle({ borderWidth: 1 });
      expect(viewsDrawn({ alignItems: "center", paddingLeft: 24, paddingRight: 24 })).toHaveLength(
        1,
      );
    });
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

  describe("the action", () => {
    it("should be a button named by its label, which calls onPress", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderErrorState({ action: { label: "Back to sign in", onPress } });

      await user.press(screen.getByRole("button", { name: "Back to sign in" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should be a secondary button with no icon, because it is not a retry", async () => {
      await renderErrorState({ action: { label: "Back to sign in", onPress: () => undefined } });

      expect(screen.getByRole("button", { name: "Back to sign in" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface-raised"),
        borderColor: resolvedColor("dark", "border"),
      });
      // Only the tile's icon.
      expect(drawings()).toHaveLength(1);
    });

    it("should take the variant it is given", async () => {
      await renderErrorState({
        action: { label: "Back to sign in", onPress: () => undefined, variant: "primary" },
      });

      expect(screen.getByRole("button", { name: "Back to sign in" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "accent"),
      });
    });

    it("should stay reachable on its own, outside the alert's reading", async () => {
      await renderErrorState({ action: { label: "Back to sign in", onPress: () => undefined } });

      expect(
        screen.getByRole("alert", {
          name: "Your foods could not be searched Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
    });

    it("should give way to the retry when both are given, so the view has one button", async () => {
      await renderErrorState({
        action: { label: "Back to sign in", onPress: () => undefined },
        retry: { label: "Try again", onPress: () => undefined },
      });

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });
  });

  describe("the inset", () => {
    it("should be 24 points at the sides by default", async () => {
      await renderErrorState();

      expect(viewsDrawn({ alignItems: "center", paddingLeft: 24, paddingRight: 24 })).toHaveLength(
        1,
      );
    });

    it("should be 32 points at the sides when wide, as the link error board draws it", async () => {
      await renderErrorState({ inset: "wide" });

      expect(viewsDrawn({ alignItems: "center", paddingLeft: 32, paddingRight: 32 })).toHaveLength(
        1,
      );
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
