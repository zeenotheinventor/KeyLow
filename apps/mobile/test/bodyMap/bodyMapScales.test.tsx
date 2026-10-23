import { KeyLowProvider, keys, useBodyMap } from "@keylow/api-client";
import { MUSCLE_IDS } from "@keylow/core/training";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { BodyMapScreen } from "../../components/BodyMapScreen";
import { RESTING_HEAT } from "../../components/DashboardScreen/DashboardBodyMapCard";
import { resetBodyFigureForTests } from "../../lib/bodyFigure/testing";
import { ThemeProvider } from "../../lib/theme";
import { createDiaryQueryClient, diaryClient, resetDiaryBackend } from "../support/diaryBackend";
import { resetRouterMock } from "../support/expoRouterMock";
import { fillsIn, gapFill, heatFill, volumeFill } from "../support/figureFills";
import { tapFigures } from "../support/figuresResponder";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
import { resolvedColor } from "../support/themeColor";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleId } from "@keylow/core/training";
import type { QueryClient } from "@tanstack/react-query";

const mockStorageItems = new Map<string, string>();
const mockSetItem = jest.fn((key: string, value: string) => {
  mockStorageItems.set(key, value);
  return Promise.resolve();
});
let mockNow = "2026-10-15T18:00:00Z";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(mockStorageItems.get(key) ?? null),
    setItem: (key: string, value: string) => mockSetItem(key, value),
  },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date(mockNow),
}));
// The hook is the one thing replaced: its numbers are core's, pinned by its own tests. This file is about
// what the screen does with them, so it is given the golden values and nothing else is faked.
jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<typeof import("@keylow/api-client")>("@keylow/api-client"),
  useBodyMap: jest.fn(),
}));

setUpTests();

// Thursday 15 October 19:00 and Sunday 18 October 20:00 in London, the moments the golden week is pinned at.
const THURSDAY = "2026-10-15T18:00:00Z";
const SUNDAY = "2026-10-18T19:00:00Z";

// The numbers are the encodings of core's `VOLUME_STATUSES` and `GAP_VALUES`.
const UNDER = 0;
const MAINTAINING = 1;
const PRODUCTIVE = 2;
const NOT_TARGETED = 4;
const BEHIND = 0;
const ON_PLAN = 1;
const NOT_IN_PLAN = 3;

const NOT_IN_THE_PLAN_MUSCLES: MuscleId[] = [
  "traps_upper",
  "abs",
  "obliques",
  "glute_med",
  "adductors",
  "tibialis",
  "neck",
];

function valuesOf(rest: number, groups: [number, MuscleId[]][]): BodyMap["values"] {
  const values = { ...RESTING_HEAT };
  for (const muscle of MUSCLE_IDS) {
    values[muscle] = rest;
  }
  for (const [value, muscles] of groups) {
    for (const muscle of muscles) {
      values[muscle] = value;
    }
  }
  return values;
}

const heatThursday = valuesOf(0, [
  [2, ["lats", "lower_back", "calves"]],
  [3, ["quads"]],
]);

// The golden week at Sunday 20:00, as the core golden tests pin it.
const volumeProjected = valuesOf(NOT_TARGETED, [
  [PRODUCTIVE, ["triceps", "delt_front", "delt_side"]],
  [MAINTAINING, ["lats", "chest_upper", "chest_lower", "biceps"]],
  [
    UNDER,
    [
      "traps_mid",
      "delt_rear",
      "hamstrings",
      "quads",
      "glute_max",
      "lower_back",
      "calves",
      "forearms",
    ],
  ],
]);
const volumeActual = valuesOf(NOT_TARGETED, [
  [MAINTAINING, ["delt_front", "lats", "biceps", "triceps"]],
  [
    UNDER,
    [
      "chest_upper",
      "chest_lower",
      "delt_side",
      "delt_rear",
      "traps_mid",
      "lower_back",
      "forearms",
      "glute_max",
      "quads",
      "hamstrings",
      "calves",
    ],
  ],
]);
const gapSunday = valuesOf(ON_PLAN, [
  [BEHIND, ["triceps", "delt_front", "delt_side", "chest_upper", "chest_lower"]],
  [NOT_IN_PLAN, NOT_IN_THE_PLAN_MUSCLES],
]);
const gapThursday = valuesOf(ON_PLAN, [[NOT_IN_PLAN, NOT_IN_THE_PLAN_MUSCLES]]);

