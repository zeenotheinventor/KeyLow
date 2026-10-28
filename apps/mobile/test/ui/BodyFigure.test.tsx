import { MUSCLE_NAMES } from "@keylow/core/copy";
import {
  BODY_ARTWORK,
  BODY_GLOW_FILTER,
  GAP_VALUES,
  isMuscleId,
  MUSCLE_IDS,
  ROLE_FIGURE_VALUES,
  VOLUME_STATUSES,
} from "@keylow/core/training";
import { bodyMapPalette, themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";
import { Pressable } from "react-native";

import { BodyFigure } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

import type { BodyFigureProps } from "../../components/ui";
import type { BodyArtworkFigure, BodyArtworkSide, MuscleId } from "@keylow/core/training";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const label = "Body map, front";

const defaultProps: BodyFigureProps = {
  side: "front",
  scale: "heat",
  values: {},
  label,
  w: 120,
};

function renderFigure(props: Partial<BodyFigureProps> = {}, scheme: ThemeScheme = "dark") {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <BodyFigure {...defaultProps} {...props} />
    </ThemeProvider>,
  );
}

const schemes: ThemeScheme[] = ["dark", "light"];
const bodies: BodyArtworkFigure[] = ["male", "female"];
const sides: BodyArtworkSide[] = ["front", "back"];

// How react-native-svg holds a colour once it has read it: an opaque ARGB number.
function paint(hex: string) {
  return { type: 0, payload: 0xff000000 + parseInt(hex.slice(1), 16) };
}

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

function drawn(type: string) {
  return screen.root?.queryAll((node) => node.type === type) ?? [];
}

function musclesOf(body: BodyArtworkFigure, side: BodyArtworkSide): [MuscleId, string][] {
  return Object.entries(BODY_ARTWORK[body][side].muscles).flatMap(([id, path]) =>
    isMuscleId(id) ? [[id, path]] : [],
  );
}

// The muscle's own drawing, found by its path, because the drawing has no role to query by.
function drawingOf(muscle: MuscleId, body: BodyArtworkFigure = "male") {
  const path = [...musclesOf(body, "front"), ...musclesOf(body, "back")].find(
    ([id]) => id === muscle,
  )?.[1];
  const [node] = drawn("RNSVGPath").filter((candidate) => propOf(candidate.props, "d") === path);
  if (node === undefined) {
    throw new Error("The muscle is not drawn");
  }
  return node;
}

// The step or status of each muscle of a side, so that every one of the scale's values appears.
function everyValue(side: BodyArtworkSide, valueCount: number): Partial<Record<MuscleId, number>> {
  return Object.fromEntries(musclesOf("male", side).map(([id], index) => [id, index % valueCount]));
}

