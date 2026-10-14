import { iconSize, motionDuration, themes } from "@keylow/tokens";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { EmptyState } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { EmptyStateProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

function renderEmptyState(props: Partial<EmptyStateProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <EmptyState
        body="Try other words, or create the food yourself."
        icon="SearchX"
        title="No foods found"
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
const tile = () => screen.getByTestId("empty-state-tile");
const fadingView = () => screen.getByTestId("empty-state");

// The icon in the tile is decoration too, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const schemes: ThemeScheme[] = ["dark", "light"];

describe("EmptyState", () => {
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
    it("should head the view with its title", async () => {
      await renderEmptyState();

      expect(screen.getByRole("heading", { name: "No foods found" })).toBeOnTheScreen();
    });

    it("should say the sentence it is given under the title", async () => {
      await renderEmptyState();

      expect(screen.getByText("Try other words, or create the food yourself.")).toBeOnTheScreen();
    });

    it("should draw no body when it has none", async () => {
      await renderEmptyState({ body: undefined });

      expect(screen.getByRole("heading", { name: "No foods found" })).toBeOnTheScreen();
      expect(
        screen.queryByText("Try other words, or create the food yourself."),
      ).not.toBeOnTheScreen();
    });

    it("should set the title in the h2 style and the body in secondary body text", async () => {
      await renderEmptyState();

      expect(screen.getByRole("heading", { name: "No foods found" })).toHaveStyle({
        fontSize: 20,
        lineHeight: 26,
        textAlign: "center",
      });
      expect(screen.getByText("Try other words, or create the food yourself.")).toHaveStyle({
        fontSize: 16,
        lineHeight: 24,
        textAlign: "center",
      });
    });
  });

  describe("the action", () => {
    it("should be a button named by its label, which calls onPress", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderEmptyState({ action: { label: "Create a food", onPress } });

      await user.press(screen.getByRole("button", { name: "Create a food" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should draw no button without an action", async () => {
      await renderEmptyState();

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should be a secondary button, so it does not compete with the screen's own main action", async () => {
      await renderEmptyState({ action: { label: "Create a food", onPress: () => undefined } });

      expect(screen.getByRole("button", { name: "Create a food" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", "surface-raised"),
        borderColor: resolvedColor("dark", "border"),
      });
    });

    it("should lead with the icon it is given", async () => {
      await renderEmptyState({
        action: { label: "Create a food", icon: "Plus", onPress: () => undefined },
      });

      // The tile's icon and the button's.
      expect(drawings()).toHaveLength(2);
    });

    it("should lead with no icon unless it is given one", async () => {
      await renderEmptyState({ action: { label: "Create a food", onPress: () => undefined } });

      expect(drawings()).toHaveLength(1);
    });
  });

  describe("the icon tile", () => {
    it("should be a 56 point square with the medium radius, and hold a 32 point icon", async () => {
      await renderEmptyState();

      expect(tile()).toHaveStyle({ width: 56, height: 56, borderRadius: 12 });
      expect(drawings()[0]).toHaveProp("width", iconSize.xl);
    });

    it.each(schemes)(
      "should be the raised surface with a muted icon in the %s scheme",
      async (scheme) => {
        await renderEmptyState({}, scheme);

        expect(tile()).toHaveStyle({ backgroundColor: resolvedColor(scheme, "surface-raised") });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-muted"]);
      },
    );
  });

  describe("motion", () => {
    it("should fade in over the quick duration, in place of the design's cut-in", async () => {
      await renderEmptyState();
      expect(getAnimatedStyle(fadingView()).opacity).toBe(0);

      await advance(motionDuration.quick + 50);

      expect(getAnimatedStyle(fadingView()).opacity).toBe(1);
    });

    it("should fade in without moving when the user has reduced motion on", async () => {
      setReduceMotion(true);
      await renderEmptyState();
      await advance(motionDuration.quick + 50);

      const style = getAnimatedStyle(fadingView());
      expect(style.opacity).toBe(1);
      expect(style).not.toHaveProperty("transform");
    });
  });
});
