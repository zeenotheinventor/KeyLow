import { themes, touchTarget } from "@keylow/tokens";
import { render, screen, userEvent, within } from "@testing-library/react-native";
import { impactAsync } from "expo-haptics";
import { setUpTests } from "react-native-reanimated";

import { OptionCard } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { OptionCardProps } from "../../components/ui";
import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const mockImpact = jest.mocked(impactAsync);

const female: OptionCardProps = { title: "Female", checked: false, onPress: () => undefined };

const rate: OptionCardProps = {
  title: "0.5% a week",
  description: "A steady pace.",
  badge: { children: "Suggested", outlined: true },
  value: "0.4 kg",
  valueCaption: "a week",
  checked: true,
  onPress: () => undefined,
};

const loseUnderEighteen: OptionCardProps = {
  title: "Lose weight",
  disabledReason: "Not offered under 18.",
  checked: false,
  onPress: () => undefined,
};

function renderCard(props: OptionCardProps, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <OptionCard {...props} />
    </ThemeProvider>,
  );
}

// What NativeWind hands over for an opacity of 0.4, which is a 32 bit float.
const dimmed = Math.fround(0.4);

const schemes: ThemeScheme[] = ["dark", "light"];

describe("OptionCard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    mockImpact.mockClear();
  });

  describe("what it says", () => {
    it("should be a radio named by its title", async () => {
      await renderCard(female);

      expect(screen.getByRole("radio", { name: "Female" })).toBeOnTheScreen();
    });

    it("should say it is not chosen when it is not", async () => {
      await renderCard(female);

      expect(screen.getByRole("radio", { name: "Female" })).not.toBeChecked();
    });

    it("should say it is chosen when it is", async () => {
      await renderCard({ ...female, checked: true });

      expect(screen.getByRole("radio", { name: "Female" })).toBeChecked();
    });

    it("should read its title, then its badge, then its description, then its value", async () => {
      await renderCard(rate);

      expect(screen.getByRole("radio")).toHaveAccessibleName(
        "0.5% a week, Suggested, A steady pace, 0.4 kg a week",
      );
    });

    it("should read the spoken value in place of the value and its caption when it is given one", async () => {
      await renderCard({ ...rate, valueLabel: "about 0.4 kilograms a week" });

      expect(screen.getByRole("radio")).toHaveAccessibleName(
        "0.5% a week, Suggested, A steady pace, about 0.4 kilograms a week",
      );
    });

    it("should read the title and the description when there is nothing else", async () => {
      await renderCard({
        title: "Prefer not to say",
        description: "Ki-Lo uses the average of the female and male estimates.",
        checked: false,
        onPress: () => undefined,
      });

      expect(screen.getByRole("radio")).toHaveAccessibleName(
        "Prefer not to say, Ki-Lo uses the average of the female and male estimates",
      );
    });

    it("should draw the title, the description, the badge, the value and its caption", async () => {
      await renderCard(rate);

      expect(screen.getByText("0.5% a week")).toBeOnTheScreen();
      expect(screen.getByText("A steady pace.")).toBeOnTheScreen();
      expect(screen.getByText("Suggested")).toBeOnTheScreen();
      expect(screen.getByText("0.4 kg")).toBeOnTheScreen();
      expect(screen.getByText("a week")).toBeOnTheScreen();
    });

    it("should draw only the title when it has nothing else", async () => {
      await renderCard(female);

      expect(screen.getAllByText(/./)).toHaveLength(1);
    });

    it("should wrap a long description over lines and not cut it", async () => {
      await renderCard({ ...rate, description: "A long description that wraps." });

      expect(screen.getByText("A long description that wraps.")).not.toHaveProp("numberOfLines");
    });
  });

  describe("pressing", () => {
    it("should call its handler once when it is pressed", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ ...female, onPress });

      await user.press(screen.getByRole("radio", { name: "Female" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should play the selection haptic when it is chosen", async () => {
      const user = userEvent.setup();
      await renderCard(female);

      await user.press(screen.getByRole("radio", { name: "Female" }));

      expect(mockImpact).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should do nothing when the chosen card is pressed again", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ ...female, checked: true, onPress });

      await user.press(screen.getByRole("radio", { name: "Female" }));

      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });
  });

  describe("as a checkbox, when several answers may be chosen", () => {
    const vTaper: OptionCardProps = {
      title: "V-taper",
      description: "Wider shoulders and back, a narrower waist",
      selection: "multiple",
      checked: false,
      onPress: () => undefined,
    };

    it("should be a checkbox named by its title and description", async () => {
      await renderCard(vTaper);

      expect(screen.getByRole("checkbox")).toHaveAccessibleName(
        "V-taper, Wider shoulders and back, a narrower waist",
      );
      expect(screen.queryByRole("radio")).not.toBeOnTheScreen();
    });

    it("should say whether it is checked", async () => {
      await renderCard(vTaper);
      expect(screen.getByRole("checkbox")).not.toBeChecked();

      await renderCard({ ...vTaper, checked: true });
      expect(screen.getAllByRole("checkbox").at(-1)).toBeChecked();
    });

    it("should stay a radio when it is given the single selection", async () => {
      await renderCard({ ...vTaper, selection: "single" });

      expect(screen.getByRole("radio")).toBeOnTheScreen();
    });

    it("should call its handler when it is pressed", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ ...vTaper, onPress });

      await user.press(screen.getByRole("checkbox"));

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledWith("light");
    });

    it("should call its handler when the checked card is pressed again, so the answer can be cleared", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ ...vTaper, checked: true, onPress });

      await user.press(screen.getByRole("checkbox"));

      expect(onPress).toHaveBeenCalledTimes(1);
      expect(mockImpact).toHaveBeenCalledTimes(1);
    });

    it("should draw a 20 point square mark with a 6 point radius and no round radio", async () => {
      await renderCard(vTaper);

      expect(viewsDrawn({ width: 20, height: 20, borderRadius: 6, borderWidth: 2 })).toHaveLength(
        1,
      );
      expect(viewsDrawn({ width: 20, height: 20, borderRadius: 999 })).toHaveLength(0);
    });

    it("should draw a check in the mark when it is checked and nothing when it is not", async () => {
      await renderCard(vTaper);
      expect(screen.root?.queryAll((node) => node.type === "RNSVGSvgView")).toHaveLength(0);

      await renderCard({ ...vTaper, checked: true });
      expect(screen.root?.queryAll((node) => node.type === "RNSVGSvgView")).toHaveLength(1);
      expect(viewsDrawn({ width: 8, height: 8, borderRadius: 999 })).toHaveLength(0);
    });

    it("should not respond when it is disabled with a reason", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ ...vTaper, disabledReason: "Not offered.", onPress });

      expect(screen.getByRole("checkbox")).toBeDisabled();
      await user.press(screen.getByRole("checkbox"));

      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });

    describe.each(schemes)("in the %s scheme", (scheme) => {
      const colorOf = (name: ColorName) => resolvedColor(scheme, name);

      it("should draw an empty square in the strong border colour when it is not checked", async () => {
        await renderCard(vTaper, scheme);
        await screen.findByRole("checkbox");

        const [square] = viewsDrawn({ width: 20, height: 20, borderRadius: 6 });
        expect(square).toHaveStyle({
          borderColor: colorOf("border-strong"),
          backgroundColor: "#00000000",
        });
      });

      it("should fill the square with the accent and an accent border on the muted fill when it is checked", async () => {
        await renderCard({ ...vTaper, checked: true }, scheme);

        expect(await screen.findByRole("checkbox")).toHaveStyle({
          backgroundColor: themes[scheme]["accent-muted"],
          borderColor: colorOf("accent"),
        });
        const [square] = viewsDrawn({ width: 20, height: 20, borderRadius: 6 });
        expect(square).toHaveStyle({
          borderColor: colorOf("accent"),
          backgroundColor: colorOf("accent"),
        });
      });
    });
  });

  describe("disabled with a reason", () => {
    it("should say it is disabled", async () => {
      await renderCard(loseUnderEighteen);

      expect(screen.getByRole("radio")).toBeDisabled();
    });

    it("should put the reason in its name after the title", async () => {
      await renderCard(loseUnderEighteen);

      expect(screen.getByRole("radio")).toHaveAccessibleName("Lose weight, Not offered under 18");
    });

    it("should draw the reason", async () => {
      await renderCard(loseUnderEighteen);

      expect(screen.getByText("Not offered under 18.")).toBeOnTheScreen();
    });

    it("should not call its handler or play a haptic when it is pressed", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ ...loseUnderEighteen, onPress });

      await user.press(screen.getByRole("radio"));

      expect(onPress).not.toHaveBeenCalled();
      expect(mockImpact).not.toHaveBeenCalled();
    });

    it("should dim the radio and the title to 40 percent and leave the reason at full strength", async () => {
      await renderCard(loseUnderEighteen);

      const dimmedViews = viewsDrawn({ opacity: dimmed });
      expect(dimmedViews).toHaveLength(2);
      const holds = (words: string) =>
        dimmedViews.some((view) => within(view).queryByText(words) !== null);
      expect(holds("Lose weight")).toBe(true);
      expect(holds("Not offered under 18.")).toBe(false);
      expect(screen.getByText("Not offered under 18.")).not.toHaveStyle({ opacity: dimmed });
    });

    it("should dim the description too, when there is one", async () => {
      await renderCard({ ...loseUnderEighteen, description: "Eat a little less than you use." });

      // The radio, the title row and the description.
      expect(viewsDrawn({ opacity: dimmed })).toHaveLength(3);
      expect(screen.getByText("Eat a little less than you use.")).toHaveStyle({ opacity: dimmed });
    });

    it("should draw the Info icon beside the reason, as decoration", async () => {
      await renderCard(loseUnderEighteen);

      const drawings = screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
      // The Info glyph and nothing else: the radio is drawn from views.
      expect(drawings).toHaveLength(1);
      expect(drawings[0]).toHaveProp("width", 14);
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });

    it("should not dim a card that is not disabled", async () => {
      await renderCard(rate);

      expect(viewsDrawn({ opacity: dimmed })).toHaveLength(0);
    });
  });

  describe("its columns", () => {
    it("should let the text column take the width the figure leaves and shrink below its content", async () => {
      await renderCard(rate);

      // The column has no role, so it is found by what it holds.
      const column = screen.getByText("A steady pace.").parent;
      expect(column).toHaveStyle({ flexGrow: 1, flexShrink: 1, minWidth: 0 });
    });

    it("should keep the figure at its own width, so a long description wraps beside it", async () => {
      await renderCard(rate);

      const block = screen.getByText("0.4 kg").parent;
      expect(block).toHaveStyle({ flexShrink: 0, alignItems: "flex-end" });
    });
  });

  describe("its size", () => {
    it("should be at least 56 points high, past the 44 point touch target", async () => {
      await renderCard(female);

      const card = screen.getByRole("radio");
      expect(card).toHaveStyle({ minHeight: 56 });
      expect(56).toBeGreaterThanOrEqual(touchTarget);
    });

    it("should pad 12 points above and below and 16 at the sides, with a medium radius and a hairline", async () => {
      await renderCard(female);

      expect(screen.getByRole("radio")).toHaveStyle({
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 16,
        borderRadius: 12,
        borderWidth: 1,
        flexDirection: "row",
        alignItems: "center",
      });
    });

    it("should draw a 20 point round radio at the start", async () => {
      await renderCard(female);

      expect(viewsDrawn({ width: 20, height: 20, borderRadius: 999, borderWidth: 2 })).toHaveLength(
        1,
      );
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    // NativeWind resolves a solid colour to an rgba string, and a translucent one to the token as written.
    const colorOf = (name: ColorName) => resolvedColor(scheme, name);

    it("should be a surface with a hairline border when it is not chosen", async () => {
      await renderCard(female, scheme);

      expect(await screen.findByRole("radio")).toHaveStyle({
        backgroundColor: colorOf("surface"),
        borderColor: colorOf("border"),
      });
    });

    it("should draw an empty radio ring in the strong border colour when it is not chosen", async () => {
      await renderCard(female, scheme);
      await screen.findByRole("radio");

      const [ring] = viewsDrawn({ width: 20, height: 20, borderRadius: 999 });
      expect(ring).toHaveStyle({
        borderColor: colorOf("border-strong"),
        backgroundColor: "#00000000",
      });
      expect(
        viewsDrawn({ width: 8, height: 8, backgroundColor: colorOf("accent-foreground") }),
      ).toHaveLength(0);
    });

    it("should be an accent border on the muted accent fill when it is chosen", async () => {
      await renderCard({ ...female, checked: true }, scheme);

      expect(await screen.findByRole("radio")).toHaveStyle({
        backgroundColor: themes[scheme]["accent-muted"],
        borderColor: colorOf("accent"),
      });
    });

    it("should draw a second accent line inside the border, so the chosen border reads 2 points", async () => {
      await renderCard({ ...female, checked: true }, scheme);
      await screen.findByRole("radio");

      // The line is a layer with no role, so it is found by its look. It fills the card inside the 1 point
      // border, and its radius is the card's 12 points less that border, 11, so its corners follow the card's.
      expect(
        viewsDrawn({
          position: "absolute",
          inset: 0,
          borderColor: colorOf("accent"),
          borderWidth: 1,
          borderRadius: 11,
        }),
      ).toHaveLength(1);
    });

    it("should draw no second line when it is not chosen", async () => {
      await renderCard(female, scheme);
      await screen.findByRole("radio");

      expect(viewsDrawn({ position: "absolute", borderWidth: 1 })).toHaveLength(0);
    });

    it("should fill the radio with the accent and put an 8 point dot of the accent foreground in it when it is chosen", async () => {
      await renderCard({ ...female, checked: true }, scheme);
      await screen.findByRole("radio");

      const [ring] = viewsDrawn({ width: 20, height: 20, borderRadius: 999 });
      expect(ring).toHaveStyle({
        borderColor: colorOf("accent"),
        backgroundColor: colorOf("accent"),
      });
      expect(
        viewsDrawn({ width: 8, height: 8, backgroundColor: colorOf("accent-foreground") }),
      ).toHaveLength(1);
    });

    it("should set the title in strong body text and the description in secondary caption text", async () => {
      await renderCard(rate, scheme);

      expect(await screen.findByText("0.5% a week")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        color: colorOf("text-primary"),
      });
      expect(screen.getByText("A steady pace.")).toHaveStyle({
        fontSize: 12,
        color: colorOf("text-secondary"),
      });
    });

    it("should set the value in strong body text and its caption in muted text", async () => {
      await renderCard(rate, scheme);

      expect(await screen.findByText("0.4 kg")).toHaveStyle({
        fontFamily: "Geist-SemiBold",
        color: colorOf("text-primary"),
      });
      expect(screen.getByText("a week")).toHaveStyle({ color: colorOf("text-muted") });
    });
  });
});
