import { progressBars } from "@keylow/core/diary";
import { themes } from "@keylow/tokens";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { MacroProgressStrip } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { ColorName, ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const noTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };
const dayTotals = { kcal: 1039, protein_g: 86, carbs_g: 129.1, fat_g: 19 };

const under = progressBars(dayTotals, targets);
const over = progressBars({ ...dayTotals, kcal: 2412, carbs_g: 257 }, targets);
const allOver = progressBars({ kcal: 2412, protein_g: 175, carbs_g: 257, fat_g: 81 }, targets);
const exactlyAt = progressBars({ kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 }, targets);
const withoutTargets = progressBars(dayTotals, noTargets);

// The boards' plate-several: the day plus 658 kcal, P 57, C 79, F 12 on the plate. 1,697 / 2,200, P 143 / 160,
// C 208 / 220, F 31 / 70.
const withPlate = progressBars(dayTotals, targets, {
  kcal: 658,
  protein_g: 57,
  carbs_g: 79,
  fat_g: 12,
});
// The boards' plate-over: calories 2,280 / 2,200 and carbs 310 / 220 are over; protein 155 / 160 and fat 45 / 70 are under.
const withOverPlate = progressBars(dayTotals, targets, {
  kcal: 1241,
  protein_g: 69.1,
  carbs_g: 180.8,
  fat_g: 25.8,
});

const schemes: ThemeScheme[] = ["dark", "light"];

// The ruling's ring, worked out here from the token itself: 55 per cent of each channel plus 45 per
// cent of white, so the expected colour is never copied from the code under test.
function ringColourOf(scheme: ThemeScheme, key: (typeof nutrientKeys)[number]): string {
  const [red, green, blue] = [1, 3, 5].map((start) => {
    const channel = parseInt(themes[scheme][key].slice(start, start + 2), 16);
    return Math.round(channel * 0.55 + 255 * 0.45);
  });
  return `rgb(${red}, ${green}, ${blue})`;
}
const nutrientKeys = ["calories", "protein", "carbs", "fat"] as const;

type Bars = ReturnType<typeof progressBars>;

async function renderStrip(bars: Bars = under, scheme: ThemeScheme = "dark", onPress = jest.fn()) {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <MacroProgressStrip bars={bars} onPress={onPress} />
    </ThemeProvider>,
  );
  return onPress;
}

// The bars, columns and outline layers are decoration inside the one button, and the button's name says
// the same in words, so none has a role or name. They are found by the ids that exist for this.
const hidden = { includeHiddenElements: true };

const fillOf = (key: string) => screen.getByTestId(`${key}-fill`, hidden);

type StripProps = Parameters<typeof MacroProgressStrip>[0];

async function renderPlateStrip(
  bars: Bars,
  props: Omit<StripProps, "bars"> = {},
  scheme: ThemeScheme = "dark",
) {
  await render(
    <ThemeProvider fixedPreference={scheme}>
      <MacroProgressStrip bars={bars} {...props} />
    </ThemeProvider>,
  );
}

// The plate's share at 45 per cent of the token, worked out here from the token itself.
function plateShareColourOf(scheme: ThemeScheme, key: (typeof nutrientKeys)[number]): string {
  const [red, green, blue] = [1, 3, 5].map((start) =>
    parseInt(themes[scheme][key].slice(start, start + 2), 16),
  );
  return `rgba(${red}, ${green}, ${blue}, 0.45)`;
}

const plateFillOf = (key: string) => screen.getByTestId(`${key}-plate-fill`, hidden);

// The channels of a token, as "r, g, b", so a colour is found whether the tree holds it as a hex
// string (an icon's stroke) or as the rgba string NativeWind resolves a class to.
function channelsOf(scheme: ThemeScheme, name: ColorName): string {
  const value = themes[scheme][name];
  return value.startsWith("#")
    ? resolvedColor(scheme, name).replace(/^rgba\(|, 1\)$/g, "")
    : (value.match(/\d+/g) ?? []).slice(0, 3).join(", ");
}