describe("BodyFigure", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("as an image", () => {
    it("should be one image with its label", async () => {
      await renderFigure();

      expect(screen.getByRole("img", { name: label })).toBeOnTheScreen();
    });

    it("should have no buttons when it is given no handler", async () => {
      await renderFigure();

      expect(screen.queryAllByRole("button")).toHaveLength(0);
    });
  });

  describe.each(schemes)("in the %s theme", (scheme) => {
    const palette = bodyMapPalette(scheme);

    it("should draw the head and the outline in the silhouette colour", async () => {
      await renderFigure({}, scheme);

      const silhouettes = drawn("RNSVGPath").filter(
        (node) =>
          propOf(node.props, "d") === BODY_ARTWORK.male.front.head ||
          propOf(node.props, "d") === BODY_ARTWORK.male.front.outline,
      );
      expect(silhouettes).toHaveLength(2);
      silhouettes.forEach((node) => {
        expect(propOf(node.props, "fill")).toEqual(paint(palette.silhouette));
      });
    });

    it.each(sides)("should fill every heat step of the %s with its heat colour", async (side) => {
      await renderFigure({ side, scale: "heat", values: everyValue(side, 6) }, scheme);

      musclesOf("male", side).forEach(([id], index) => {
        expect(propOf(drawingOf(id).props, "fill")).toEqual(paint(palette.heat[index % 6] ?? ""));
      });
    });

    it.each(sides)("should fill every volume status of the %s with its colour", async (side) => {
      const fills = [
        palette.volume.notTrained,
        palette.volume.maintaining,
        palette.volume.growing,
        palette.volume.productive,
        palette.volume.high,
      ];
      expect(fills).toHaveLength(VOLUME_STATUSES.length);

      await renderFigure({ side, scale: "volume", values: everyValue(side, 5) }, scheme);

      musclesOf("male", side).forEach(([id], index) => {
        expect(propOf(drawingOf(id).props, "fill")).toEqual(paint(fills[index % 5] ?? ""));
      });
    });

    it.each(sides)("should fill every gap value of the %s with its colour", async (side) => {
      const fills = [
        palette.gap.behind,
        palette.gap.onPlan,
        palette.gap.ahead,
        palette.gap.notInPlan,
      ];
      expect(fills).toHaveLength(GAP_VALUES.length);

      await renderFigure({ side, scale: "gap", values: everyValue(side, 4) }, scheme);

      musclesOf("male", side).forEach(([id], index) => {
        expect(propOf(drawingOf(id).props, "fill")).toEqual(paint(fills[index % 4] ?? ""));
      });
    });

    it.each([
      { scale: "heat" as const, rest: palette.heat[0] },
      { scale: "volume" as const, rest: palette.volume.notTrained },
      { scale: "gap" as const, rest: palette.gap.notInPlan },
    ])("should draw a missing muscle at rest on the $scale scale", async ({ scale, rest }) => {
      await renderFigure({ scale, values: {} }, scheme);

      musclesOf("male", "front").forEach(([id]) => {
        expect(propOf(drawingOf(id).props, "fill")).toEqual(paint(rest));
      });
    });

    it("should outline the selected muscle in the primary text colour and every other in the separator colour", async () => {
      await renderFigure({ selected: "chest_upper" }, scheme);

      musclesOf("male", "front").forEach(([id]) => {
        const node = drawingOf(id);
        const isSelected = id === "chest_upper";
        expect(propOf(node.props, "stroke")).toEqual(
          paint(isSelected ? themes[scheme]["text-primary"] : palette.separator),
        );
        expect(propOf(node.props, "strokeWidth")).toBe(isSelected ? 2.6 : 1.4);
      });
    });
  });

  describe("the muscles that are not selected", () => {
    it("should draw every muscle but the selected one at the opacity asked for, and the selected one in full", async () => {
      await renderFigure({ selected: "chest_upper", unselectedOpacity: 0.4 });

      musclesOf("male", "front").forEach(([id]) => {
        expect(propOf(drawingOf(id).props, "opacity")).toBe(id === "chest_upper" ? 1 : 0.4);
      });
    });

    it("should leave every muscle in full when there is no selected muscle", async () => {
      await renderFigure({ unselectedOpacity: 0.4 });

      musclesOf("male", "front").forEach(([id]) => {
        expect(propOf(drawingOf(id).props, "opacity")).toBe(1);
      });
    });

    it("should leave every muscle in full when no opacity is asked for", async () => {
      await renderFigure({ selected: "chest_upper" });

      musclesOf("male", "front").forEach(([id]) => {
        expect(propOf(drawingOf(id).props, "opacity")).toBe(1);
      });
    });
  });

  describe("the muscles", () => {
    it.each(bodies)(
      "should draw the %s figure's muscles in the order of the artwork",
      async (body) => {
        await renderFigure({ body });

        const muscles = musclesOf(body, "front").map(([, path]) => path);
        const order = drawn("RNSVGPath")
          .map((node) => propOf(node.props, "d"))
          .filter((path) => muscles.includes(String(path)));
        expect(order).toEqual(muscles);
      },
    );

    it("should draw the female figure's own artwork", async () => {
      await renderFigure({ body: "female" });

      expect(drawingOf("quads", "female")).toBeDefined();
    });

    it("should default to the male figure", async () => {
      await renderFigure();

      expect(drawingOf("quads", "male")).toBeDefined();
    });

    it.each(bodies)(
      "should show all 22 muscles across the two sides of the %s figure, each on one side",
      async (body) => {
        const named = new Map<MuscleId, BodyArtworkSide[]>();
        for (const side of sides) {
          const { unmount } = await renderFigure({ body, side, onPressMuscle: jest.fn() });
          for (const id of MUSCLE_IDS) {
            if (screen.queryByRole("button", { name: `${MUSCLE_NAMES[id]}, Rested` }) !== null) {
              named.set(id, [...(named.get(id) ?? []), side]);
            }
          }
          await unmount();
        }

        expect(named.size).toBe(22);
        expect([...named.values()].every((shown) => shown.length === 1)).toBe(true);
      },
    );
  });

  describe("the glow", () => {
    it("should glow only the muscles at heat step 5", async () => {
      await renderFigure({ values: { quads: 5, abs: 4, biceps: 5 } });

      const glowing = musclesOf("male", "front")
        .filter(([id]) => propOf(drawingOf(id).props, "filter") !== undefined)
        .map(([id]) => id);
      expect(glowing).toEqual(["biceps", "quads"]);
    });

    it("should not glow a top status on the volume scale", async () => {
      await renderFigure({
        scale: "volume",
        values: everyValue("front", 5),
      });

      musclesOf("male", "front").forEach(([id]) => {
        expect(propOf(drawingOf(id).props, "filter")).toBeUndefined();
      });
    });

    it("should point every glowing muscle at a filter the figure defines", async () => {
      await renderFigure({ values: { quads: 5 } });

      const filterIds = drawn("RNSVGFilter").map((node) => propOf(node.props, "name"));
      expect(filterIds).toHaveLength(1);
      expect(filterIds).toContain(propOf(drawingOf("quads").props, "filter"));
    });

    it("should define the glow as the artwork's filter: its region, a blur, and the blur twice under the muscle", async () => {
      await renderFigure({ values: { quads: 5 } });

      const [filter] = drawn("RNSVGFilter");
      const [blur] = drawn("RNSVGFeGaussianBlur");
      const [merge] = drawn("RNSVGFeMerge");
      expect(filter?.props).toMatchObject({
        x: BODY_GLOW_FILTER.x,
        y: BODY_GLOW_FILTER.y,
        width: BODY_GLOW_FILTER.width,
        height: BODY_GLOW_FILTER.height,
      });
      expect(blur?.props).toMatchObject({
        in1: "SourceGraphic",
        result: "blur",
        stdDeviationX: BODY_GLOW_FILTER.standardDeviation,
        stdDeviationY: BODY_GLOW_FILTER.standardDeviation,
      });
      expect(propOf(merge?.props ?? {}, "nodes")).toEqual(
        BODY_GLOW_FILTER.mergeLayers.map((layer) => (layer === "blur" ? "blur" : "SourceGraphic")),
      );
    });

    it("should give two figures on one screen a filter each", async () => {
      await render(
        <ThemeProvider fixedPreference="dark">
          <BodyFigure {...defaultProps} label="Actual" values={{ quads: 5 }} />
          <BodyFigure {...defaultProps} label="Projected" values={{ quads: 5 }} />
        </ThemeProvider>,
      );

      const filterIds = drawn("RNSVGFilter").map((node) => propOf(node.props, "name"));
      expect(filterIds).toHaveLength(2);
      expect(new Set(filterIds).size).toBe(2);
    });
  });

  describe("dimmed", () => {
    it("should draw the figure at full strength by default", async () => {
      await renderFigure();

      expect(drawn("RNSVGGroup").map((node) => propOf(node.props, "opacity"))).toContain(1);
    });

    it("should fade the whole figure to the opacity it is given", async () => {
      await renderFigure({ dim: 0.3 });

      expect(drawn("RNSVGGroup").map((node) => propOf(node.props, "opacity"))).toContain(0.3);
    });
  });

  describe("pressing a muscle", () => {
    it("should be a button for each muscle of the side, named by the muscle and its value", async () => {
      await renderFigure({ values: { quads: 3 }, onPressMuscle: jest.fn() });

      expect(screen.getByRole("button", { name: "Quads, Hot" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Neck, Rested" })).toBeOnTheScreen();
      expect(screen.getAllByRole("button")).toHaveLength(12);
    });

    it("should name a muscle by the value of the scale", async () => {
      await renderFigure({
        scale: "volume",
        values: { quads: VOLUME_STATUSES.indexOf("high") },
        onPressMuscle: jest.fn(),
      });

      expect(screen.getByRole("button", { name: "Quads, High" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Abs, Not trained" })).toBeOnTheScreen();
    });

    it("should name a muscle by its role on the role scale", async () => {
      await renderFigure({
        scale: "role",
        values: { quads: ROLE_FIGURE_VALUES.primary },
        onPressMuscle: jest.fn(),
      });

      expect(screen.getByRole("button", { name: "Quads, Primary" })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Abs, Not worked" })).toBeOnTheScreen();
    });

    it("should name a muscle with no value as at rest", async () => {
      await renderFigure({ scale: "gap", onPressMuscle: jest.fn() });

      expect(screen.getByRole("button", { name: "Quads, Not in plan" })).toBeOnTheScreen();
    });

    it.each(MUSCLE_IDS)("should press %s with its own id", async (muscle) => {
      const onPressMuscle = jest.fn();
      const user = userEvent.setup();
      const side = musclesOf("male", "front").some(([id]) => id === muscle) ? "front" : "back";
      await renderFigure({ side, onPressMuscle });

      await user.press(screen.getByRole("button", { name: `${MUSCLE_NAMES[muscle]}, Rested` }));

      expect(onPressMuscle.mock.calls).toEqual([[muscle]]);
    });

    it.each(MUSCLE_IDS)("should long press %s with its own id", async (muscle) => {
      const onLongPressMuscle = jest.fn();
      const user = userEvent.setup();
      const side = musclesOf("male", "front").some(([id]) => id === muscle) ? "front" : "back";
      await renderFigure({ side, onLongPressMuscle });

      await user.longPress(screen.getByRole("button", { name: `${MUSCLE_NAMES[muscle]}, Rested` }));

      expect(onLongPressMuscle.mock.calls).toEqual([[muscle]]);
    });

    it("should not call the long press handler for a press", async () => {
      const onLongPressMuscle = jest.fn();
      const user = userEvent.setup();
      await renderFigure({ onPressMuscle: jest.fn(), onLongPressMuscle });

      await user.press(screen.getByRole("button", { name: "Quads, Rested" }));

      expect(onLongPressMuscle).not.toHaveBeenCalled();
    });

    it("should have buttons when it has only a long press handler", async () => {
      await renderFigure({ onLongPressMuscle: jest.fn() });

      expect(screen.getAllByRole("button")).toHaveLength(12);
    });

    it("should hand a press on the empty figure to the press around it", async () => {
      const onToggle = jest.fn();
      const onPressMuscle = jest.fn();
      const user = userEvent.setup();
      await render(
        <ThemeProvider fixedPreference="dark">
          <Pressable aria-label="Switch side" onPress={onToggle}>
            <BodyFigure {...defaultProps} onPressMuscle={onPressMuscle} />
          </Pressable>
        </ThemeProvider>,
      );

      await user.press(screen.getByRole("img", { name: label }));

      expect(onToggle).toHaveBeenCalledTimes(1);
      expect(onPressMuscle).not.toHaveBeenCalled();
    });
  });

  describe("the size", () => {
    it("should be as wide as it is given and as tall as the drawing is for that width", async () => {
      await renderFigure({ w: 90 });

      const sized = screen.root?.queryAll(
        (node) =>
          typeof node.type === "string" &&
          styleProperty(node.props.style, "width") === 90 &&
          styleProperty(node.props.style, "height") === 198,
      );
      expect(sized).toHaveLength(1);
    });
  });

  describe("the touch targets", () => {
    function sizeOf(name: string) {
      const style: unknown = screen.getByRole("button", { name }).props.style;
      return { width: styleProperty(style, "width"), height: styleProperty(style, "height") };
    }

    it.each(["Neck, Rested", "Forearms, Rested", "Shins, Rested"])(
      "should make the %s button at least 44 points each way",
      async (name) => {
        await renderFigure({ w: 120, onPressMuscle: jest.fn() });

        const { width, height } = sizeOf(name);
        expect(Number(width)).toBeGreaterThanOrEqual(44);
        expect(Number(height)).toBeGreaterThanOrEqual(44);
      },
    );

    it("should leave a muscle that is not thin at the size it is drawn", async () => {
      await renderFigure({ w: 120, onPressMuscle: jest.fn() });

      expect(Number(sizeOf("Quads, Rested").width)).toBeLessThan(44);
    });
  });
});
