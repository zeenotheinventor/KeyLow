import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP, TRAIN_OFFLINE_TITLE } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderIn,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleId } from "@keylow/core/training";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

type BodyMapRead = TrainingReadResult<BodyMap>;
type AskedRead = { scale: string; view: string; at: string | undefined; enabled?: boolean };

const reads = vi.hoisted(
  (): {
    // Each body map read by its scale, view and day, as "heat:actual@2026-10-13". A read with no day is "heat:actual".
    byRead: Record<string, unknown>;
    asked: AskedRead[];
    listAsked: { view: string; at: string | undefined }[];
    scaleListAsked: Record<string, unknown>[];
    detailAsked: { muscle: string; view: string; at: string | undefined }[];
  } => ({ byRead: {}, asked: [], listAsked: [], scaleListAsked: [], detailAsked: [] }),
);

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
  // A day nobody set up gives a pending read, so a skeleton shows if the screen asks for the wrong one.
  useBodyMap: (asked: AskedRead) => {
    reads.asked.push(asked);
    const day = asked.at === undefined ? "" : `@${asked.at}`;
    return reads.byRead[`${asked.scale}:${asked.view}${day}`] ?? pending;
  },
  useMuscleDetail: (muscle: string, { view, at }: { view: string; at: string | undefined }) => {
    reads.detailAsked.push({ muscle, view, at });
    return pending;
  },
  useActiveRoutine: () => ({ data: null }),
  // Volume's and Gap's rows are read with no day, since their figures are.
  useMuscleScaleList: (options: Record<string, unknown>) => {
    reads.scaleListAsked.push(options);
    return {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: () => Promise.resolve(),
    };
  },
  useMuscleList: ({ view, at }: { view: string; at: string | undefined }) => {
    reads.listAsked.push({ view, at });
    return {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: () => Promise.resolve(),
    };
  },
}));

const render = (ui: ReactElement) => renderIn(ui, { wrapper: ToastProvider });

const refetch = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
const read = (data: BodyMap): BodyMapRead => ({
  data,
  isPending: false,
  isError: false,
  error: null,
  refetch,
});
const pending: BodyMapRead = {
  data: undefined,
  isPending: true,
  isError: false,
  error: null,
  refetch,
};

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";

const dayOf = (
  date: string,
  status: BodyMapDay["status"],
  names: { planned?: string; session?: string },
  isSelectable: boolean,
): BodyMapDay => ({
  date,
  at: `${date}T19:00:00.000Z`,
  isToday: date === "2026-10-15",
  status,
  plannedDayName: names.planned ?? null,
  sessionDayName: names.session ?? null,
  selectable: isSelectable,
});
// The golden week as the scrubber draws it: Thursday's Legs is in progress and Saturday's Push is planned.
const weekDays = (isProjected: boolean): BodyMapDay[] => [
  dayOf("2026-10-12", "logged", { planned: "Push", session: "Push" }, true),
  dayOf("2026-10-13", "logged", { planned: "Pull", session: "Pull" }, true),
  dayOf("2026-10-14", "rest", {}, true),
  dayOf("2026-10-15", "in_progress", { planned: "Legs", session: "Legs" }, true),
  dayOf("2026-10-16", "rest", {}, isProjected),
  dayOf("2026-10-17", "planned", { planned: "Push" }, isProjected),
  dayOf("2026-10-18", "rest", {}, isProjected),
];

const mapOf = (
  isProjected: boolean,
  computedAt: string,
  values: Partial<Record<MuscleId, number>>,
  overrides: Partial<BodyMap> = {},
): BodyMap => ({
  values: { ...RESTING_HEAT, ...values },
  computedAt,
  days: weekDays(isProjected),
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
  ...overrides,
});

