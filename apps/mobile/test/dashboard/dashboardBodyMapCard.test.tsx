import { BODY_ARTWORK, isMuscleId } from "@keylow/core/training";
import { bodyMapPalette } from "@keylow/tokens";
import { render, screen, userEvent, within } from "@testing-library/react-native";

import { DashboardBodyMapCard } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { ThemeProvider } from "../../lib/theme";
import { goldenThursdayBodyMap, noHistoryBodyMap } from "../support/bodyMapFixtures";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { DashboardBodyMapCardProps } from "../../components/DashboardScreen/DashboardBodyMapCard";
import type { MuscleId } from "@keylow/core/training";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// The words inside the card sit under its one name, which a screen reader reads on its own. So they are
// hidden from it, and the tests ask for hidden elements to read what they say.
const hidden = { includeHiddenElements: true };

const openBodyMap = jest.fn<undefined, []>();

function renderCard(
  props: Omit<DashboardBodyMapCardProps, "onOpen">,
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <DashboardBodyMapCard {...props} onOpen={openBodyMap} />
    </ThemeProvider>,
  );
}

const goldenName =
  "Body map, Actual heat now. Warmest: lats 25 percent, mid traps 18 percent, biceps 15 percent. Today: Legs, 16 sets planned. Open the body map";

// A host node's props are loosely typed, so a prop is read with a descriptor.
function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

// A style can be one object or a list of them, and a later one wins.
function styleProperty(style: unknown, name: string): unknown {
  if (Array.isArray(style)) {
    return style.map((part) => styleProperty(part, name)).findLast((value) => value !== undefined);
  }
  return typeof style === "object" && style !== null ? propOf(style, name) : undefined;
}

// How react-native-svg holds a colour once it has read it: an opaque ARGB number.
function paint(hex: string) {
  return { type: 0, payload: 0xff000000 + parseInt(hex.slice(1), 16) };
}

// The muscle's own drawing, found by its path on the side it is drawn on, because the drawing has no role.
function fillOf(muscle: MuscleId, side: "front" | "back") {
  const path = Object.entries(BODY_ARTWORK.male[side].muscles).find(
    ([id]) => isMuscleId(id) && id === muscle,
  )?.[1];
  const [node] =
    screen.root?.queryAll(
      (candidate) => candidate.type === "RNSVGPath" && propOf(candidate.props, "d") === path,
    ) ?? [];
  if (node === undefined) {
    throw new Error("The muscle is not drawn");
  }
  return propOf(node.props, "fill");
}