function weekDays(statusOf: Record<string, BodyMapDay["status"]> = {}): BodyMapDay[] {
  const statuses: [string, BodyMapDay["status"], string | null][] = [
    ["2026-10-12", "logged", "Push"],
    ["2026-10-13", "logged", "Pull"],
    ["2026-10-14", "rest", null],
    ["2026-10-15", "logged", "Legs"],
    ["2026-10-16", "rest", null],
    ["2026-10-17", "missed", "Push"],
    ["2026-10-18", "rest", null],
  ];
  return statuses.map(([date, status, plannedDayName]) => ({
    date,
    at: `${date}T19:00:00.000Z`,
    isToday: false,
    status: statusOf[date] ?? status,
    plannedDayName,
    selectable: true,
  }));
}

function bodyMapOf(values: BodyMap["values"], overrides: Partial<BodyMap> = {}): BodyMap {
  return {
    values,
    computedAt: new Date(mockNow).toISOString(),
    days: weekDays(),
    todayProjectedIsActual: false,
    projectedAvailable: true,
    nothingLogged: false,
    ...overrides,
  };
}

function readResult(data: BodyMap): TrainingReadResult<BodyMap> {
  return { data, isPending: false, isError: false, error: null, refetch: () => Promise.resolve() };
}

// A read that is switched off holds nothing, as the real hook does, so a screen that looked at it would show a skeleton.
const switchedOff: TrainingReadResult<BodyMap> = {
  data: undefined,
  isPending: true,
  isError: false,
  error: null,
  refetch: () => Promise.resolve(),
};

function showScales(overrides: Partial<BodyMap> = {}) {
  const maps: Record<string, BodyMap> = {
    "heat-actual": bodyMapOf(heatThursday, overrides),
    "heat-projected": bodyMapOf(heatThursday, overrides),
    "volume-actual": bodyMapOf(volumeActual, overrides),
    "volume-projected": bodyMapOf(volumeProjected, overrides),
    "gap-actual": bodyMapOf(gapSunday, overrides),
  };
  jest.mocked(useBodyMap).mockImplementation(({ scale, view, enabled }) => {
    const data = maps[`${scale}-${view}`];
    return enabled === false || data === undefined ? switchedOff : readResult(data);
  });
}

let queryClient: QueryClient;

async function openScreen() {
  queryClient = createDiaryQueryClient();
  queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <BodyMapScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByLabelText("Scale");
}

async function switchTo(name: "Heat" | "Volume" | "Gap") {
  await userEvent.setup().press(screen.getByRole("radio", { name }));
}

const figureName = (view: string, scale: string, side: "front" | "back") =>
  `Body map, ${view}, ${scale}, ${side}`;