// The steps core pins for the golden week (bodyMapValues.test.ts of @keylow/core), written out as it writes them.
const THURSDAY_NOW = { chest_upper: 1, quads: 3, hamstrings: 3, lats: 2 };
const TUESDAY_20_00_ACTUAL = {
  chest_upper: 1,
  chest_lower: 1,
  delt_front: 2,
  delt_side: 1,
  delt_rear: 4,
  lats: 5,
  traps_mid: 4,
  biceps: 5,
  triceps: 2,
  forearms: 1,
};
const SUNDAY_20_00_PROJECTED = {
  chest_upper: 1,
  chest_lower: 1,
  delt_front: 2,
  delt_side: 1,
  triceps: 2,
  glute_max: 1,
  quads: 1,
  hamstrings: 1,
};
const SUNDAY_20_00_ACTUAL = { glute_max: 1, quads: 1, hamstrings: 1 };

const TUESDAY_19_00_UTC = "2026-10-13T19:00:00.000Z";
const SUNDAY_19_00_UTC = "2026-10-18T19:00:00.000Z";

// Every read the golden week is asked for, by scale, view and day. Gap has no Projected.
function showGoldenWeek(overrides: Partial<BodyMap> = {}) {
  const nowActual = read(mapOf(false, THURSDAY_19_00, THURSDAY_NOW, overrides));
  const nowProjected = read(mapOf(true, THURSDAY_19_00, THURSDAY_NOW, overrides));
  // Every other day of the week reads at rest, since the numbers are core's and not this test's.
  const otherDays = Object.fromEntries(
    ["2026-10-12", "2026-10-14", "2026-10-16", "2026-10-17"].flatMap((date) => {
      const computedAt = `${date}T19:00:00.000Z`;
      return [
        [`heat:actual@${date}`, read(mapOf(false, computedAt, {}, overrides))],
        [`heat:projected@${date}`, read(mapOf(true, computedAt, {}, overrides))],
      ];
    }),
  );
  reads.byRead = {
    ...otherDays,
    "heat:actual": nowActual,
    "heat:projected": nowProjected,
    "volume:actual": nowActual,
    "volume:projected": nowProjected,
    "gap:actual": nowActual,
    "heat:actual@2026-10-13": read(
      mapOf(false, TUESDAY_19_00_UTC, TUESDAY_20_00_ACTUAL, overrides),
    ),
    "heat:projected@2026-10-13": read(
      mapOf(true, TUESDAY_19_00_UTC, TUESDAY_20_00_ACTUAL, overrides),
    ),
    "heat:projected@2026-10-18": read(
      mapOf(true, SUNDAY_19_00_UTC, SUNDAY_20_00_PROJECTED, overrides),
    ),
    // Only the side by side view asks Actual for a day after today.
    "heat:actual@2026-10-18": read(mapOf(true, SUNDAY_19_00_UTC, SUNDAY_20_00_ACTUAL, overrides)),
  };
}

const scrubber = () => screen.getByRole("radiogroup", { name: BODY_MAP.scrubber.name });
const dayButton = (name: RegExp | string) => within(scrubber()).getByRole("radio", { name });
const pickDay = (name: RegExp | string) => {
  fireEvent.click(dayButton(name));
};
const toggle = () => screen.getByRole("button", { name: /^Show (projected|actual)$/ });
const sideBySideButton = () => screen.getByRole("button", { name: BODY_MAP.sideBySideName });
const viewLabel = () =>
  within(screen.getByRole("region", { name: BODY_MAP.title })).getByRole("status");
const loading = () => screen.queryByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel });
// The shown view's figures are groups of muscle buttons and the other view's are plain images.
const figure = (side: "front" | "back", view = "Actual") => {
  const name = `Body map, ${view}, heat, ${side}`;
  return screen.queryByRole("group", { name }) ?? screen.getByRole("img", { name, hidden: true });
};
const fillOf = (side: "front" | "back", muscle: MuscleId, view = "Actual") => {
  const path = Object.entries(BODY_ARTWORK.male[side].muscles).find(([id]) => id === muscle)?.[1];
  return (
    figure(side, view)
      .querySelector(`path[d="${path}"]:not([aria-hidden])`)
      ?.getAttribute("class") ?? ""
  );
};
const readsAskedOnce = () =>
  new Set(reads.asked.map(({ scale, view, at }) => `${scale}:${view}@${at ?? "now"}`));