describe("MacroProgressStrip", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("as one button", () => {
    it("should be one button named Targets and the four values", async () => {
      await renderStrip();

      expect(
        screen.getByRole("button", {
          name: "Targets. Calories: 1,039 of 2,200 kilocalories. Protein: 86 of 160 grams. Carbohydrate: 129 of 220 grams. Fat: 19 of 70 grams",
        }),
      ).toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toHaveLength(1);
    });

    it("should call onPress when pressed", async () => {
      const onPress = await renderStrip();

      await fireEvent.press(screen.getByRole("button", { name: /^Targets/ }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should say over target in its name for a bar that is over", async () => {
      await renderStrip(over);

      expect(
        screen.getByRole("button", { name: /Calories: 2,412 of 2,200 kilocalories, over target/ }),
      ).toBeOnTheScreen();
    });

    it("should be at least 44 points high, because the button is the touch target", async () => {
      await renderStrip();

      expect(screen.getByRole("button")).toHaveStyle({ minHeight: 44 });
    });
  });

  describe("what each column says", () => {
    it("should read the calories, then protein, carbs and fat in that order", async () => {
      await renderStrip();

      expectTextsInOrder(screen.getAllByText(/^[PCF]$/), ["P", "C", "F"]);
      expectTextsInOrder(screen.getAllByText(/^(1,039|86|129|19)$/), ["1,039", "86", "129", "19"]);
    });

    it("should read the eaten value against the target on each column", async () => {
      await renderStrip();

      expect(screen.getByText("/ 2,200")).toBeOnTheScreen();
      expect(screen.getByText("/ 160")).toBeOnTheScreen();
      expect(screen.getByText("/ 220")).toBeOnTheScreen();
      expect(screen.getByText("/ 70")).toBeOnTheScreen();
    });

    it("should draw a flame on the calories column and a letter on each macro", async () => {
      await renderStrip();

      expect(screen.getByText("P")).toBeOnTheScreen();
      expect(screen.getByText("C")).toBeOnTheScreen();
      expect(screen.getByText("F")).toBeOnTheScreen();
      expect(screen.queryByText("K")).not.toBeOnTheScreen();
    });

    it("should read the value alone, with its unit, and draw no bar when there is no target", async () => {
      await renderStrip(withoutTargets);

      expect(screen.getByText("1,039")).toBeOnTheScreen();
      expect(screen.getByText("kcal")).toBeOnTheScreen();
      expect(screen.getAllByText("g")).toHaveLength(3);
      expect(screen.queryByText(/\//)).not.toBeOnTheScreen();
      expect(screen.queryByTestId(/-fill$/, hidden)).not.toBeOnTheScreen();
      expect(screen.queryByTestId(/-outline/, hidden)).not.toBeOnTheScreen();
    });

    it("should cap how far large text grows each caption, so a column cannot overflow", async () => {
      await renderStrip();

      for (const text of ["P", "86", "/ 160", "1,039", "/ 2,200"]) {
        expect(screen.getByText(text)).toHaveProp("maxFontSizeMultiplier", 1.2);
      }
    });

    it("should keep every value on one line, so a four-digit calorie value does not wrap", async () => {
      await renderStrip(progressBars({ ...dayTotals, kcal: 1039 }, targets));

      expect(screen.getByText("1,039")).toHaveProp("numberOfLines", 1);
      expect(screen.getByText("/ 2,200")).toHaveProp("numberOfLines", 1);
    });
  });

  describe("how the bars are drawn", () => {
    it("should fill each bar to the share of its target", async () => {
      await renderStrip();

      expect(fillOf("protein")).toHaveStyle({ width: "53.75%" });
    });

    it.each(nutrientKeys)(
      "should fill the %s bar completely and add no outline at its target",
      async (key) => {
        await renderStrip(exactlyAt);

        expect(fillOf(key)).toHaveStyle({ width: "100%" });
        expect(screen.queryByTestId(`${key}-outline`, hidden)).not.toBeOnTheScreen();
      },
    );

    it.each(nutrientKeys)(
      "should fill the %s bar completely and give it an outline when it is over its target",
      async (key) => {
        await renderStrip(allOver);

        expect(fillOf(key)).toHaveStyle({ width: "100%" });
        expect(screen.getByTestId(`${key}-outline`, hidden)).toBeOnTheScreen();
      },
    );

    it("should outline only the bars that are over", async () => {
      await renderStrip(over);

      expect(screen.queryByTestId("protein-outline", hidden)).not.toBeOnTheScreen();
      expect(screen.queryByTestId("fat-outline", hidden)).not.toBeOnTheScreen();
    });

    it("should keep the value in the primary text colour when over target", async () => {
      await renderStrip(over);

      expect(screen.getByText("2,412")).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
      });
    });

    it("should make the calories column one and a half times a macro column", async () => {
      await renderStrip();

      expect(screen.getByTestId("calories-column", hidden)).toHaveStyle({ flexGrow: 1.5 });
      expect(screen.getByTestId("protein-column", hidden)).toHaveStyle({ flexGrow: 1 });
    });
  });

  describe.each(schemes)("its colours in %s", (scheme) => {
    it.each(nutrientKeys)("should fill the %s bar in its own colour", async (key) => {
      await renderStrip(under, scheme);

      expect(fillOf(key)).toHaveStyle({ backgroundColor: resolvedColor(scheme, key) });
    });

    it.each(nutrientKeys)(
      "should draw the %s ring as its colour mixed with 45 per cent white, outside a one point gap in the background colour",
      async (key) => {
        await renderStrip(allOver, scheme);

        expect(screen.getByTestId(`${key}-outline-colour`, hidden)).toHaveStyle({
          backgroundColor: ringColourOf(scheme, key),
          inset: -2.5,
        });
        expect(screen.getByTestId(`${key}-outline-gap`, hidden)).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "background"),
          inset: -1,
        });
      },
    );

    it.each([
      ["under target", under],
      ["at target", exactlyAt],
      ["over target", over],
      ["with no target", withoutTargets],
    ])("should never use a warning or danger colour anywhere in the strip %s", async (_, bars) => {
      const { toJSON } = await render(
        <ThemeProvider fixedPreference={scheme}>
          <MacroProgressStrip bars={bars} onPress={jest.fn()} />
        </ThemeProvider>,
      );
      const drawn = JSON.stringify(toJSON());

      // The ink tokens are left out: in light they are the primary text colour, which the values are.
      for (const name of ["warning", "warning-muted", "danger", "danger-muted"] as const) {
        expect(drawn).not.toContain(channelsOf(scheme, name));
        expect(drawn.toLowerCase()).not.toContain(themes[scheme][name].toLowerCase());
      }
      expect(drawn).not.toMatch(/warning|danger/);
    });
  });

  describe("with the plate", () => {
    describe("as a status group, with no onPress", () => {
      const statusName =
        "Today with your plate. Calories: 1,697 of 2,200 kilocalories, 658 on your plate. Protein: 143 of 160 grams, 57 on your plate. Carbohydrate: 208 of 220 grams, 79 on your plate. Fat: 31 of 70 grams, 12 on your plate";

      it("should be a group named by the label and the four values, and no button", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate" });

        expect(screen.getByRole("group", { name: statusName })).toBeOnTheScreen();
        expect(screen.queryAllByRole("button")).toHaveLength(0);
      });

      it("should be named Today when the plate is empty", async () => {
        await renderPlateStrip(under, { label: "Today" });

        expect(
          screen.getByRole("group", {
            name: "Today. Calories: 1,039 of 2,200 kilocalories. Protein: 86 of 160 grams. Carbohydrate: 129 of 220 grams. Fat: 19 of 70 grams",
          }),
        ).toBeOnTheScreen();
      });

      it("should still be named Targets, as a group, with no label and no onPress", async () => {
        await renderPlateStrip(under);

        expect(screen.getByRole("group", { name: /^Targets\. Calories/ })).toBeOnTheScreen();
      });
    });

    describe("as the diary's button", () => {
      it("should keep the Targets button and open Targets when pressed", async () => {
        const onPress = jest.fn();
        await renderPlateStrip(under, { onPress });

        await fireEvent.press(screen.getByRole("button", { name: /^Targets\./ }));

        expect(onPress).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("group")).not.toBeOnTheScreen();
      });

      it("should take the label it is given as its name", async () => {
        await renderPlateStrip(under, { onPress: jest.fn(), label: "Today" });

        expect(screen.getByRole("button", { name: /^Today\. Calories/ })).toBeOnTheScreen();
      });
    });

    describe("what each column says", () => {
      it("should read eaten plus the plate as the value, against the target", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate" });

        expectTextsInOrder(screen.getAllByText(/^(1,697|143|208|31)$/), [
          "1,697",
          "143",
          "208",
          "31",
        ]);
        expect(screen.getByText("/ 2,200")).toBeOnTheScreen();
        expect(screen.queryByText("1,039")).not.toBeOnTheScreen();
      });

      it("should read the value in primary text, with no warning colour, when it passes the target", async () => {
        await renderPlateStrip(withOverPlate, { label: "Today with your plate" });

        expect(screen.getByText("2,280")).toHaveStyle({
          color: resolvedColor("dark", "text-primary"),
        });
        expect(screen.getByText("310")).toHaveStyle({
          color: resolvedColor("dark", "text-primary"),
        });
      });
    });

    describe("the plate's share of the bar", () => {
      it("should draw no plate share without a plate", async () => {
        await renderPlateStrip(under, { label: "Today" });

        expect(screen.queryByTestId(/-plate-fill$/, hidden)).not.toBeOnTheScreen();
      });

      it("should draw a plate share on each bar that has one", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate" });

        for (const key of nutrientKeys) {
          expect(plateFillOf(key)).toBeOnTheScreen();
        }
      });

      it("should give the share the part of the track after the eaten fill", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate" });

        expect(fillOf("protein")).toHaveStyle({ width: "53.75%" });
        // The plate's share is the total's share less the eaten share: 143 / 160 less 86 / 160.
        expect(plateFillOf("protein")).toHaveStyle({ width: `${(143 / 160 - 86 / 160) * 100}%` });
      });

      it("should draw the share after the eaten fill, on the same track", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate" });

        const track = plateFillOf("protein").parent;
        expect(track?.children.indexOf(plateFillOf("protein"))).toBe(
          (track?.children.indexOf(fillOf("protein")) ?? -2) + 1,
        );
      });

      it("should draw no share on a bar the eaten amount already fills", async () => {
        await renderPlateStrip(
          progressBars({ ...dayTotals, kcal: 2412 }, targets, {
            kcal: 300,
            protein_g: 0,
            carbs_g: 0,
            fat_g: 0,
          }),
          { label: "Today with your plate" },
        );

        expect(fillOf("calories")).toHaveStyle({ width: "100%" });
        expect(screen.queryByTestId("calories-plate-fill", hidden)).not.toBeOnTheScreen();
      });
    });

    describe("the outline over target", () => {
      it("should outline the calories and carbs bars of plate-over and no others", async () => {
        await renderPlateStrip(withOverPlate, { label: "Today with your plate" });

        expect(screen.getByTestId("calories-outline", hidden)).toBeOnTheScreen();
        expect(screen.getByTestId("carbs-outline", hidden)).toBeOnTheScreen();
        expect(screen.queryByTestId("protein-outline", hidden)).not.toBeOnTheScreen();
        expect(screen.queryByTestId("fat-outline", hidden)).not.toBeOnTheScreen();
      });

      it("should outline a bar that is over only because of the plate", async () => {
        await renderPlateStrip(withOverPlate, { label: "Today with your plate" });

        expect(fillOf("carbs")).not.toHaveStyle({ width: "100%" });
        expect(screen.getByTestId("carbs-outline", hidden)).toBeOnTheScreen();
      });

      it("should name the bars over target in the group's name", async () => {
        await renderPlateStrip(withOverPlate, { label: "Today with your plate" });

        expect(
          screen.getByRole("group", {
            name: /Calories: 2,280 of 2,200 kilocalories, 1,241 on your plate, over target\. .*Carbohydrate: 310 of 220 grams, 181 on your plate, over target\./,
          }),
        ).toBeOnTheScreen();
      });

      it("should not outline plate-several", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate" });

        expect(screen.queryByTestId(/-outline$/, hidden)).not.toBeOnTheScreen();
      });
    });

    describe("the card form", () => {
      it("should have no padding of its own", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate", surface: "card" });

        expect(screen.getByRole("group")).not.toHaveStyle({ paddingLeft: 16 });
        expect(screen.getByRole("group")).not.toHaveStyle({ paddingBottom: 12 });
      });

      it("should keep the page form's padding otherwise", async () => {
        await renderPlateStrip(withPlate, { label: "Today with your plate" });

        expect(screen.getByRole("group")).toHaveStyle({ paddingLeft: 16, paddingBottom: 12 });
      });

      it.each(schemes)(
        "should leave the outline's one point gap in the surface colour in %s",
        async (scheme) => {
          await renderPlateStrip(
            withOverPlate,
            { label: "Today with your plate", surface: "card" },
            scheme,
          );

          expect(screen.getByTestId("calories-outline-gap", hidden)).toHaveStyle({
            backgroundColor: resolvedColor(scheme, "surface"),
            inset: -1,
          });
        },
      );

      it.each(schemes)(
        "should leave the outline's one point gap in the background colour on the page in %s",
        async (scheme) => {
          await renderPlateStrip(withOverPlate, { label: "Today with your plate" }, scheme);

          expect(screen.getByTestId("calories-outline-gap", hidden)).toHaveStyle({
            backgroundColor: resolvedColor(scheme, "background"),
          });
        },
      );

      it("should be the Targets button again when given onPress", async () => {
        await renderPlateStrip(withPlate, { surface: "card", onPress: jest.fn() });

        expect(screen.getByRole("button")).toBeOnTheScreen();
      });
    });

    describe.each(schemes)("its colours in %s", (scheme) => {
      it.each(nutrientKeys)(
        "should draw the %s share in its own colour at 45 per cent",
        async (key) => {
          await renderPlateStrip(withPlate, { label: "Today with your plate" }, scheme);

          expect(plateFillOf(key)).toHaveStyle({
            backgroundColor: plateShareColourOf(scheme, key),
          });
        },
      );

      it.each([
        ["page", "page"],
        ["card", "card"],
      ] as const)(
        "should never use a warning or danger colour in the %s form over target",
        async (_, surface) => {
          const { toJSON } = await render(
            <ThemeProvider fixedPreference={scheme}>
              <MacroProgressStrip
                bars={withOverPlate}
                label="Today with your plate"
                surface={surface}
              />
            </ThemeProvider>,
          );
          const drawn = JSON.stringify(toJSON());

          for (const name of ["warning", "warning-muted", "danger", "danger-muted"] as const) {
            expect(drawn).not.toContain(channelsOf(scheme, name));
            expect(drawn.toLowerCase()).not.toContain(themes[scheme][name].toLowerCase());
          }
          expect(drawn).not.toMatch(/warning|danger/);
        },
      );
    });
  });
});
