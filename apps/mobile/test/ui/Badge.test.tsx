import { themes } from "@keylow/tokens";
import { render, screen } from "@testing-library/react-native";
import { Dimensions, Platform, StyleSheet } from "react-native";

import { Badge } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { BadgeProps, BadgeTone } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

function renderBadge(props: BadgeProps, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <Badge {...props} />
    </ThemeProvider>,
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];

// What NativeWind resolves a transparent class to.
const transparent = "#00000000";

// Each status tone and the colour its dot is drawn in. The muted fill is the tone's own `-muted`
// colour, except neutral, which is the sheet surface.
const coloredTones: Exclude<BadgeTone, "neutral">[] = [
  "accent",
  "success",
  "warning",
  "danger",
  "protein",
  "carbs",
  "fat",
  "calories",
];

describe("Badge", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("a source badge", () => {
    it.each([
      { source: "off", name: "Open Food Facts" },
      { source: "cofid", name: "UK CoFID" },
      { source: "user", name: "Yours" },
    ] as const)("should name the $source source $name", async ({ source, name }) => {
      await renderBadge({ kind: "source", source });

      expect(screen.getByText(name)).toBeOnTheScreen();
    });

    it("should keep to one line however large the text is", async () => {
      await renderBadge({ kind: "source", source: "off" });

      const name = screen.getByText("Open Food Facts");
      expect(name).toHaveProp("numberOfLines", 1);
      expect(name).toHaveProp("maxFontSizeMultiplier", 1.3);
    });
  });

  // Android multiplies a line height by the whole font scale even where it caps the font size, so the line
  // is given divided by the scale, and iOS caps both itself. The 20 point pill holds the capped 16.
  describe("the line height at large text", () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    it.each([
      { os: "ios", fontScale: 1, lineHeight: 16 },
      { os: "ios", fontScale: 2, lineHeight: 16 },
      { os: "android", fontScale: 1, lineHeight: 16 },
      { os: "android", fontScale: 1.3, lineHeight: 16 },
      { os: "android", fontScale: 2, lineHeight: 10.4 },
    ] as const)(
      "should give the text a $lineHeight point line height on $os at font scale $fontScale",
      async ({ os, fontScale, lineHeight }) => {
        jest.replaceProperty(Platform, "OS", os);
        jest
          .spyOn(Dimensions, "get")
          .mockReturnValue({ width: 411, height: 914, scale: 2.625, fontScale });
        await renderBadge({ kind: "source", source: "cofid" });

        const text = await screen.findByText("UK CoFID");
        const style: unknown = StyleSheet.flatten(text.props.style);
        const drawn: unknown =
          typeof style === "object" && style !== null
            ? Object.getOwnPropertyDescriptor(style, "lineHeight")?.value
            : undefined;
        expect(drawn).toBeCloseTo(lineHeight, 5);
      },
    );
  });

  describe("a status badge", () => {
    it("should be a status by default and show its text", async () => {
      await renderBadge({ children: "Default" });

      expect(screen.getByText("Default")).toBeOnTheScreen();
    });

    it("should draw a dot before the text only when it is asked to", async () => {
      await renderBadge({ children: "Needs review", tone: "warning" });
      expect(viewsDrawn({ width: 6, height: 6 })).toHaveLength(0);

      await screen.unmount();
      await renderBadge({ children: "Needs review", tone: "warning", dot: true });
      expect(viewsDrawn({ width: 6, height: 6 })).toHaveLength(1);
    });

    it("should hide its dot from a screen reader, because the text carries the meaning", async () => {
      await renderBadge({ children: "Needs review", tone: "warning", dot: true });

      const [dot] = viewsDrawn({ width: 6, height: 6 });
      expect(dot).toHaveProp("aria-hidden", true);
    });
  });

  describe.each(schemes)("in the %s scheme", (scheme) => {
    const colorOf = (name: Parameters<typeof resolvedColor>[1]) => resolvedColor(scheme, name);

    it("should be a 20 point pill padded 8 across, with its text in the caption style", async () => {
      await renderBadge({ kind: "source", source: "cofid" }, scheme);
      await screen.findByText("UK CoFID");

      const [pill] = viewsDrawn({ height: 20, borderRadius: 999 });
      expect(pill).toHaveStyle({
        flexDirection: "row",
        alignItems: "center",
        paddingLeft: 8,
        paddingRight: 8,
        columnGap: 5,
      });
      expect(screen.getByText("UK CoFID")).toHaveStyle({
        fontFamily: "Geist-Medium",
        fontSize: 12,
        lineHeight: 16,
      });
    });

    it("should draw a source badge on the sheet surface with a hairline border, in secondary text", async () => {
      await renderBadge({ kind: "source", source: "cofid" }, scheme);
      await screen.findByText("UK CoFID");

      expect(
        viewsDrawn({
          height: 20,
          backgroundColor: colorOf("surface-sheet"),
          borderColor: colorOf("border"),
          borderWidth: 1,
        }),
      ).toHaveLength(1);
      expect(screen.getByText("UK CoFID")).toHaveStyle({ color: colorOf("text-secondary") });
    });

    it("should draw a neutral status the same way, with no visible border", async () => {
      await renderBadge({ children: "Default" }, scheme);
      await screen.findByText("Default");

      expect(
        viewsDrawn({
          height: 20,
          backgroundColor: colorOf("surface-sheet"),
          borderColor: transparent,
          borderWidth: 1,
        }),
      ).toHaveLength(1);
      expect(screen.getByText("Default")).toHaveStyle({ color: colorOf("text-secondary") });
    });

    it("should draw a hairline border on a neutral status when it is asked to be outlined", async () => {
      await renderBadge({ children: "86 %", outlined: true }, scheme);
      await screen.findByText("86 %");

      expect(
        viewsDrawn({
          height: 20,
          backgroundColor: colorOf("surface-sheet"),
          borderColor: colorOf("border"),
          borderWidth: 1,
        }),
      ).toHaveLength(1);
      expect(screen.getByText("86 %")).toHaveStyle({ color: colorOf("text-secondary") });
    });

    it.each(coloredTones)("should draw the %s status on its muted fill", async (tone) => {
      await renderBadge({ children: "Status", tone }, scheme);
      await screen.findByText("Status");

      expect(
        viewsDrawn({ height: 20, backgroundColor: themes[scheme][`${tone}-muted`] }),
      ).toHaveLength(1);
    });

    it.each(coloredTones)(
      scheme === "dark"
        ? "should set the %s status text in the tone's colour"
        : "should set the %s status text in the primary text colour, because a status colour is not text in light",
      async (tone) => {
        await renderBadge({ children: "Status", tone }, scheme);

        expect(await screen.findByText("Status")).toHaveStyle({
          color: colorOf(scheme === "dark" ? tone : "text-primary"),
        });
      },
    );

    it.each(coloredTones)(
      "should draw the %s dot in the tone's colour in both schemes",
      async (tone) => {
        await renderBadge({ children: "Status", tone, dot: true }, scheme);
        await screen.findByText("Status");

        expect(
          viewsDrawn({ width: 6, height: 6, backgroundColor: colorOf(tone), borderRadius: 999 }),
        ).toHaveLength(1);
      },
    );
  });
});
