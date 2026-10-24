import { motionDuration, themes, touchTarget } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo, Text, View } from "react-native";
import { getAnimatedStyle, setUpTests } from "react-native-reanimated";

import { Banner } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedScale } from "../support/animatedStyle";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
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

    it("should announce a review banner as an alert when the screen asks, as the partial save board draws it", async () => {
      await renderBanner({ variant: "review", announce: true });

      expect(screen.getByRole("alert", { name: reviewName })).toBeOnTheScreen();
      expect(screen.queryByRole("note")).not.toBeOnTheScreen();
    });

    it("should keep a quiet variant quiet whatever the screen asks", async () => {
      await renderBanner({ variant: "info", announce: true });

      expect(screen.getByRole("status", { name: reviewName })).toBeOnTheScreen();
    });

    it("should be an info banner by default", async () => {
      await renderBanner();

      expect(screen.getByRole("status", { name: reviewName })).toBeOnTheScreen();
    });

    it("should read the title alone when it has no body", async () => {
      await renderBanner({ body: undefined });

      expect(screen.getByRole("status", { name: "Needs review" })).toBeOnTheScreen();
    });

    it("should set the title in strong body text", async () => {
      await renderBanner();

      expect(screen.getByText("Needs review")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    // The M3 boards draw the quiet notice's sentence as `t-body c-sec`: regular, 16 over 24, secondary ink.
    it.each(["offline", "info"] as const)(
      "should set the %s body in regular body text, 16 over 24, as the boards draw it",
      async (variant) => {
        await renderBanner({ variant });

        expect(screen.getByText(/Energy and carbohydrate/)).toHaveStyle({
          fontFamily: "Geist-Regular",
          fontSize: 16,
          lineHeight: 24,
        });
      },
    );

    it.each(["offline", "info"] as const)(
      "should set the %s body in the secondary text colour",
      async (variant) => {
        await renderBanner({ variant });

        expect(await screen.findByText(/Energy and carbohydrate/)).toHaveStyle({
          color: resolvedColor("dark", "text-secondary"),
        });
      },
    );

    it.each(["review", "error"] as const)(
      "should keep the %s body in secondary caption text, which no board redraws",
      async (variant) => {
        await renderBanner({ variant });

        expect(screen.getByText(/Energy and carbohydrate/)).toHaveStyle({
          fontFamily: "Geist-Medium",
          fontSize: 12,
          lineHeight: 16,
        });
      },
    );

    it("should keep a title with no body in strong body text, as the design system card draws it", async () => {
      await renderBanner({ title: "Open Food Facts is busy", body: undefined });

      expect(screen.getByText("Open Food Facts is busy")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should set a title with no body in regular body text when it is a sentence, as the sign in error board draws it", async () => {
      await renderBanner({
        title: "Email or password is not right.",
        body: undefined,
        sentence: true,
      });

      expect(screen.getByText("Email or password is not right.")).toHaveStyle({
        fontFamily: "Geist-Regular",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should keep the title strong when it is a sentence but has a body under it", async () => {
      await renderBanner({ sentence: true });

      expect(screen.getByText("Needs review")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
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

    it("should be set in Geist semibold at 14 over 20, as the boards draw it", async () => {
      await renderBanner({
        variant: "review",
        action: { label: "Copy to your foods", onPress: () => undefined },
      });

      expect(screen.getByText("Copy to your foods")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 14,
        lineHeight: 20,
      });
    });

    it.each(["offline", "info"] as const)(
      "should be a %s button named by its label, at least 44 points tall, reaching past the text",
      async (variant) => {
        const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
        const onPress = jest.fn();
        await renderBanner({ variant, action: { label: "Set target", onPress } });

        const button = screen.getByRole("button", { name: "Set target" });
        await user.press(button);

        expect(button).toHaveStyle({ minHeight: touchTarget });
        expect(onPress).toHaveBeenCalledTimes(1);
      },
    );

    // The boards draw the quiet action as `t-bs c-ink` underlined, under the words: body-strong, 16 over 24.
    it.each(["offline", "info"] as const)(
      "should set the %s action in strong body text, 16 over 24, underlined",
      async (variant) => {
        await renderBanner({ variant, action: { label: "Set target", onPress: () => undefined } });

        expect(screen.getByText("Set target")).toHaveStyle({
          fontFamily: "Geist-SemiBold",
          fontSize: 16,
          lineHeight: 24,
          textDecorationLine: "underline",
        });
      },
    );

    it.each(["offline", "info"] as const)(
      "should draw the %s action under the words, after the sentence",
      async (variant) => {
        await renderBanner({ variant, action: { label: "Set target", onPress: () => undefined } });

        expectTextsInOrder(screen.getAllByText(/./), [
          "Needs review",
          "Energy and carbohydrate are not given. Fill them in to save your own copy of this food.",
          "Set target",
        ]);
      },
    );

    it.each(["review", "error"] as const)(
      "should leave the %s action not underlined, which is KEY-148's to change",
      async (variant) => {
        await renderBanner({ variant, action: { label: "Try again", onPress: () => undefined } });

        expect(screen.getByText("Try again")).not.toHaveStyle({ textDecorationLine: "underline" });
      },
    );

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
      const ink = resolvedColor(scheme, "warning-ink");

      expect(await screen.findByText("Needs review")).toHaveStyle({ color: ink });
      expect(screen.getByText("Copy to your foods")).toHaveStyle({ color: ink });
    });

    // The M3 boards draw the quiet action as `t-bs c-ink`: the accent ink, lime in dark and the primary text
    // colour in light, where lime is too faint for text.
    it.each(["offline", "info"] as const)(
      "should set the %s action in the accent ink, as the boards draw it",
      async (variant) => {
        await renderBanner(
          { variant, action: { label: "Set target", onPress: () => undefined } },
          scheme,
        );

        expect(await screen.findByText("Set target")).toHaveStyle({
          color: resolvedColor(scheme, "accent-ink"),
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
    // The M3 boards draw the quiet notice with `padding: var(--space-3)`: 12 on every side.
    it.each(["offline", "info"] as const)(
      "should pad the %s variant 12 on every side inside a 12 point radius, with the icon and words 12 apart",
      async (variant) => {
        await renderBanner({ variant });

        expect(box()).toHaveStyle({ padding: 12, borderRadius: 12, columnGap: 12 });
      },
    );

    it.each(["review", "error"] as const)(
      "should keep the %s variant padded 16 across and 12 down, which no board redraws",
      async (variant) => {
        await renderBanner({ variant });

        expect(box()).toHaveStyle({
          paddingLeft: 16,
          paddingRight: 16,
          paddingTop: 12,
          paddingBottom: 12,
          borderRadius: 12,
          columnGap: 12,
        });
      },
    );

    // The action's 44 point target is 10 points taller than its 24 point line on each side, and 8 wider on each
    // side. Negative margins give that room back, so the words sit where the board draws them: 2 points under
    // the sentence and 12 above the box's edge.
    it.each(["offline", "info"] as const)(
      "should give back the room the %s action's target takes, so the layout does not shift",
      async (variant) => {
        await renderBanner({ variant, action: { label: "Set target", onPress: () => undefined } });

        expect(screen.getByRole("button", { name: "Set target" })).toHaveStyle({
          marginLeft: -8,
          marginRight: -8,
          marginTop: -10,
          marginBottom: -10,
        });
      },
    );

    it("should leave the review action's margins as they were", async () => {
      await renderBanner({
        variant: "review",
        action: { label: "Copy to your foods", onPress: () => undefined },
      });

      const button = screen.getByRole("button", { name: "Copy to your foods" });
      expect(button).toHaveStyle({ marginLeft: -8, marginRight: -8, marginBottom: -10 });
      expect(button).not.toHaveStyle({ marginTop: -10 });
    });
  });

  describe("the children slot", () => {
    it("should draw its children under the words", async () => {
      await renderBanner({
        variant: "review",
        children: <View accessible role="progressbar" aria-label="Progress" />,
      });

      expect(screen.getByRole("progressbar", { name: "Progress" })).toBeOnTheScreen();
    });

    it("should keep the children out of the words' announcement", async () => {
      await renderBanner({
        variant: "review",
        children: <View accessible role="progressbar" aria-label="Progress" />,
      });

      expect(screen.getByRole("progressbar", { name: "Progress" })).toBeOnTheScreen();
      expect(
        within(screen.getByRole("note", { name: reviewName })).queryByRole("progressbar"),
      ).toBeNull();
    });

    it.each([null, false, undefined])(
      "should draw no slot for %s children, so no empty gap is left under the words",
      async (children) => {
        await renderBanner({ variant: "review", children });

        // The words' group is the only thing in the column beside them, so no empty block sits under it.
        expect(screen.getByRole("note", { name: reviewName }).parent?.children).toHaveLength(1);
      },
    );

    it("should draw nothing extra without children", async () => {
      await renderBanner({ variant: "review" });

      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });

    it("should draw its children above the action", async () => {
      await renderBanner({
        variant: "review",
        action: { label: "Copy to your foods", onPress: () => undefined },
        children: <Text>Slot</Text>,
      });

      expectTextsInOrder(screen.getAllByText(/./), [
        "Needs review",
        "Energy and carbohydrate are not given. Fill them in to save your own copy of this food.",
        "Slot",
        "Copy to your foods",
      ]);
    });
  });

  describe("the icon", () => {
    it("should draw the variant's icon by default", async () => {
      await renderBanner({ variant: "review" });

      expect(drawings()).toHaveLength(1);
    });

    it("should draw no icon when the caller turns it off", async () => {
      await renderBanner({ variant: "review", hasIcon: false });

      expect(drawings()).toHaveLength(0);
    });
  });

  describe("the compact size", () => {
    it("should pad 12 on every side with no border, in a 12 point radius", async () => {
      await renderBanner({ variant: "review", size: "compact" });

      expect(box()).toHaveStyle({
        padding: 12,
        borderRadius: 12,
      });
      expect(box()).not.toHaveStyle({ borderWidth: 1 });
    });

    it("should set the title in label-small semibold, 14 over 20", async () => {
      await renderBanner({ variant: "review", size: "compact", body: undefined });

      expect(screen.getByText("Needs review")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 14,
        lineHeight: 20,
      });
    });

    it("should set the title in the primary text colour in dark, not the warning ink", async () => {
      await renderBanner({ variant: "review", size: "compact" }, "dark");

      expect(await screen.findByText("Needs review")).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
      });
    });

    it("should keep the default size's review title in the warning ink", async () => {
      await renderBanner({ variant: "review" }, "dark");

      expect(await screen.findByText("Needs review")).toHaveStyle({
        color: resolvedColor("dark", "warning-ink"),
      });
    });

    it("should keep the body in secondary caption text", async () => {
      await renderBanner({ variant: "review", size: "compact" });

      expect(screen.getByText(/Energy and carbohydrate/)).toHaveStyle({
        fontFamily: "Geist-Medium",
        fontSize: 12,
        lineHeight: 16,
      });
    });

    it("should announce the same way as the default size", async () => {
      await renderBanner({ variant: "review", size: "compact" });

      expect(screen.getByRole("note", { name: reviewName })).toBeOnTheScreen();
    });

    it.each(schemes)("should keep the warning tint in the %s scheme", async (scheme) => {
      await renderBanner({ variant: "review", size: "compact" }, scheme);

      expect(await screen.findByTestId("banner-box")).toHaveStyle({
        backgroundColor: themes[scheme]["warning-muted"],
      });
    });

    it("should leave the default size unchanged when no size is given", async () => {
      await renderBanner({ variant: "review" });

      expect(box()).toHaveStyle({ paddingLeft: 16, borderWidth: 1 });
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
