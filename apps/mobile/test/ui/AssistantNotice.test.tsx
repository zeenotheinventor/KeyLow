import { themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantNotice } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { AssistantNoticeProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const schemes: ThemeScheme[] = ["dark", "light"];

async function renderNotice(
  props: Partial<AssistantNoticeProps> = {},
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <AssistantNotice
        icon="Clock"
        title="You have used today's turns"
        paragraphs={["The assistant is back at midnight."]}
        {...props}
      />
    </ThemeProvider>,
  );
}

// The notice's box and its icon tile have no role of their own, because the words and the actions are
// inside them. The tones are read from them by these ids, which exist for this and nothing else.
const box = () => screen.getByTestId("assistant-notice-box");
const tile = () => screen.getByTestId("assistant-notice-tile");

// The icon is decoration, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

describe("AssistantNotice", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the words", () => {
    it("should draw the title and every paragraph exactly as given, in order", async () => {
      await renderNotice({
        title: "Turn on the assistant",
        paragraphs: [
          "The assistant answers questions about your diary, weight and targets.",
          "Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.",
        ],
      });

      expect(screen.getByText("Turn on the assistant")).toBeOnTheScreen();
      expect(
        screen.getByText("The assistant answers questions about your diary, weight and targets."),
      ).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.",
        ),
      ).toBeOnTheScreen();
    });

    it("should draw the small print as given, and none when there is none", async () => {
      await renderNotice({ smallPrint: "You can turn the assistant off in More, Assistant." });

      expect(
        screen.getByText("You can turn the assistant off in More, Assistant."),
      ).toBeOnTheScreen();
    });

    it("should draw no link and no buttons when none are given", async () => {
      await renderNotice();

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should hide the icon from a screen reader", async () => {
      await renderNotice();

      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });
  });

  describe("the announcement", () => {
    it("should announce a failure as an alert", async () => {
      await renderNotice({ tone: "danger" });

      expect(screen.getByRole("alert")).toBeOnTheScreen();
    });

    it.each(["neutral", "accent"] as const)(
      "should announce the %s notice as a status",
      async (tone) => {
        await renderNotice({ tone });

        expect(screen.getByRole("status")).toBeOnTheScreen();
      },
    );

    it("should announce the title and the paragraphs together, and leave the actions outside", async () => {
      await renderNotice({
        tone: "danger",
        title: "That answer did not come through",
        paragraphs: ["Nothing was changed. Check your connection and try again."],
        buttons: [{ label: "Try again", kind: "secondary", onPress: () => undefined }],
      });

      expect(
        screen.getByRole("alert", {
          name: "That answer did not come through Nothing was changed. Check your connection and try again.",
        }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
    });
  });

  describe("the link", () => {
    it("should be a button named by its label, which calls onPress", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderNotice({ link: { label: "Privacy policy", onPress } });

      await user.press(screen.getByRole("button", { name: "Privacy policy" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it.each(schemes)("should be written in accent ink in %s", async (scheme) => {
      await renderNotice({ link: { label: "Privacy policy", onPress: () => undefined } }, scheme);

      expect(screen.getByText("Privacy policy")).toHaveStyle({
        color: resolvedColor(scheme, scheme === "dark" ? "accent" : "text-primary"),
      });
    });
  });

  describe("the buttons", () => {
    it("should be buttons named by their labels, each calling its own onPress", async () => {
      const user = userEvent.setup();
      const onTurnOn = jest.fn();
      const onNotNow = jest.fn();
      await renderNotice({
        buttons: [
          { label: "Turn on", kind: "primary", onPress: onTurnOn },
          { label: "Not now", kind: "ghost", onPress: onNotNow },
        ],
      });

      await user.press(screen.getByRole("button", { name: "Not now" }));

      expect(onNotNow).toHaveBeenCalledTimes(1);
      expect(onTurnOn).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: "Turn on" })).toBeOnTheScreen();
    });

    it("should draw them in the order given", async () => {
      await renderNotice({
        buttons: [
          { label: "Turn on", kind: "primary", onPress: () => undefined },
          { label: "Not now", kind: "ghost", onPress: () => undefined },
        ],
      });

      expectTextsInOrder(screen.getAllByText(/./), [
        "You have used today's turns",
        "The assistant is back at midnight.",
        "Turn on",
        "Not now",
      ]);
    });

    it.each([
      { kind: "primary", fill: "accent" },
      { kind: "secondary", fill: "surface-raised" },
      { kind: "danger", fill: "danger" },
    ] as const)("should draw a $kind button with the $fill fill", async ({ kind, fill }) => {
      await renderNotice({ buttons: [{ label: "Go", kind, onPress: () => undefined }] });

      expect(screen.getByRole("button", { name: "Go" })).toHaveStyle({
        backgroundColor: resolvedColor("dark", fill),
      });
    });

    it("should draw a ghost button with no fill", async () => {
      await renderNotice({
        buttons: [{ label: "Not now", kind: "ghost", onPress: () => undefined }],
      });

      expect(screen.getByRole("button", { name: "Not now" })).toHaveStyle({
        backgroundColor: "#00000000",
      });
    });
  });

  describe("the tones", () => {
    it("should draw a neutral notice with a hairline border and a raised tile in dark", async () => {
      await renderNotice({}, "dark");

      expect(box()).toHaveStyle({ borderColor: resolvedColor("dark", "border") });
      expect(tile()).toHaveStyle({ backgroundColor: resolvedColor("dark", "surface-raised") });
      expect(drawings()[0]).toHaveProp("stroke", themes.dark["text-secondary"]);
    });

    it("should draw a neutral notice with a hairline border and a raised tile in light", async () => {
      await renderNotice({}, "light");

      expect(box()).toHaveStyle({ borderColor: resolvedColor("light", "border") });
      expect(tile()).toHaveStyle({ backgroundColor: resolvedColor("light", "surface-raised") });
      expect(drawings()[0]).toHaveProp("stroke", themes.light["text-secondary"]);
    });

    it("should draw a danger notice with a danger border, tile and icon in dark", async () => {
      await renderNotice({ tone: "danger" }, "dark");

      expect(box()).toHaveStyle({ borderColor: resolvedColor("dark", "danger") });
      expect(tile()).toHaveStyle({ backgroundColor: themes.dark["danger-muted"] });
      expect(drawings()[0]).toHaveProp("stroke", themes.dark.danger);
    });

    it("should draw an accent notice with a hairline border and an accent tile in dark", async () => {
      await renderNotice({ tone: "accent" }, "dark");

      expect(box()).toHaveStyle({ borderColor: resolvedColor("dark", "border") });
      expect(tile()).toHaveStyle({ backgroundColor: themes.dark["accent-muted"] });
      expect(drawings()[0]).toHaveProp("stroke", themes.dark["accent-ink"]);
    });

    it("should draw an accent notice with a hairline border and an accent tile in light", async () => {
      await renderNotice({ tone: "accent" }, "light");

      expect(box()).toHaveStyle({ borderColor: resolvedColor("light", "border") });
      expect(tile()).toHaveStyle({ backgroundColor: themes.light["accent-muted"] });
      expect(drawings()[0]).toHaveProp("stroke", themes.light["accent-ink"]);
    });
  });
});
