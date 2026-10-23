import { HEAT_STEP_NAMES } from "@keylow/core/copy";
import { bodyMapPalette } from "@keylow/tokens";
import { cleanup, render, screen, within } from "@testing-library/react-native";

import { MusclesTrainedCard } from "../components/MusclesTrainedCard";
import { ThemeProvider } from "../lib/theme";
import { fillsIn, heatFill } from "./support/figureFills";
import { compileKitStyles } from "./support/kitStyles";
import { expectAccessibleNamesInOrder } from "./support/namesInOrder";
import { registerAppStyles } from "./support/nativeWindStyles";
import { goldenLegsHeatSets, snapshotOf } from "./support/sessionGoldenLegs";
import { resolvedColor } from "./support/themeColor";

import type { MusclesTrainedCardProps } from "../components/MusclesTrainedCard";
import type { MuscleId } from "@keylow/core/training";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// The end of the golden Legs session: Thursday 15 October, 19:00 in London.
const LEGS_END = "2026-10-15T18:00:00Z";

// The golden Legs rows as the board draws them: sets, then the heat step the swatch and the figures share.
const goldenRows = [
  { name: "Hamstrings", muscle: "hamstrings", sets: "5.5 sets", step: 3 },
  { name: "Quads", muscle: "quads", sets: "5 sets", step: 3 },
  { name: "Glutes", muscle: "glute_max", sets: "4 sets", step: 3 },
  { name: "Lower back", muscle: "lower_back", sets: "2.1 sets", step: 1 },
  { name: "Calves", muscle: "calves", sets: "1.6 sets", step: 1 },
] as const satisfies readonly { name: string; muscle: MuscleId; sets: string; step: number }[];

function propOf(props: object, name: string): unknown {
  return Object.getOwnPropertyDescriptor(props, name)?.value;
}

function styleProperty(style: unknown, name: string): unknown {
  if (Array.isArray(style)) {
    return style.map((part) => styleProperty(part, name)).findLast((value) => value !== undefined);
  }
  return typeof style === "object" && style !== null ? propOf(style, name) : undefined;
}

async function renderCard(
  props: Partial<MusclesTrainedCardProps> = {},
  scheme: ThemeScheme = "dark",
) {
  return await render(
    <ThemeProvider fixedPreference={scheme}>
      <MusclesTrainedCard at={LEGS_END} sets={goldenLegsHeatSets} {...props} />
    </ThemeProvider>,
  );
}

// The card is a region that holds its rows, so it is not an accessibility element itself (that would fold the
// rows into one): it is found by its name, and its role is checked on the element.
function musclesTrainedCard() {
  const card = screen.getByLabelText("Muscles trained");
  expect(card).toHaveProp("role", "region");

  return card;
}

// The swatch of each row, in the order drawn: the 10 point squares inside the card.
function swatchesInTheCard() {
  return musclesTrainedCard().queryAll(
    (node) =>
      typeof node.type === "string" &&
      styleProperty(node.props.style, "width") === 10 &&
      styleProperty(node.props.style, "height") === 10,
  );
}

function swatchColours() {
  return swatchesInTheCard().map((swatch) => styleProperty(swatch.props.style, "backgroundColor"));
}

describe("the Muscles trained card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/MusclesTrainedCard"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  afterEach(async () => {
    await cleanup();
  });

  it("should be a region named Muscles trained, with the heading and the Effective sets caption", async () => {
    await renderCard();

    const card = musclesTrainedCard();
    expect(within(card).getByRole("heading", { name: "Muscles trained" })).toBeOnTheScreen();
    expect(within(card).getByText("Effective sets")).toBeOnTheScreen();
  });

  it("should name the front and the back figure for this session's heat, 64 points wide", async () => {
    await renderCard();

    for (const name of ["This session's heat, front", "This session's heat, back"]) {
      const figure = screen.getByRole("img", { name });
      expect(figure.parent).toHaveStyle({ width: 64 });
    }
  });

  it("should list the golden Legs muscles by effective sets, highest first, each named with its heat step", async () => {
    await renderCard();

    const rows = screen.getAllByRole("listitem");

    expectAccessibleNamesInOrder(
      rows,
      goldenRows.map((row) => `${row.name}, ${row.sets}, ${HEAT_STEP_NAMES[row.step]}`),
    );
  });

  it("should show each row's name and sets as text", async () => {
    await renderCard();

    const rows = screen.getAllByRole("listitem");
    for (const [index, { name, sets }] of goldenRows.entries()) {
      const row = rows[index];
      expect(row).toBeDefined();
      expect(row && within(row).getByText(name, { includeHiddenElements: true })).toBeOnTheScreen();
      expect(row && within(row).getByText(sets, { includeHiddenElements: true })).toBeOnTheScreen();
    }
  });

  it("should colour each swatch with the heat step its row names", async () => {
    await renderCard();

    expect(swatchColours()).toEqual(
      goldenRows.map((row) => resolvedColor("dark", `heat-${row.step}`)),
    );
  });

  it.each(["front", "back"] as const)(
    "should fill the %s figure's muscles with the same step as their swatches",
    async (side) => {
      await renderCard();

      const fills = fillsIn(
        screen.getByRole("img", { name: `This session's heat, ${side}` }),
        side,
      );
      const stepOf = new Map<MuscleId, number>(goldenRows.map((row) => [row.muscle, row.step]));
      expect(fills.size).toBeGreaterThan(0);
      // A muscle the session trained takes its row's step, and every other muscle is at rest.
      for (const [muscle, fill] of fills) {
        expect(fill).toEqual(heatFill("dark", stepOf.get(muscle) ?? 0));
      }
    },
  );

  it("should leave the card out for a session with no working sets", async () => {
    await renderCard({ sets: goldenLegsHeatSets.filter((set) => set.set_type === "warmup") });

    expect(screen.queryByLabelText("Muscles trained")).not.toBeOnTheScreen();
  });

  describe("a muscle at Peak", () => {
    // Nine hard sets of the golden squat leave the quads at Peak and the glutes, a step down, at Hot.
    const peakSets = Array.from({ length: 9 }, (_, index) => ({
      set_type: "working" as const,
      rir: 2,
      rpe: null,
      performed_at: `2026-10-15T18:${String(10 + index)}:00+01:00`,
      deleted_at: null,
      snapshot: snapshotOf("squat", "legs"),
    }));

    it("should glow on the Peak swatch alone, as the legend's does", async () => {
      await renderCard({ sets: peakSets });

      const swatches = swatchesInTheCard();
      expect(swatches[0]).toHaveStyle({
        shadowColor: bodyMapPalette("dark").heatGlow,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
      });
      for (const swatch of swatches.slice(1)) {
        expect(styleProperty(swatch.props.style, "shadowRadius")).toBeUndefined();
      }
    });

    it("should name the step Peak on its row", async () => {
      await renderCard({ sets: peakSets });

      expect(screen.getAllByRole("listitem")[0]).toHaveAccessibleName(/^Quads, .*, Peak$/);
    });
  });
});