describe("DashboardBodyMapCard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    openBodyMap.mockReset();
  });

  describe("the golden week at Thursday 17:55", () => {
    it("should be named by the warmest three muscles and today's planned day, ending with the words that open the body map", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.getByLabelText(goldenName)).toBeOnTheScreen();
    });

    it("should write the warmest line from the muscles' names and their heat", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(
        screen.getByText("Warmest: lats 25 %, mid traps 18 %, biceps 15 %", hidden),
      ).toBeOnTheScreen();
    });

    it("should write today's line from the planned day", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.getByText("Today: Legs", hidden)).toBeOnTheScreen();
    });

    it("should head the card with Training and the view it shows, Actual now", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.getByText("Training", hidden)).toBeOnTheScreen();
      expect(screen.getByText("Actual · now", hidden)).toBeOnTheScreen();
    });

    it("should draw the front and the back as two images, each with its label", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(
        screen.getByRole("img", { name: "Body map, Actual, heat, front", ...hidden }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("img", { name: "Body map, Actual, heat, back", ...hidden }),
      ).toBeOnTheScreen();
    });

    it("should draw each figure 100 points wide and 220 tall, the height of the drawing at that width", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      const sized = screen.root?.queryAll(
        (node) =>
          typeof node.type === "string" &&
          styleProperty(node.props.style, "width") === 100 &&
          styleProperty(node.props.style, "height") === 220,
      );
      expect(sized).toHaveLength(2);
    });

    it("should fill the muscles with the heat steps now", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });
      const { heat } = bodyMapPalette("dark");

      expect(fillOf("lats", "back")).toEqual(paint(heat[2]));
      expect(fillOf("biceps", "front")).toEqual(paint(heat[1]));
      expect(fillOf("neck", "front")).toEqual(paint(heat[0]));
    });

    it("should draw the heat legend from Peak down to Rested", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.getByText("Peak", hidden)).toBeOnTheScreen();
      expect(screen.getByText("Rested", hidden)).toBeOnTheScreen();
    });
  });

  describe("a rest day", () => {
    it("should say Rest day, in the line and in the name", async () => {
      await renderCard({
        bodyMap: { ...goldenThursdayBodyMap, today: { kind: "rest", dayName: null } },
      });

      expect(screen.getByText("Today: Rest day", hidden)).toBeOnTheScreen();
      expect(
        screen.getByLabelText(
          "Body map, Actual heat now. Warmest: lats 25 percent, mid traps 18 percent, biceps 15 percent. Today: Rest day. Open the body map",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("a day with no plan to state", () => {
    it("should draw no Today line, and the name stops at the warmest muscles", async () => {
      await renderCard({
        bodyMap: { ...goldenThursdayBodyMap, today: { kind: "none", dayName: null } },
      });

      expect(screen.queryByText(/^Today/, hidden)).not.toBeOnTheScreen();
      expect(
        screen.getByLabelText(
          "Body map, Actual heat now. Warmest: lats 25 percent, mid traps 18 percent, biceps 15 percent. Open the body map",
        ),
      ).toBeOnTheScreen();
    });
  });

  describe("with no training history", () => {
    it("should draw the figures at rest", async () => {
      await renderCard({ bodyMap: noHistoryBodyMap });
      const { heat } = bodyMapPalette("dark");

      expect(fillOf("lats", "back")).toEqual(paint(heat[0]));
      expect(fillOf("biceps", "front")).toEqual(paint(heat[0]));
    });

    it("should say that nothing is logged, in the line and in the name", async () => {
      await renderCard({ bodyMap: noHistoryBodyMap });

      expect(screen.getByText("Nothing logged in the last 14 days", hidden)).toBeOnTheScreen();
      expect(screen.queryByText(/^Warmest/, hidden)).not.toBeOnTheScreen();
      expect(
        screen.getByLabelText(
          "Body map, Actual heat now. Nothing logged in the last 14 days. Open the body map",
        ),
      ).toBeOnTheScreen();
    });

    it("should offer no Start button, because there is nothing to start yet", async () => {
      await renderCard({ bodyMap: noHistoryBodyMap });

      expect(screen.queryByText(/start/i, hidden)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /start/i, ...hidden })).not.toBeOnTheScreen();
    });
  });

  describe("as one link to the body map", () => {
    it("should be one button, named by what it shows and Open the body map", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.getByRole("button", { name: goldenName })).toBeOnTheScreen();
      expect(screen.getAllByRole("button", hidden)).toHaveLength(1);
    });

    it("should open the body map when it is pressed anywhere", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });
      const user = userEvent.setup();

      await user.press(screen.getByRole("button", { name: goldenName }));

      expect(openBodyMap).toHaveBeenCalledTimes(1);
    });

    it("should label the link Body map, with a chevron after it, 44 points tall to touch", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      const label = screen.getByText("Body map", hidden);

      expect(label.parent).toHaveStyle({
        minHeight: 44,
        flexDirection: "row",
        alignItems: "center",
      });
    });

    it("should have no toggle and no long-press on the dashboard", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.queryAllByRole("switch", hidden)).toHaveLength(0);
      expect(screen.queryAllByRole("radio", hidden)).toHaveLength(0);
      expect(screen.queryByText(/show projected|show actual/i, hidden)).not.toBeOnTheScreen();
      expect(
        screen.root?.queryAll(
          (node) =>
            typeof node.type === "string" && propOf(node.props, "onLongPress") !== undefined,
        ),
      ).toEqual([]);
    });

    it("should have no 22 stops for a screen reader: the figures are images, not buttons", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.getByRole("img", { name: /, front$/, ...hidden })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: /, back$/, ...hidden })).toBeOnTheScreen();
      expect(screen.getAllByRole("button", hidden)).toHaveLength(1);
    });
  });

  describe("laid out as the board draws it", () => {
    it("should pad the card 12 points above, below and to the right, and 16 to the left", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      expect(screen.getByLabelText(goldenName)).toHaveStyle({
        paddingTop: 12,
        paddingBottom: 12,
        paddingLeft: 16,
        paddingRight: 12,
      });
    });

    it("should draw the legend as six 10 by 14 swatches from the peak colour down to the rested one", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      const legend = screen.getByRole("img", { name: "Heat legend", ...hidden });
      const swatches =
        screen.root?.queryAll(
          (node) =>
            typeof node.type === "string" &&
            styleProperty(node.props.style, "width") === 10 &&
            styleProperty(node.props.style, "height") === 14,
        ) ?? [];
      expect(
        swatches.map((swatch) => styleProperty(swatch.props.style, "backgroundColor")),
      ).toEqual(
        (["heat-5", "heat-4", "heat-3", "heat-2", "heat-1", "heat-0"] as const).map((step) =>
          resolvedColor("dark", step),
        ),
      );
      expectTextsInOrder(within(legend).getAllByText(/./, hidden), ["Peak", "Rested"]);
      // Only the peak glows, in the heat glow colour: 6 points of blur, with no offset.
      expect(swatches[0]).toHaveStyle({
        shadowColor: "rgba(240,72,72,0.55)",
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 0 },
        elevation: 6,
      });
      for (const swatch of swatches.slice(1)) {
        expect(styleProperty(swatch.props.style, "shadowRadius")).toBeUndefined();
      }
    });

    it("should draw the dot of the view in the primary text colour, 8 points across", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      const [dot] = screen.getByText("Actual · now", hidden).parent?.children ?? [];
      expect(dot).toHaveStyle({
        width: 8,
        height: 8,
        backgroundColor: resolvedColor("dark", "text-primary"),
      });
    });

    it("should rule a hairline between the figures and the two lines", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap });

      const line = screen.getByText(/^Warmest/, hidden).parent;
      expect(line).toHaveStyle({
        borderTopWidth: 1,
        paddingTop: 8,
        justifyContent: "space-between",
      });
    });
  });

  describe("in the light theme", () => {
    it("should fill the muscles from the light palette", async () => {
      await renderCard({ bodyMap: goldenThursdayBodyMap }, "light");
      const { heat } = bodyMapPalette("light");

      expect(fillOf("lats", "back")).toEqual(paint(heat[2]));
    });
  });
});