describe("the day scrubber and the side by side view", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    window.localStorage.clear();
    window.localStorage.setItem("bodyMap.figure", "male");
    // The first-open hint was dismissed on an earlier visit, so only its own tests see it.
    window.localStorage.setItem("bodyMap.hintSeen", "true");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    reads.asked = [];
    reads.listAsked = [];
    reads.scaleListAsked = [];
    reads.detailAsked = [];
    showGoldenWeek();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    onlineManager.setOnline(true);
  });

  describe("the row of days", () => {
    it("should name each day as the board does, with today chosen", () => {
      render(<BodyMapScreen />);

      const names = within(scrubber())
        .getAllByRole("radio")
        .map((day) => day.getAttribute("aria-label"));
      expect(names).toStrictEqual([
        "Monday 12 October, Push, logged",
        "Tuesday 13 October, Pull, logged",
        "Wednesday 14 October, rest day",
        "Thursday 15 October, today, Legs in progress",
        "Friday 16 October, rest day, available in Projected",
        "Saturday 17 October, Push, planned, available in Projected",
        "Sunday 18 October, rest day, available in Projected",
      ]);
      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("true");
    });

    it("should be on Heat only, and leave the row for the scales that have no day", () => {
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.volume }));

      expect(screen.queryByRole("radiogroup", { name: BODY_MAP.scrubber.name })).toBeNull();
    });

    it("should disable the days after today in Actual, and do nothing when one is pressed", () => {
      render(<BodyMapScreen />);
      const asked = reads.asked.length;

      pickDay(/^Saturday 17 October/);

      expect(dayButton(/^Saturday 17 October/).getAttribute("aria-disabled")).toBe("true");
      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("true");
      expect(within(viewLabel()).getByText("Now · Thu 15 Oct, 19:00")).toBeTruthy();
      expect(reads.asked.slice(asked).every(({ at }) => at === undefined)).toBe(true);
    });

    it("should enable all seven days in Projected", () => {
      render(<BodyMapScreen />);

      fireEvent.click(toggle());

      const days = within(scrubber()).getAllByRole("radio");
      expect(days.map((day) => day.getAttribute("aria-disabled"))).toStrictEqual(
        Array.from({ length: 7 }, () => "false"),
      );
    });
  });

  describe("Actual on Tuesday 13 October at 20:00", () => {
    it("should read that day, say so, and fill the muscles with the steps core pins", () => {
      render(<BodyMapScreen />);

      pickDay(/^Tuesday 13 October/);

      expect(reads.asked.some(({ view, at }) => view === "actual" && at === "2026-10-13")).toBe(
        true,
      );
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
      expect(within(viewLabel()).getByText("Tue 13 Oct, 20:00")).toBeTruthy();
      expect(dayButton(/^Tuesday 13 October/).getAttribute("aria-checked")).toBe("true");
      expect(fillOf("back", "lats")).toContain("fill-heat-5");
      expect(fillOf("front", "biceps")).toContain("fill-heat-5");
      expect(fillOf("back", "delt_rear")).toContain("fill-heat-4");
      expect(fillOf("front", "delt_front")).toContain("fill-heat-2");
      expect(fillOf("front", "chest_upper")).toContain("fill-heat-1");
      expect(fillOf("front", "quads")).toContain("fill-heat-0");
    });

    it("should read now again when today is chosen", () => {
      render(<BodyMapScreen />);
      pickDay(/^Tuesday 13 October/);
      reads.asked = [];

      pickDay(/^Thursday 15 October/);

      expect(within(viewLabel()).getByText("Now · Thu 15 Oct, 19:00")).toBeTruthy();
      expect(reads.asked.every(({ at }) => at === undefined)).toBe(true);
    });

    it("should make no request and show no skeleton when the day changes", () => {
      render(<BodyMapScreen />);
      const asked = readsAskedOnce();

      pickDay(/^Tuesday 13 October/);
      pickDay(/^Wednesday 14 October/);
      pickDay(/^Thursday 15 October/);

      expect(loading()).toBeNull();
      expect(reads.asked.every(({ enabled }) => enabled !== false)).toBe(true);
      // A day is a different moment of the same cached rows, so only the moment asked of them changes.
      expect([...readsAskedOnce()].filter((read) => !asked.has(read))).toStrictEqual([
        "heat:actual@2026-10-13",
        "heat:projected@2026-10-13",
        "heat:actual@2026-10-14",
        "heat:projected@2026-10-14",
      ]);
    });
  });

  describe("Projected on Sunday 18 October at 20:00", () => {
    it("should fill the muscles with the steps core pins and say what it assumes", () => {
      render(<BodyMapScreen />);

      fireEvent.click(toggle());
      pickDay(/^Sunday 18 October/);

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      expect(
        within(viewLabel()).getByText("Sun 18 Oct, 20:00 · if you do Saturday's Push"),
      ).toBeTruthy();
      expect(fillOf("front", "delt_front", "Projected")).toContain("fill-heat-2");
      expect(fillOf("back", "triceps", "Projected")).toContain("fill-heat-2");
      expect(fillOf("front", "quads", "Projected")).toContain("fill-heat-1");
      expect(fillOf("back", "hamstrings", "Projected")).toContain("fill-heat-1");
      expect(fillOf("front", "chest_upper", "Projected")).toContain("fill-heat-1");
      expect(fillOf("back", "lats", "Projected")).toContain("fill-heat-0");
    });

    it("should not read Actual at a day after today", () => {
      render(<BodyMapScreen />);

      fireEvent.click(toggle());
      pickDay(/^Sunday 18 October/);

      expect(
        reads.asked.filter(({ view, at }) => view === "actual" && at === "2026-10-18"),
      ).toEqual([]);
    });

    it("should leave the day behind for today when Actual is shown again", () => {
      render(<BodyMapScreen />);
      fireEvent.click(toggle());
      pickDay(/^Sunday 18 October/);

      fireEvent.click(toggle());

      expect(within(viewLabel()).getByText("Now · Thu 15 Oct, 19:00")).toBeTruthy();
      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("true");
      // The day is gone for good, and not back when Projected is shown again.
      fireEvent.click(toggle());
      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("Projected today", () => {
    it("should equal Actual, keep the line that says why, and drop it on another day", () => {
      render(<BodyMapScreen />);

      fireEvent.click(toggle());

      expect(within(viewLabel()).getByText("Now · Thu 15 Oct, 19:00")).toBeTruthy();
      expect(screen.getByText(BODY_MAP.notes.todayProjected)).toBeTruthy();
      expect(fillOf("front", "quads", "Projected")).toContain("fill-heat-3");
      pickDay(/^Sunday 18 October/);
      expect(screen.queryByText(BODY_MAP.notes.todayProjected)).toBeNull();
    });
  });

  describe("the day across the other scales", () => {
    it("should keep the day on Volume and Gap and show it again on Heat, with no request", () => {
      render(<BodyMapScreen />);
      fireEvent.click(toggle());
      pickDay(/^Sunday 18 October/);
      const asked = readsAskedOnce();

      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.volume }));
      expect(within(viewLabel()).queryByText(/^Sun 18 Oct/)).toBeNull();
      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.gap }));
      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.heat }));

      expect(dayButton(/^Sunday 18 October/).getAttribute("aria-checked")).toBe("true");
      expect(within(viewLabel()).getByText(/^Sun 18 Oct, 20:00/)).toBeTruthy();
      expect(loading()).toBeNull();
      expect(readsAskedOnce()).toStrictEqual(asked);
      // Volume and Gap are read for now, whatever the day.
      expect(
        reads.asked.filter(({ scale, at }) => scale !== "heat" && at !== undefined),
      ).toStrictEqual([]);
    });
  });

  describe("the day on Volume and Gap", () => {
    it("should read the rows, the sheet and the figures of Volume and Gap with no day", () => {
      render(<BodyMapScreen />);
      pickDay(/^Tuesday 13 October/);

      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.volume }));
      fireEvent.keyDown(
        within(screen.getByRole("group", { name: /Actual, weekly sets, front/ })).getAllByRole(
          "button",
        )[0] ?? document.body,
        { key: "Enter" },
      );
      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.gap }));

      expect(reads.scaleListAsked.length).toBeGreaterThan(0);
      expect(reads.scaleListAsked.every((asked) => asked["at"] === undefined)).toBe(true);
      expect(reads.detailAsked.length).toBeGreaterThan(0);
      expect(reads.detailAsked.at(-1)?.at).toBeUndefined();
      expect(
        reads.asked.filter(({ scale, at }) => scale !== "heat" && at !== undefined),
      ).toStrictEqual([]);
      expect(within(viewLabel()).queryByText(/Tue 13 Oct/)).toBeNull();
    });
  });

  describe("a pick of today", () => {
    it("should follow the clock past midnight, and never become yesterday", () => {
      render(<BodyMapScreen />);
      pickDay(/^Tuesday 13 October/);
      pickDay(/^Thursday 15 October/);

      // Five hours later it is Friday morning, and the minute clock has ticked.
      act(() => {
        vi.advanceTimersByTime(5 * 60 * 60 * 1000);
      });

      expect(dayButton(/^Friday 16 October/).getAttribute("aria-checked")).toBe("true");
      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("false");
    });
  });

  describe("the Muscles card, the muscle list link and the sheet", () => {
    it("should carry the day on screen to the list link, the list read and the sheet", () => {
      render(<BodyMapScreen />);
      const listLink = () => screen.getByRole("link", { name: BODY_MAP.muscleListButton });
      expect(listLink().getAttribute("href")).toBe("/body-map/muscles");

      pickDay(/^Tuesday 13 October/);
      fireEvent.keyDown(within(figure("back")).getByRole("button", { name: /^Lats,/ }), {
        key: "Enter",
      });

      expect(listLink().getAttribute("href")).toBe("/body-map/muscles?at=2026-10-13");
      expect(reads.listAsked.at(-1)).toStrictEqual({ view: "actual", at: "2026-10-13" });
      expect(reads.detailAsked.at(-1)).toStrictEqual({
        muscle: "lats",
        view: "actual",
        at: "2026-10-13",
      });
    });

    it("should read today again on today", () => {
      render(<BodyMapScreen />);
      pickDay(/^Tuesday 13 October/);
      pickDay(/^Thursday 15 October/);

      expect(reads.listAsked.at(-1)).toStrictEqual({ view: "actual", at: undefined });
      expect(
        screen.getByRole("link", { name: BODY_MAP.muscleListButton }).getAttribute("href"),
      ).toBe("/body-map/muscles");
    });
  });

  describe("the keyboard", () => {
    it("should put only the chosen day in the tab order", () => {
      render(<BodyMapScreen />);

      const tabIndexes = within(scrubber())
        .getAllByRole("radio")
        .map((day) => day.tabIndex);
      expect(tabIndexes).toStrictEqual([-1, -1, -1, 0, -1, -1, -1]);
    });

    it("should move on and choose the next day with the arrow keys, skipping days Actual cannot show", () => {
      render(<BodyMapScreen />);

      fireEvent.keyDown(dayButton(/^Thursday 15 October/), { key: "ArrowRight" });

      // Friday to Sunday are disabled in Actual, so it wraps to Monday.
      expect(dayButton(/^Monday 12 October/).getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(dayButton(/^Monday 12 October/));
      expect(dayButton(/^Monday 12 October/).tabIndex).toBe(0);
      expect(dayButton(/^Thursday 15 October/).tabIndex).toBe(-1);
      fireEvent.keyDown(dayButton(/^Monday 12 October/), { key: "ArrowLeft" });
      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("true");
    });

    it("should step through every day in Projected, and go to the ends with Home and End", () => {
      render(<BodyMapScreen />);
      fireEvent.click(toggle());

      fireEvent.keyDown(dayButton(/^Thursday 15 October/), { key: "ArrowRight" });
      expect(dayButton(/^Friday 16 October/).getAttribute("aria-checked")).toBe("true");
      fireEvent.keyDown(dayButton(/^Friday 16 October/), { key: "End" });
      expect(dayButton(/^Sunday 18 October/).getAttribute("aria-checked")).toBe("true");
      fireEvent.keyDown(dayButton(/^Sunday 18 October/), { key: "Home" });
      expect(dayButton(/^Monday 12 October/).getAttribute("aria-checked")).toBe("true");
    });
  });

  describe("the side by side view", () => {
    it("should draw the button at the card size, with the accent look only while it is on", () => {
      render(<BodyMapScreen />);

      expect(sideBySideButton().className).toContain("h-[40px]");
      expect(sideBySideButton().className).not.toContain("bg-accent-muted");
      fireEvent.click(sideBySideButton());
      expect(sideBySideButton().className).toContain("bg-accent-muted");
    });

    it("should offer the button on Heat only, not pressed, and press it", () => {
      render(<BodyMapScreen />);

      expect(sideBySideButton().getAttribute("aria-pressed")).toBe("false");
      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.volume }));
      expect(screen.queryByRole("button", { name: BODY_MAP.sideBySideName })).toBeNull();
    });

    it("should be off when there is no routine for Projected to show", () => {
      showGoldenWeek({ projectedAvailable: false });
      render(<BodyMapScreen />);

      expect(sideBySideButton()).toHaveProperty("disabled", true);
    });

    it("should draw Actual and Projected together, front only, with one Front and Back switch", () => {
      render(<BodyMapScreen />);

      fireEvent.click(sideBySideButton());

      expect(sideBySideButton().getAttribute("aria-pressed")).toBe("true");
      expect(figure("front", "Actual")).toBeTruthy();
      expect(figure("front", "Projected")).toBeTruthy();
      expect(screen.queryByRole("group", { name: /heat, back$/ })).toBeNull();
      expect(screen.queryByRole("img", { name: /heat, back$/, hidden: true })).toBeNull();
      const sides = within(screen.getByRole("radiogroup", { name: BODY_MAP.sideSwitch.name }));
      expect(sides.getByRole("radio", { name: "Front" })).toHaveProperty("checked", true);
      expect(screen.queryByRole("button", { name: /^Show (projected|actual)$/ })).toBeNull();
      fireEvent.click(sides.getByRole("radio", { name: "Back" }));
      expect(figure("back", "Actual")).toBeTruthy();
      expect(figure("back", "Projected")).toBeTruthy();
      expect(screen.queryByRole("group", { name: /heat, front$/ })).toBeNull();
    });

    it("should say the moment of Actual and what Projected assumes under the figures", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());

      // Today assumes nothing, so Projected says its moment.
      expect(screen.getAllByText("Now · Thu 15 Oct, 19:00")).toHaveLength(2);

      pickDay(/^Sunday 18 October/);

      expect(screen.getByText("Sun 18 Oct, 20:00")).toBeTruthy();
      expect(screen.getByText("If you do Saturday's Push")).toBeTruthy();
    });

    it("should enable every day, and fill both figures with the steps core pins on Sunday", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());

      pickDay(/^Sunday 18 October/);

      expect(reads.asked.some(({ view, at }) => view === "actual" && at === "2026-10-18")).toBe(
        true,
      );
      expect(fillOf("front", "quads", "Actual")).toContain("fill-heat-1");
      expect(fillOf("front", "chest_upper", "Actual")).toContain("fill-heat-0");
      expect(fillOf("front", "chest_upper", "Projected")).toContain("fill-heat-1");
      expect(fillOf("front", "delt_front", "Projected")).toContain("fill-heat-2");
    });

    it("should keep a Saturday picked from Actual, not fall back to today", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());

      pickDay(/^Saturday 17 October/);

      expect(dayButton(/^Saturday 17 October/).getAttribute("aria-checked")).toBe("true");
      expect(screen.getByText("Sat 17 Oct, 20:00")).toBeTruthy();
      expect(screen.getByText("If you do Saturday's Push")).toBeTruthy();
      expect(screen.queryByText("Now · Thu 15 Oct, 19:00")).toBeNull();
    });

    it("should say tapping the figures changes nothing, and change nothing when one is clicked", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());
      const stored = window.localStorage.getItem("bodyMap.view");

      expect(screen.getByText(BODY_MAP.notes.sideBySide)).toBeTruthy();
      fireEvent.click(figure("front", "Actual"));
      fireEvent.click(
        within(figure("front", "Projected")).getByRole("button", { name: /^Quads,/ }),
      );

      expect(window.localStorage.getItem("bodyMap.view")).toBe(stored);
      expect(sideBySideButton().getAttribute("aria-pressed")).toBe("true");
      expect(screen.getAllByText("Now · Thu 15 Oct, 19:00")).toHaveLength(2);
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should open the sheet of the figure Enter was pressed on, at the day on screen", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());
      pickDay(/^Sunday 18 October/);

      fireEvent.keyDown(
        within(figure("front", "Projected")).getByRole("button", { name: /^Quads,/ }),
        {
          key: "Enter",
        },
      );
      expect(reads.detailAsked.at(-1)).toStrictEqual({
        muscle: "quads",
        view: "projected",
        at: "2026-10-18",
      });

      fireEvent.keyDown(document, { key: "Escape" });
      fireEvent.keyDown(
        within(figure("front", "Actual")).getByRole("button", { name: /^Quads,/ }),
        {
          key: "Enter",
        },
      );
      expect(reads.detailAsked.at(-1)).toStrictEqual({
        muscle: "quads",
        view: "actual",
        at: "2026-10-18",
      });
    });

    it("should leave the Muscles card out", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());

      expect(screen.queryByRole("link", { name: BODY_MAP.muscleListButton })).toBeNull();
    });

    it("should switch on and off with no request and no skeleton", () => {
      render(<BodyMapScreen />);
      const asked = readsAskedOnce();

      fireEvent.click(sideBySideButton());
      fireEvent.click(sideBySideButton());

      expect(loading()).toBeNull();
      expect(readsAskedOnce()).toStrictEqual(asked);
      expect(reads.asked.every(({ enabled }) => enabled !== false)).toBe(true);
    });

    it("should leave a day after today behind when turned off in Actual, and keep it in Projected", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());
      pickDay(/^Sunday 18 October/);

      fireEvent.click(sideBySideButton());

      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("true");
      // The day is gone for good, and not back when Projected is shown.
      fireEvent.click(toggle());
      expect(dayButton(/^Thursday 15 October/).getAttribute("aria-checked")).toBe("true");
      fireEvent.click(sideBySideButton());
      pickDay(/^Sunday 18 October/);
      fireEvent.click(sideBySideButton());
      expect(dayButton(/^Sunday 18 October/).getAttribute("aria-checked")).toBe("true");
    });

    it("should go when the scale leaves Heat, and be off on returning", () => {
      render(<BodyMapScreen />);
      fireEvent.click(sideBySideButton());

      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.volume }));
      fireEvent.click(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.heat }));

      expect(sideBySideButton().getAttribute("aria-pressed")).toBe("false");
      expect(figure("back", "Actual")).toBeTruthy();
    });
  });

  describe("offline", () => {
    it("should say the body map is not available, not wait for ever, when nothing was read", () => {
      reads.byRead = {};
      onlineManager.setOnline(false);
      // The hook is paused offline and gives nothing, which is what an unread map looks like to the screen.
      window.dispatchEvent(new Event("offline"));

      render(<BodyMapScreen />);

      expect(loading()).toBeNull();
      expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(screen.queryByRole("radiogroup", { name: BODY_MAP.scrubber.name })).toBeNull();
    });
  });
});