// The quads are on the front only and the lats on the back only, so each side reads the muscle it shows.
function fillOf(muscle: MuscleId, name: string) {
  const side = name.endsWith("front") ? "front" : "back";
  return fillsIn(screen.getByRole("img", { name }), side).get(muscle);
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

// The swatches of a legend are the 10 point tall boxes in it, in the order they are drawn.
function swatchesOf(group: string) {
  return screen
    .getByRole("group", { name: group })
    .queryAll(
      (node) => typeof node.type === "string" && styleProperty(node.props.style, "height") === 10,
    );
}

function swatchFills(group: string) {
  return swatchesOf(group).map((swatch) => styleProperty(swatch.props.style, "backgroundColor"));
}

// Only the peak of the heat legend glows, so every swatch of the other legends has no shadow at all.
function expectNoSwatchGlows(group: string) {
  for (const swatch of swatchesOf(group)) {
    expect(styleProperty(swatch.props.style, "shadowRadius")).toBeUndefined();
  }
}

describe("the body map scales", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/ViewLabel",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetDiaryBackend();
    mockStorageItems.clear();
    // The figure is already chosen (Male), so the screen does not stop to ask. The figure tests cover the question.
    mockStorageItems.set("bodyMap.figure", "male");
    resetBodyFigureForTests();
    mockSetItem.mockClear();
    mockNow = SUNDAY;
    showScales();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
    jest.mocked(useBodyMap).mockReset();
  });

  describe("the scale switch", () => {
    it("should be a labelled radio group of Heat, Volume and Gap, with Heat chosen", async () => {
      await openScreen();

      // The role query does not resolve a radiogroup, so the group is found by its label.
      const group = screen.getByLabelText("Scale");
      expect(group).toHaveProp("role", "radiogroup");

      const radios = within(group).getAllByRole("radio");
      expect(radios).toHaveLength(3);
      expect(radios[0]).toHaveAccessibleName("Heat");
      expect(radios[1]).toHaveAccessibleName("Volume");
      expect(radios[2]).toHaveAccessibleName("Gap");
      expect(screen.getByRole("radio", { name: "Heat", checked: true })).toBeOnTheScreen();
    });

    it("should open on Heat every time, and not remember the scale", async () => {
      await openScreen();
      await switchTo("Volume");
      await cleanup();

      await openScreen();

      expect(screen.getByRole("radio", { name: "Heat", checked: true })).toBeOnTheScreen();
      expect(mockSetItem).not.toHaveBeenCalled();
    });

    it("should choose Volume when it is pressed", async () => {
      await openScreen();

      await switchTo("Volume");

      expect(screen.getByRole("radio", { name: "Volume", checked: true })).toBeOnTheScreen();
      expect(screen.getByRole("radio", { name: "Heat", checked: false })).toBeOnTheScreen();
    });
  });

  describe("reading", () => {
    const week = { weekStart: "2026-10-12", now: "2026-10-18T19:00:00.000Z" };

    it("should read every scale at once, Heat and Volume in both views and Gap in one", async () => {
      await openScreen();

      for (const scale of ["heat", "volume"] as const) {
        for (const view of ["actual", "projected"] as const) {
          expect(useBodyMap).toHaveBeenCalledWith({ scale, view, ...week, enabled: true });
        }
      }
      expect(useBodyMap).toHaveBeenCalledWith({
        scale: "gap",
        view: "actual",
        ...week,
        enabled: true,
      });
    });

    it("should not show a skeleton when the scale changes", async () => {
      await openScreen();

      await switchTo("Volume");

      expect(screen.queryByRole("status", { name: "Loading the body map" })).not.toBeOnTheScreen();
    });
  });

  describe("Volume", () => {
    it("should name the figures for weekly sets and fill them from the Projected statuses of the golden week", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();
      await switchTo("Volume");

      const front = figureName("Projected", "weekly sets", "front");
      const back = figureName("Projected", "weekly sets", "back");

      expect(screen.getByRole("img", { name: back })).toBeOnTheScreen();
      expect(fillOf("triceps", back)).toEqual(volumeFill("dark", PRODUCTIVE));
      expect(fillOf("lats", back)).toEqual(volumeFill("dark", MAINTAINING));
      expect(fillOf("hamstrings", back)).toEqual(volumeFill("dark", UNDER));
      expect(fillOf("quads", front)).toEqual(volumeFill("dark", UNDER));
      expect(fillOf("abs", front)).toEqual(volumeFill("dark", NOT_TARGETED));
      expect(fillOf("chest_upper", front)).toEqual(volumeFill("dark", MAINTAINING));
    });

    it("should read Projected over the plan's week, with the date the plan reaches", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();
      await switchTo("Volume");

      expect(screen.getByRole("status", { name: "Projected" })).toBeOnTheScreen();
      expect(screen.getByText("By Sun 18 Oct, if you follow the plan")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Show actual" })).toBeOnTheScreen();
    });

    it("should show the Actual statuses when Show actual is pressed, under the week so far", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();
      await switchTo("Volume");
      const user = userEvent.setup();

      await user.press(screen.getByRole("button", { name: "Show actual" }));

      const back = figureName("Actual", "weekly sets", "back");
      expect(await screen.findByRole("status", { name: "Actual" })).toBeOnTheScreen();
      expect(screen.getByText("This week · as of Sun 18 Oct, 20:00")).toBeOnTheScreen();
      expect(fillOf("triceps", back)).toEqual(volumeFill("dark", MAINTAINING));
      expect(fillOf("hamstrings", back)).toEqual(volumeFill("dark", UNDER));
    });

    it("should keep the view that is remembered, and show Projected when that was chosen", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();

      await switchTo("Volume");

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
      expect(screen.getByText("By Sun 18 Oct, if you follow the plan")).toBeOnTheScreen();
    });

    it("should carry the view chosen on Volume to Heat, as the one remembered view", async () => {
      await openScreen();
      await switchTo("Volume");
      const user = userEvent.setup();
      await user.press(screen.getByRole("button", { name: "Show projected" }));

      await switchTo("Heat");

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
      expect(mockStorageItems.get("bodyMap.view")).toBe("projected");
    });

    it("should flip the view with a tap on the figures", async () => {
      await openScreen();
      await switchTo("Volume");

      await act(() => {
        tapFigures();
      });

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
    });

    it("should leave the button off, with the reason, when there is no routine", async () => {
      showScales({ projectedAvailable: false });
      await openScreen();
      await switchTo("Volume");

      expect(screen.getByRole("button", { name: "Show projected" })).toBeDisabled();
      expect(screen.getByText("Projected needs a routine.")).toBeOnTheScreen();
    });

    it("should draw no note about today when Projected is what is logged, which only Heat says", async () => {
      mockNow = THURSDAY;
      showScales({ todayProjectedIsActual: true });
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();

      expect(screen.getByText(/^Today, Projected shows what you have logged/)).toBeOnTheScreen();
      await switchTo("Volume");

      expect(
        screen.queryByText(/^Today, Projected shows what you have logged/),
      ).not.toBeOnTheScreen();
    });

    it("should name the legend and list Not targeted first, then Under to Over", async () => {
      await openScreen();
      await switchTo("Volume");

      const legend = screen.getByRole("group", { name: "Volume legend" });

      expectTextsInOrder(within(legend).getAllByText(/./), [
        "Not targeted",
        "Under",
        "Maintaining",
        "Productive",
        "Over",
      ]);
      expect(screen.queryByRole("group", { name: "Heat legend" })).not.toBeOnTheScreen();
    });

    it("should caption the legend with the sets against the target and what Over means", async () => {
      await openScreen();
      await switchTo("Volume");

      expect(
        screen.getByText(
          "Sets this week against each muscle's target. Over means above the maximum.",
        ),
      ).toBeOnTheScreen();
    });

    it("should colour the swatches with the volume tokens, and glow on none", async () => {
      await openScreen();
      await switchTo("Volume");

      expect(swatchFills("Volume legend")).toEqual(
        (
          [
            "volume-not-targeted",
            "volume-under",
            "volume-maintaining",
            "volume-productive",
            "volume-over",
          ] as const
        ).map((token) => resolvedColor("dark", token)),
      );
      expectNoSwatchGlows("Volume legend");
    });

    it("should draw the figures and the legend as usual with nothing logged in the heat window", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      showScales({ nothingLogged: true });
      await openScreen();
      await switchTo("Volume");

      expect(screen.getByRole("group", { name: "Volume legend" })).toBeOnTheScreen();
      expect(screen.queryByText("Nothing to show yet")).not.toBeOnTheScreen();
      expect(screen.queryByText(/^Nothing logged in the last/)).not.toBeOnTheScreen();
      expect(fillOf("triceps", figureName("Projected", "weekly sets", "back"))).toEqual(
        volumeFill("dark", PRODUCTIVE),
      );
    });
  });

  describe("Gap", () => {
    it("should name the view Done against plan, with the week so far as its moment", async () => {
      await openScreen();
      await switchTo("Gap");

      expect(await screen.findByRole("status", { name: "Done against plan" })).toBeOnTheScreen();
      expect(screen.getByText("This week · as of Sun 18 Oct, 20:00")).toBeOnTheScreen();
    });

    it("should fill the golden Sunday: the push muscles behind, the untrained not in plan, the rest on plan", async () => {
      await openScreen();
      await switchTo("Gap");
      const front = figureName("Done against plan", "gap", "front");
      const back = figureName("Done against plan", "gap", "back");

      expect(fillOf("triceps", back)).toEqual(gapFill("dark", BEHIND));
      expect(fillOf("delt_side", front)).toEqual(gapFill("dark", BEHIND));
      expect(fillOf("chest_upper", front)).toEqual(gapFill("dark", BEHIND));
      expect(fillOf("lats", back)).toEqual(gapFill("dark", ON_PLAN));
      expect(fillOf("quads", front)).toEqual(gapFill("dark", ON_PLAN));
      expect(fillOf("abs", front)).toEqual(gapFill("dark", NOT_IN_PLAN));
      expect(fillOf("neck", front)).toEqual(gapFill("dark", NOT_IN_PLAN));
    });

    it("should have no toggle button, whatever view is remembered", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();

      await switchTo("Gap");

      expect(
        screen.queryByRole("button", { name: /^show (projected|actual)$/i }),
      ).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Back" })).toBeOnTheScreen();
    });

    it("should do nothing on a tap on the figures, and leave the remembered view alone", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();
      await switchTo("Gap");

      await act(() => {
        tapFigures();
      });

      expect(await screen.findByRole("status", { name: "Done against plan" })).toBeOnTheScreen();
      expect(mockSetItem).not.toHaveBeenCalled();
      expect(mockStorageItems.get("bodyMap.view")).toBe("projected");
    });

    it("should come back to the remembered view on Heat", async () => {
      mockStorageItems.set("bodyMap.view", "projected");
      await openScreen();
      await switchTo("Gap");

      await switchTo("Heat");

      expect(await screen.findByRole("status", { name: "Projected" })).toBeOnTheScreen();
    });

    it("should say the Saturday Push was missed and name the muscles it left behind, with nothing about the week so far on the last day", async () => {
      await openScreen();
      await switchTo("Gap");

      expect(
        screen.getByText(
          "Gap compares this week's sets with your plan, so it has no Actual or Projected. Saturday's Push was missed, so upper chest, lower chest, front delts, side delts and triceps are behind.",
        ),
      ).toBeOnTheScreen();
      expect(
        screen.queryByText(/It counts your planned days up to yesterday/),
      ).not.toBeOnTheScreen();
    });

    it("should read every muscle on plan on the golden Thursday, and say the week so far is what counts", async () => {
      mockNow = THURSDAY;
      const notYetDue = weekDays({ "2026-10-17": "planned" });
      jest
        .mocked(useBodyMap)
        .mockImplementation(({ scale, enabled }) =>
          enabled === false
            ? switchedOff
            : readResult(
                bodyMapOf(scale === "gap" ? gapThursday : heatThursday, { days: notYetDue }),
              ),
        );
      await openScreen();
      await switchTo("Gap");
      const front = figureName("Done against plan", "gap", "front");
      const back = figureName("Done against plan", "gap", "back");

      expect(fillOf("triceps", back)).toEqual(gapFill("dark", ON_PLAN));
      expect(fillOf("chest_upper", front)).toEqual(gapFill("dark", ON_PLAN));
      expect(fillOf("abs", front)).toEqual(gapFill("dark", NOT_IN_PLAN));
      expect(
        screen.getByText(
          "Gap compares this week's sets with your plan, so it has no Actual or Projected. It counts your planned days up to yesterday, and today once you have logged it.",
        ),
      ).toBeOnTheScreen();
    });

    it("should follow the missed sessions of the week, in the plural when there are two", async () => {
      mockNow = THURSDAY;
      const twoMissed = weekDays({ "2026-10-13": "missed" });
      showScales({ days: twoMissed });
      await openScreen();
      await switchTo("Gap");

      expect(
        screen.getByText(
          "Gap compares this week's sets with your plan, so it has no Actual or Projected. Tuesday's Pull and Saturday's Push were missed, so upper chest, lower chest, front delts, side delts and triceps are behind. It counts your planned days up to yesterday, and today once you have logged it.",
        ),
      ).toBeOnTheScreen();
    });

    it("should leave a missed session out of the note when no muscle reads behind, so no sentence is left half written", async () => {
      jest
        .mocked(useBodyMap)
        .mockImplementation(({ scale, enabled }) =>
          enabled === false
            ? switchedOff
            : readResult(bodyMapOf(scale === "gap" ? gapThursday : heatThursday)),
        );
      await openScreen();
      await switchTo("Gap");

      expect(
        await screen.findByText(
          "Gap compares this week's sets with your plan, so it has no Actual or Projected.",
        ),
      ).toBeOnTheScreen();
    });

    it("should name the figures for the gap", async () => {
      await openScreen();
      await switchTo("Gap");

      expect(
        screen.getByRole("img", { name: figureName("Done against plan", "gap", "front") }),
      ).toBeOnTheScreen();
    });

    it("should name the legend, list Not in plan first, and caption it with the tolerance", async () => {
      await openScreen();
      await switchTo("Gap");

      const legend = screen.getByRole("group", { name: "Gap legend" });

      expectTextsInOrder(within(legend).getAllByText(/./), [
        "Not in plan",
        "Behind",
        "On plan",
        "Ahead",
      ]);
      expect(
        screen.getByText("Sets done against your plan for the week. On plan means within 1 set."),
      ).toBeOnTheScreen();
    });

    it("should colour the swatches with the volume token for Not in plan and the gap tokens, and glow on none", async () => {
      await openScreen();
      await switchTo("Gap");

      expect(swatchFills("Gap legend")).toEqual(
        (["volume-not-targeted", "gap-behind", "gap-on-plan", "gap-ahead"] as const).map((token) =>
          resolvedColor("dark", token),
        ),
      );
      expectNoSwatchGlows("Gap legend");
    });

    it("should draw the figures as usual with nothing logged in the heat window", async () => {
      showScales({ nothingLogged: true });
      await openScreen();
      await switchTo("Gap");

      expect(screen.getByRole("group", { name: "Gap legend" })).toBeOnTheScreen();
      expect(screen.queryByText("Nothing to show yet")).not.toBeOnTheScreen();
      expect(fillOf("triceps", figureName("Done against plan", "gap", "back"))).toEqual(
        gapFill("dark", BEHIND),
      );
    });
  });

  describe.each([
    ["Heat", "Heat legend"],
    ["Volume", "Volume legend"],
    ["Gap", "Gap legend"],
  ] as const)("the %s legend", (scale, group) => {
    it("should give every name a swatch with a colour", async () => {
      await openScreen();
      await switchTo(scale);

      const names = within(screen.getByRole("group", { name: group })).getAllByText(/./);
      const fills = swatchFills(group);

      expect(fills).toHaveLength(names.length);
      expect(fills.every((fill) => typeof fill === "string")).toBe(true);
    });
  });

  describe("back on Heat", () => {
    it("should draw the heat figures, the heat legend and its caption again", async () => {
      await openScreen();
      await switchTo("Gap");

      await switchTo("Heat");

      expect(fillOf("quads", figureName("Actual", "heat", "front"))).toEqual(heatFill("dark", 3));
      expect(screen.getByRole("group", { name: "Heat legend" })).toBeOnTheScreen();
      expect(
        screen.getByText("How hard and how recently each muscle worked. It cools as you recover."),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("group", { name: "Gap legend" })).not.toBeOnTheScreen();
    });

    it("should still show the empty state on Heat when nothing was logged", async () => {
      showScales({ nothingLogged: true });
      await openScreen();
      await switchTo("Gap");

      await switchTo("Heat");

      expect(screen.getByRole("heading", { name: "Nothing to show yet" })).toBeOnTheScreen();
      expect(screen.queryByRole("group", { name: "Heat legend" })).not.toBeOnTheScreen();
    });
  });
});
