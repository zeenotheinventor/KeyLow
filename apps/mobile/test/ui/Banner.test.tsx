import { motionDuration, themes, touchTarget } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { Banner } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { BannerProps, BannerVariant } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

function renderBanner(props: Partial<BannerProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Banner
        body="Energy and carbohydrate are not given. Fill them in to save your own copy of this food."
        title="Needs review"
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

// The banner's box and the fade on its wrapper have no role of their own, because the roles are on the
// words inside. They are found by these ids, which exist for this and nothing else.
const box = () => screen.getByTestId("banner-box");
const fadingBanner = () => screen.getByTestId("banner-fade");

// The icon is decoration, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const reviewName =
  "Needs review Energy and carbohydrate are not given. Fill them in to save your own copy of this food.";

// Each variant is announced the way its board draws it: an alert for a failure, a status for a notice that
// is not one, and a note for the review.
const announcements: { variant: BannerVariant; role: "alert" | "status" | "note" }[] = [
  { variant: "review", role: "note" },
  { variant: "offline", role: "status" },
  { variant: "info", role: "status" },
  { variant: "error", role: "alert" },
];

const schemes: ThemeScheme[] = ["dark", "light"];

describe("Banner", () => {
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
    it.each(announcements)(
      "should announce the $variant variant as a $role, reading the title then the body",
      async ({ variant, role }) => {
        await renderBanner({ variant });

        expect(screen.getByRole(role, { name: reviewName })).toBeOnTheScreen();
      },
    );

    it("should be an info banner by default", async () => {
      await renderBanner();

      expect(screen.getByRole("status", { name: reviewName })).toBeOnTheScreen();
    });

    it("should read the title alone when it has no body", async () => {
      await renderBanner({ body: undefined });

      expect(screen.getByRole("status", { name: "Needs review" })).toBeOnTheScreen();
    });

    it("should set the title in strong body text and the body in secondary caption text", async () => {
      await renderBanner();

      expect(screen.getByText("Needs review")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        lineHeight: 24,
      });
      expect(screen.getByText(/Energy and carbohydrate/)).toHaveStyle({
        fontFamily: "Geist-Medium",
        fontSize: 12,
        lineHeight: 16,
      });
    });

    // React Native's alert role does not announce on mount on Android, so a failure is a live region too.
    it("should make the error variant an assertive live region, so a failure is announced as it appears", async () => {
      await renderBanner({ variant: "error" });

      expect(screen.getByRole("alert", { name: reviewName })).toHaveProp("aria-live", "assertive");
    });

    it.each(["review", "offline", "info"] as const)(
      "should not make the %s variant a live region, because it is not a failure",
      async (variant) => {
        await renderBanner({ variant });

        expect(
          screen.getByRole(variant === "review" ? "note" : "status", { name: reviewName }),
        ).not.toHaveProp("aria-live");
      },
    );

    it("should draw one icon, which is decoration", async () => {
      await renderBanner({ variant: "error", icon: "CloudOff" });

      expect(drawings()).toHaveLength(1);
    });
  });

  describe("the action", () => {
    it("should be a button named by its label, which calls onPress", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderBanner({ variant: "review", action: { label: "Copy to your foods", onPress } });

      await user.press(screen.getByRole("button", { name: "Copy to your foods" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should draw no button without an action", async () => {
      await renderBanner();

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should stay reachable on its own, outside the words' announcement", async () => {
      await renderBanner({
        variant: "review",
        action: { label: "Copy to your foods", onPress: () => undefined },
      });

      expect(screen.getByRole("note", { name: reviewName })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Copy to your foods" })).toBeOnTheScreen();
    });

    it("should be at least the 44 point touch target tall, reaching past the text", async () => {
      await renderBanner({
        variant: "review",
        action: { label: "Copy to your foods", onPress: () => undefined },
      });

      expect(screen.getByRole("button", { name: "Copy to your foods" })).toHaveStyle({
        minHeight: touchTarget,
      });
    });

    it("should compress when pressed, like every pressable", async () => {
      await renderBanner({
        variant: "review",
        action: { label: "Copy to your foods", onPress: () => undefined },
      });

      await fireEvent(screen.getByRole("button", { name: "Copy to your foods" }), "pressIn");
      await advance(1000);

      expect(animatedScale(screen.getByTestId("press-scale"))).toBeCloseTo(0.96, 3);
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    it("should draw the review variant on the warning tint, with a warning border and icon", async () => {
      await renderBanner({ variant: "review" }, scheme);

      expect(await screen.findByTestId("banner-box")).toHaveStyle({
        backgroundColor: themes[scheme]["warning-muted"],
        borderColor: resolvedColor(scheme, "warning"),
        borderWidth: 1,
      });
      expect(drawings()[0]).toHaveProp("stroke", themes[scheme].warning);
    });

    it("should draw the error variant on the danger tint, with a danger border and icon", async () => {
      await renderBanner({ variant: "error" }, scheme);

      expect(await screen.findByTestId("banner-box")).toHaveStyle({
        backgroundColor: themes[scheme]["danger-muted"],
        borderColor: resolvedColor(scheme, "danger"),
        borderWidth: 1,
      });
      expect(drawings()[0]).toHaveProp("stroke", themes[scheme].danger);
    });

    it.each(["offline", "info"] as const)(
      "should draw the %s variant quietly: the raised surface, a hairline border, a secondary icon",
      async (variant) => {
        await renderBanner({ variant }, scheme);

        expect(await screen.findByTestId("banner-box")).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "surface-raised"),
          borderColor: resolvedColor(scheme, "border"),
          borderWidth: 1,
        });
        expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-secondary"]);
      },
    );

    // Warning is too faint for text in light (Q14), so the title and the action are `--warning-ink`:
    // warning in dark and the primary text colour in light.
    it("should set the review title and action in the warning ink", async () => {
      await renderBanner(
        {
          variant: "review",
          action: { label: "Copy to your foods", onPress: () => undefined },
        },
        scheme,
      );
      const ink = scheme === "dark" ? themes.dark.warning : themes.light["text-primary"];

      expect(await screen.findByText("Needs review")).toHaveStyle({ color: ink });
      expect(screen.getByText("Copy to your foods")).toHaveStyle({ color: ink });
    });

    // No board draws an action on info or offline, so the design system card decides: secondary text.
    it.each(["offline", "info"] as const)(
      "should set the %s action in the secondary text colour, as the design system card does",
      async (variant) => {
        await renderBanner(
          { variant, action: { label: "Dismiss", onPress: () => undefined } },
          scheme,
        );

        expect(await screen.findByText("Dismiss")).toHaveStyle({
          color: resolvedColor(scheme, "text-secondary"),
        });
      },
    );

    it("should set the error action in the primary text colour, because a status colour is not text", async () => {
      await renderBanner(
        { variant: "error", action: { label: "Try again", onPress: () => undefined } },
        scheme,
      );

      expect(await screen.findByText("Try again")).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
      });
    });

    it.each(["offline", "info", "error"] as const)(
      "should set the %s title in the primary text colour, because a status colour is not text",
      async (variant) => {
        await renderBanner({ variant }, scheme);

        expect(await screen.findByText("Needs review")).toHaveStyle({
          color: resolvedColor(scheme, "text-primary"),
        });
      },
    );
  });

  describe("layout", () => {
    it("should pad 16 across and 12 down inside a 12 point radius, with the icon and words 12 apart", async () => {
      await renderBanner();

      expect(box()).toHaveStyle({
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 12,
        paddingBottom: 12,
        borderRadius: 12,
        columnGap: 12,
      });
    });
  });

  describe("motion", () => {
    it("should fade in over the quick duration, in place of the design's cut-in", async () => {
      await renderBanner();
      expect(getAnimatedStyle(fadingBanner()).opacity).toBe(0);

      await advance(motionDuration.quick + 50);

      expect(getAnimatedStyle(fadingBanner()).opacity).toBe(1);
    });

    it("should fade in without moving when the user has reduced motion on", async () => {
      setReduceMotion(true);
      await renderBanner();
      await advance(motionDuration.quick + 50);

      const style = getAnimatedStyle(fadingBanner());
      expect(style.opacity).toBe(1);
      expect(style).not.toHaveProperty("transform");
    });
  });
});
