import { RESTING_HEAT } from "@keylow/api-client";
import {
  BODY_MAP,
  MUSCLE_NAMES,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
  TRAIN_START_FAILED,
  describeGap,
} from "@keylow/core/copy";
import { BODY_ARTWORK, GAP_VALUES, MUSCLE_IDS, VOLUME_STATUSES } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  render as renderIn,
  screen,
  within,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { BodyMapView } from "@keylow/core/training";
import type { ReactElement } from "react";

import { BodyMapScreen } from "@/components/body/BodyMapScreen";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

type BodyMapRead = TrainingReadResult<BodyMap>;

const router = vi.hoisted(() => ({
  back: vi.fn<() => void>(),
  push: vi.fn<(href: string) => void>(),
}));
const sessionStart = vi.hoisted(() => ({
  start: vi.fn<(request: { routineDayId: string | null; timeZone: string }) => void>(),
  notices: { onStarted: (): void => undefined, onFailure: (): void => undefined },
}));
const reads = vi.hoisted(
  (): {
    // Each body map read by its scale and view, as "heat:actual".
    byRead: Record<string, unknown>;
    asked: { view: string; scale: string; enabled: boolean | undefined }[];
    detailAsked: { muscle: string; view: string }[];
    listAsked: (boolean | undefined)[];
    scaleListAsked: { scale: string; enabled: boolean | undefined }[];
    zone: unknown;
  } => ({
    byRead: {},
    asked: [],
    detailAsked: [],
    listAsked: [],
    scaleListAsked: [],
    zone: undefined,
  }),
);

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => reads.zone,
  useStartSessionAction: (notices: typeof sessionStart.notices) => {
    sessionStart.notices = notices;
    return { start: sessionStart.start, isStarting: false };
  },
  // A read switched off gives nothing, as the real hook does, so a skeleton shows if a scale is not read.
  useBodyMap: ({
    view,
    scale,
    enabled,
  }: {
    view: string;
    scale: string;
    enabled?: boolean | undefined;
  }) => {
    reads.asked.push({ view, scale, enabled });
    return enabled === false ? pending : reads.byRead[`${scale}:${view}`];
  },
  useMuscleDetail: (muscle: string, { view }: { view: string }) => {
    reads.detailAsked.push({ muscle, view });
    return pending;
  },
  useActiveRoutine: () => ({ data: null }),
  // The Muscles card has its own test files, so the lists are never read here.
  useMuscleList: ({ enabled }: { enabled?: boolean | undefined }) => {
    reads.listAsked.push(enabled);
    return {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: () => Promise.resolve(),
    };
  },
  useMuscleScaleList: ({ scale, enabled }: { scale: string; enabled?: boolean | undefined }) => {
    reads.scaleListAsked.push({ scale, enabled });
    return {
      data: undefined,
      isPending: true,
      isError: false,
      error: null,
      refetch: () => Promise.resolve(),
    };
  },
}));

// The dashboard layout holds the toast provider the screen's failure toast needs.
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
const failed: BodyMapRead = {
  data: undefined,
  isPending: false,
  isError: true,
  error: new Error("read failed"),
  refetch,
};

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";
const goldenActual: BodyMap = {
  values: {
    ...RESTING_HEAT,
    chest_upper: 1,
    chest_lower: 1,
    delt_rear: 1,
    lats: 2,
    traps_mid: 1,
    lower_back: 2,
    biceps: 1,
    triceps: 1,
    glute_max: 3,
    quads: 3,
    hamstrings: 3,
    calves: 2,
  },
  computedAt: THURSDAY_19_00,
  days: [],
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};
const goldenProjected: BodyMap = {
  ...goldenActual,
  values: { ...goldenActual.values, lats: 5, quads: 4 },
};

// Every scale is read from the same rows, so by default all of them give what Heat does.
function show(actual: BodyMapRead, projected: BodyMapRead = actual) {
  reads.byRead = {
    "heat:actual": actual,
    "heat:projected": projected,
    "volume:actual": actual,
    "volume:projected": projected,
    "gap:actual": actual,
  };
}

// One scale's reads, for the tests where the scales differ. Gap has no Projected.
function showScale(scale: "volume" | "gap", actual: BodyMapRead, projected: BodyMapRead = actual) {
  reads.byRead[`${scale}:actual`] = actual;
  if (scale === "volume") {
    reads.byRead["volume:projected"] = projected;
  }
}

// The shown view's figures are groups of muscle buttons and the other view's are plain images hidden from a
// screen reader.
const figure = (side: "front" | "back", view = "Actual") => {
  const name = `Body map, ${view}, heat, ${side}`;
  return screen.queryByRole("group", { name }) ?? screen.getByRole("img", { name, hidden: true });
};
const fillOf = (side: "front" | "back", path: string, view = "Actual") =>
  figure(side, view).querySelector(`path[d="${path}"]:not([aria-hidden])`)?.getAttribute("class") ??
  "";
const toggle = () => screen.getByRole("button", { name: /^Show (projected|actual)$/ });
const viewLabel = () =>
  within(screen.getByRole("region", { name: BODY_MAP.title })).getByRole("status");

describe("BodyMapScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    window.localStorage.clear();
    // The figure question was answered on an earlier visit, so only the tests of the setting see it.
    window.localStorage.setItem("bodyMap.figure", "male");
    // The first-open hint was dismissed on an earlier visit, so only its own tests see it.
    window.localStorage.setItem("bodyMap.hintSeen", "true");
    resetBodyFigureForTests();
    onlineManager.setOnline(true);
    reads.asked = [];
    reads.detailAsked = [];
    reads.listAsked = [];
    reads.scaleListAsked = [];
    reads.zone = { data: "Europe/London" };
    show(read(goldenActual), read(goldenProjected));
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(window, "navigation");
    vi.useRealTimers();
    vi.restoreAllMocks();
    router.back.mockReset();
    router.push.mockReset();
    sessionStart.start.mockReset();
    refetch.mockClear();
    onlineManager.setOnline(true);
  });

  describe("the page", () => {
    it("should title itself Body map at level one", () => {
      render(<BodyMapScreen />);

      expect(screen.getByRole("heading", { level: 1, name: BODY_MAP.title })).toBeTruthy();
    });

    it("should open on Heat, with the Heat legend", () => {
      render(<BodyMapScreen />);

      expect(screen.getByRole("radio", { name: BODY_MAP.scaleSwitch.heat })).toHaveProperty(
        "checked",
        true,
      );
      expect(screen.getByRole("region", { name: BODY_MAP.legendNames.heat })).toBeTruthy();
    });
  });

  describe("Actual heat on Thursday at 19:00", () => {
    it("should label the view Actual, and say it is now, in a live region", () => {
      render(<BodyMapScreen />);

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
      expect(within(viewLabel()).getByText("Now · Thu 15 Oct, 19:00")).toBeTruthy();
    });

    it("should fill the muscles at the steps of the board, front and back", () => {
      render(<BodyMapScreen />);

      const { front, back } = BODY_ARTWORK.male;
      expect(fillOf("front", front.muscles.chest_upper)).toContain("fill-heat-1");
      expect(fillOf("front", front.muscles.quads)).toContain("fill-heat-3");
      expect(fillOf("front", front.muscles.biceps)).toContain("fill-heat-1");
      expect(fillOf("front", front.muscles.delt_front)).toContain("fill-heat-0");
      expect(fillOf("back", back.muscles.lats)).toContain("fill-heat-2");
      expect(fillOf("back", back.muscles.hamstrings)).toContain("fill-heat-3");
      expect(fillOf("back", back.muscles.calves)).toContain("fill-heat-2");
      expect(fillOf("back", back.muscles.lower_back)).toContain("fill-heat-2");
    });

    it("should name each figure and put Front and Back under them", () => {
      render(<BodyMapScreen />);

      expect(figure("front")).toBeTruthy();
      expect(figure("back")).toBeTruthy();
      expect(screen.getByText(BODY_MAP.sideSwitch.front)).toBeTruthy();
      // The Back link and the name under the back figure.
      expect(screen.getAllByText(BODY_MAP.sideSwitch.back)).toHaveLength(2);
    });

    it("should draw the shown figures as groups of muscle buttons", () => {
      render(<BodyMapScreen />);

      expect(screen.getByRole("group", { name: "Body map, Actual, heat, front" })).toBeTruthy();
      expect(screen.getByRole("group", { name: "Body map, Actual, heat, back" })).toBeTruthy();
    });

    it("should colour the legend swatches from the rested step up to the peak, in order", () => {
      render(<BodyMapScreen />);

      const legend = screen.getByRole("region", { name: BODY_MAP.legendNames.heat });
      // The swatches are decorative and hidden from a screen reader, so they are found by that.
      const swatches = Array.from(legend.querySelectorAll('span[aria-hidden="true"]'));
      expect(swatches).toHaveLength(6);
      swatches.forEach((swatch, step) => {
        expect(swatch.classList.contains(`bg-heat-${step}`)).toBe(true);
      });
    });

    it("should draw the heat legend with its six steps and the web caption", () => {
      render(<BodyMapScreen />);

      const legend = screen.getByRole("region", { name: BODY_MAP.legendNames.heat });
      expect(within(legend).getByRole("heading", { name: BODY_MAP.scaleSwitch.heat })).toBeTruthy();
      for (const step of ["Rested", "Ready", "Warm", "Hot", "Very hot", "Peak"]) {
        expect(within(legend).getByText(step)).toBeTruthy();
      }
      expect(
        within(legend).getByText(
          "How hard and how recently each muscle worked. It cools as you recover. Press and hold a muscle, or pick it below, for its details.",
        ),
      ).toBeTruthy();
    });
  });

  describe("the scales", () => {
    const SUNDAY_20_00 = "2026-10-18T19:00:00.000Z";
    const volumeAt = (status: (typeof VOLUME_STATUSES)[number]) => VOLUME_STATUSES.indexOf(status);
    const gapAt = (value: (typeof GAP_VALUES)[number]) => GAP_VALUES.indexOf(value);
    const dayOf = (date: string, status: BodyMapDay["status"], plannedDayName: string | null) => ({
      date,
      at: `${date}T19:00:00.000Z`,
      isToday: false,
      status,
      plannedDayName,
      sessionDayName: null,
      selectable: true,
    });
    // Saturday's Push was planned and not done.
    const week: BodyMapDay[] = [
      dayOf("2026-10-12", "logged", "Push"),
      dayOf("2026-10-16", "rest", null),
      dayOf("2026-10-17", "missed", "Push"),
      dayOf("2026-10-18", "rest", null),
    ];
    const sundayVolume: BodyMap = {
      ...goldenActual,
      values: {
        ...RESTING_HEAT,
        lats: volumeAt("productive"),
        quads: volumeAt("growing"),
        calves: volumeAt("maintaining"),
        triceps: volumeAt("high"),
      },
      computedAt: SUNDAY_20_00,
      days: week,
    };
    const sundayGap: BodyMap = {
      ...goldenActual,
      values: {
        ...RESTING_HEAT,
        lats: gapAt("on_plan"),
        triceps: gapAt("behind"),
        quads: gapAt("ahead"),
        neck: gapAt("not_in_plan"),
      },
      computedAt: SUNDAY_20_00,
      days: week,
    };
    const scaleSwitch = () => screen.getByRole("radiogroup", { name: BODY_MAP.scaleSwitch.name });
    const chooseScale = (name: string) => {
      fireEvent.click(within(scaleSwitch()).getByRole("radio", { name }));
    };
    const figureOf = (scale: string, side: "front" | "back", view: string) =>
      screen.getByRole("group", { name: `Body map, ${view}, ${scale}, ${side}` });
    const fillClassOf = (figureElement: HTMLElement, path: string) =>
      figureElement.querySelector(`path[d="${path}"]:not([aria-hidden])`)?.getAttribute("class") ??
      "";
    const legendNamesOf = (legend: HTMLElement) =>
      within(legend)
        .getAllByRole("listitem")
        .map((item) => item.textContent);
    const swatchClassOf = (legend: HTMLElement, position: number) =>
      within(legend).getAllByRole("listitem")[position]?.querySelector('[aria-hidden="true"]')
        ?.className ?? "";
    const musclesCard = () => screen.queryByRole("link", { name: BODY_MAP.muscleListButton });

    describe("the switch", () => {
      it("should offer Heat, Volume and Gap in a group named Scale, on Heat", () => {
        render(<BodyMapScreen />);

        const options = within(scaleSwitch()).getAllByRole("radio");
        expect(options.map((option) => option.closest("label")?.textContent)).toStrictEqual([
          "Heat",
          "Volume",
          "Gap",
        ]);
        expect(within(scaleSwitch()).getByRole("radio", { name: "Heat" })).toHaveProperty(
          "checked",
          true,
        );
      });

      it("should open on Volume when the link names it", () => {
        render(<BodyMapScreen initialScale="volume" />);

        expect(within(scaleSwitch()).getByRole("radio", { name: "Volume" })).toHaveProperty(
          "checked",
          true,
        );
        expect(screen.getByRole("region", { name: BODY_MAP.legendNames.volume })).toBeTruthy();
      });

      it("should read every scale at once and switch with no request and no skeleton", () => {
        render(<BodyMapScreen />);
        const readsOnOpen = new Set(reads.asked.map(({ scale, view }) => `${scale}:${view}`));
        const loading = () =>
          screen.queryByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel });

        expect(readsOnOpen).toStrictEqual(
          new Set([
            "heat:actual",
            "heat:projected",
            "volume:actual",
            "volume:projected",
            "gap:actual",
          ]),
        );
        expect(reads.asked.every(({ enabled }) => enabled !== false)).toBe(true);
        expect(reads.scaleListAsked.every(({ enabled }) => enabled !== false)).toBe(true);
        for (const name of ["Volume", "Gap", "Heat"]) {
          chooseScale(name);
          expect(loading()).toBeNull();
        }
        expect(new Set(reads.asked.map(({ scale, view }) => `${scale}:${view}`))).toStrictEqual(
          readsOnOpen,
        );
        expect(reads.asked.every(({ enabled }) => enabled !== false)).toBe(true);
        // The card's rows are the scale on screen's, read from the same rows and never switched off.
        expect(reads.scaleListAsked.map(({ scale }) => scale)).toContain("gap");
        expect(reads.scaleListAsked.every(({ enabled }) => enabled !== false)).toBe(true);
      });

      it("should not remember the scale for the next visit", () => {
        const first = render(<BodyMapScreen />);
        chooseScale("Volume");
        first.unmount();

        render(<BodyMapScreen />);

        expect(within(scaleSwitch()).getByRole("radio", { name: "Heat" })).toHaveProperty(
          "checked",
          true,
        );
      });
    });

    describe("Volume", () => {
      beforeEach(() => {
        showScale("volume", read(sundayVolume));
      });

      it("should draw the legend of the five bands in order, each with its name, and the caption", () => {
        render(<BodyMapScreen initialScale="volume" />);

        const legend = screen.getByRole("region", { name: BODY_MAP.legendNames.volume });
        expect(within(legend).getByRole("heading", { name: "Volume" })).toBeTruthy();
        expect(legendNamesOf(legend)).toStrictEqual([
          "Not trained",
          "Maintaining",
          "Growing",
          "Productive",
          "High",
        ]);
        [
          "bg-volume-not-trained",
          "bg-volume-maintaining",
          "bg-volume-growing",
          "bg-volume-productive",
          "bg-volume-high",
        ].forEach((swatchClass, position) => {
          expect(swatchClassOf(legend, position)).toContain(swatchClass);
        });
        expect(
          within(legend).getByText(
            "Sets this week, Monday to Sunday. Growing starts at 4 sets, Productive at 10 and High above 20.",
          ),
        ).toBeTruthy();
      });

      it("should fill the muscles from the Volume read, and name the value of each as well", () => {
        render(<BodyMapScreen initialScale="volume" />);

        const { front, back } = BODY_ARTWORK.male;
        const frontFigure = figureOf("weekly sets", "front", "Actual");
        const backFigure = figureOf("weekly sets", "back", "Actual");
        expect(fillClassOf(frontFigure, front.muscles.quads)).toContain("fill-volume-growing");
        expect(fillClassOf(backFigure, back.muscles.triceps)).toContain("fill-volume-high");
        expect(fillClassOf(backFigure, back.muscles.lats)).toContain("fill-volume-productive");
        expect(within(backFigure).getByRole("button", { name: "Lats, Productive" })).toBeTruthy();
      });

      it("should keep the Actual and Projected toggle, which reads the Projected sets", () => {
        showScale(
          "volume",
          read(sundayVolume),
          read({ ...sundayVolume, values: { ...sundayVolume.values, lats: volumeAt("high") } }),
        );
        render(<BodyMapScreen initialScale="volume" />);

        fireEvent.click(toggle());

        expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
        const projectedLats = figureOf("weekly sets", "back", "Projected");
        expect(fillClassOf(projectedLats, BODY_ARTWORK.male.back.muscles.lats)).toContain(
          "fill-volume-high",
        );
      });

      it("should say the sets so far in Actual and the projected sets by Sunday in Projected", () => {
        render(<BodyMapScreen initialScale="volume" />);
        expect(within(viewLabel()).getByText(/^This week · as of /)).toBeTruthy();

        fireEvent.click(toggle());

        expect(within(viewLabel()).getByText("By Sun 18 Oct, if you follow the plan")).toBeTruthy();
      });

      it("should keep the Muscle list link, which opens Heat's list, while the rows are not read", () => {
        render(<BodyMapScreen initialScale="volume" />);

        expect(musclesCard()?.getAttribute("href")).toBe("/body-map/muscles");
        expect(screen.queryByRole("heading", { name: BODY_MAP.listTitle })).toBeNull();
      });

      it("should keep reading the muscle list, so the Muscles card comes back whole on Heat", () => {
        render(<BodyMapScreen initialScale="volume" />);

        expect(reads.listAsked.length).toBeGreaterThan(0);
        expect(reads.listAsked.every((enabled) => enabled !== false)).toBe(true);
      });

      it("should not show the nothing logged state, which belongs to Heat", () => {
        showScale("volume", read({ ...sundayVolume, nothingLogged: true }));
        render(<BodyMapScreen initialScale="volume" />);

        expect(screen.queryByRole("heading", { name: BODY_MAP.emptyState.title })).toBeNull();
        expect(screen.queryByText(/^Nothing logged/)).toBeNull();
        expect(screen.getByRole("region", { name: BODY_MAP.legendNames.volume })).toBeTruthy();
      });

      it("should say Projected needs a routine when there is none, and keep Actual", () => {
        showScale("volume", read({ ...sundayVolume, projectedAvailable: false }));
        render(<BodyMapScreen initialScale="volume" />);

        expect(toggle().hasAttribute("disabled")).toBe(true);
        expect(screen.getByText(BODY_MAP.toggle.projectedNeedsRoutine)).toBeTruthy();
      });
    });

    describe("Gap", () => {
      beforeEach(() => {
        window.localStorage.setItem("bodyMap.view", "projected" satisfies BodyMapView);
        showScale("gap", read(sundayGap));
      });

      it("should draw the legend of the four values in order, and the caption", () => {
        render(<BodyMapScreen />);
        chooseScale("Gap");

        const legend = screen.getByRole("region", { name: BODY_MAP.legendNames.gap });
        expect(within(legend).getByRole("heading", { name: "Gap" })).toBeTruthy();
        expect(legendNamesOf(legend)).toStrictEqual(["Not in plan", "Behind", "On plan", "Ahead"]);
        ["bg-volume-not-trained", "bg-gap-behind", "bg-gap-on-plan", "bg-gap-ahead"].forEach(
          (swatchClass, position) => {
            expect(swatchClassOf(legend, position)).toContain(swatchClass);
          },
        );
        expect(
          within(legend).getByText(
            "Sets done against your plan for the week. On plan means within 1 set.",
          ),
        ).toBeTruthy();
      });

      it("should fill the muscles from the Gap read, named Done against plan", () => {
        render(<BodyMapScreen />);
        chooseScale("Gap");

        const { front, back } = BODY_ARTWORK.male;
        const frontFigure = figureOf("gap", "front", "Done against plan");
        const backFigure = figureOf("gap", "back", "Done against plan");
        expect(fillClassOf(backFigure, back.muscles.triceps)).toContain("fill-gap-behind");
        expect(fillClassOf(frontFigure, front.muscles.quads)).toContain("fill-gap-ahead");
        expect(fillClassOf(backFigure, back.muscles.lats)).toContain("fill-gap-on-plan");
        expect(within(viewLabel()).getByText("Done against plan")).toBeTruthy();
      });

      it("should have no toggle, and a click on the figures does nothing and leaves the saved view", () => {
        render(<BodyMapScreen />);
        chooseScale("Gap");

        expect(screen.queryByRole("button", { name: /^Show (projected|actual)$/ })).toBeNull();
        fireEvent.click(figureOf("gap", "front", "Done against plan"));

        expect(within(viewLabel()).getByText("Done against plan")).toBeTruthy();
        expect(window.localStorage.getItem("bodyMap.view")).toBe("projected");
        chooseScale("Heat");
        expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      });

      it("should show the note under the figures: the missed session, and that the week is still on", () => {
        render(<BodyMapScreen />);
        chooseScale("Gap");

        const note = describeGap({ values: sundayGap.values, days: week, countsWholeWeek: false });
        expect(note).toContain("Push was missed");
        expect(screen.getByText(note)).toBeTruthy();
        expect(screen.getByText(note).textContent).toContain(BODY_MAP.notes.gapSoFar);
      });

      it("should count the whole week from Sunday, so the note no longer says the week is on", () => {
        vi.setSystemTime(new Date(SUNDAY_20_00));
        render(<BodyMapScreen />);
        chooseScale("Gap");

        const note = describeGap({ values: sundayGap.values, days: week, countsWholeWeek: true });
        expect(screen.getByText(note)).toBeTruthy();
        expect(note).not.toContain(BODY_MAP.notes.gapSoFar);
      });

      it("should not show the nothing logged state, which belongs to Heat", () => {
        showScale("gap", read({ ...sundayGap, nothingLogged: true }));
        render(<BodyMapScreen />);
        chooseScale("Gap");

        expect(screen.queryByRole("heading", { name: BODY_MAP.emptyState.title })).toBeNull();
        expect(screen.queryByText(/^Nothing logged/)).toBeNull();
      });

      it("should keep the Muscle list link on every scale, opening the same page", () => {
        render(<BodyMapScreen />);
        expect(musclesCard()?.getAttribute("href")).toBe("/body-map/muscles");

        chooseScale("Gap");
        expect(musclesCard()?.getAttribute("href")).toBe("/body-map/muscles");

        chooseScale("Heat");
        expect(musclesCard()?.getAttribute("href")).toBe("/body-map/muscles");
      });

      it("should open the sheet of a muscle on Actual, whatever view is saved", () => {
        render(<BodyMapScreen />);
        chooseScale("Gap");

        fireEvent.keyDown(
          within(figureOf("gap", "back", "Done against plan")).getByRole("button", {
            name: /^Lats, /,
          }),
          { key: "Enter" },
        );

        expect(screen.getByRole("dialog", { name: MUSCLE_NAMES.lats })).toBeTruthy();
        expect(reads.detailAsked.at(-1)).toStrictEqual({ muscle: "lats", view: "actual" });
      });
    });

    describe("reaching every muscle", () => {
      it.each([["Volume"], ["Gap"]])(
        "should keep a button for each of the 22 muscles on the figures in %s, with its value named",
        (name) => {
          showScale("volume", read(sundayVolume));
          showScale("gap", read(sundayGap));
          render(<BodyMapScreen />);
          chooseScale(name);

          const buttons = screen
            .getAllByRole("button", { name: /^[A-Za-z ]+, [A-Za-z ]+$/ })
            .map((button) => button.getAttribute("aria-label"));
          for (const muscle of MUSCLE_IDS) {
            expect(buttons.some((label) => label?.startsWith(`${MUSCLE_NAMES[muscle]}, `))).toBe(
              true,
            );
          }
        },
      );

      it("should open the sheet of a muscle on Volume in the view shown", () => {
        window.localStorage.setItem("bodyMap.view", "projected" satisfies BodyMapView);
        showScale("volume", read(sundayVolume));
        render(<BodyMapScreen initialScale="volume" />);

        fireEvent.keyDown(
          within(figureOf("weekly sets", "back", "Projected")).getByRole("button", {
            name: /^Lats, /,
          }),
          { key: "Enter" },
        );

        expect(reads.detailAsked.at(-1)).toStrictEqual({ muscle: "lats", view: "projected" });
      });
    });

    describe("while it loads, fails or is offline", () => {
      it("should say the body map is not available offline on Volume when nothing was read", () => {
        show(pending);
        onlineManager.setOnline(false);
        act(() => undefined);
        render(<BodyMapScreen initialScale="volume" />);

        expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
        expect(
          screen.queryByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
        ).toBeNull();
        expect(screen.queryByRole("radiogroup", { name: BODY_MAP.scaleSwitch.name })).toBeNull();
      });

      it("should say it too when Heat was read and the scale asked for is still waiting for a connection", () => {
        showScale("volume", pending);
        onlineManager.setOnline(false);
        act(() => undefined);
        render(<BodyMapScreen initialScale="volume" />);

        expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      });

      it("should read again the scale that failed on Try again", () => {
        showScale("volume", failed);
        render(<BodyMapScreen initialScale="volume" />);

        fireEvent.click(screen.getByRole("button", { name: TRAIN_ERROR.action }));

        expect(refetch).toHaveBeenCalled();
      });
    });
  });

  describe("the Back link", () => {
    it("should go to the dashboard when the page was opened directly", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(1);
      render(<BodyMapScreen />);

      const back = screen.getByRole("link", { name: BODY_MAP.back });
      expect(back.getAttribute("href")).toBe("/dashboard");
      fireEvent.click(back);
      expect(router.back).not.toHaveBeenCalled();
    });

    it("should return to the previous page when there is one", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(3);
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("link", { name: BODY_MAP.back }));

      expect(router.back).toHaveBeenCalledTimes(1);
    });

    it("should go to the dashboard when the browser says no page of the app came before, whatever the history holds", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(3);
      Object.defineProperty(window, "navigation", {
        value: { canGoBack: false },
        configurable: true,
      });
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("link", { name: BODY_MAP.back }));

      expect(router.back).not.toHaveBeenCalled();
    });

    it("should leave a click with a modifier key to the browser, which opens the dashboard in a new tab", () => {
      vi.spyOn(window.history, "length", "get").mockReturnValue(3);
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("link", { name: BODY_MAP.back }), { metaKey: true });

      expect(router.back).not.toHaveBeenCalled();
    });
  });

  describe("the view toggle", () => {
    it("should be named for the view it switches to", () => {
      render(<BodyMapScreen />);

      expect(toggle().textContent).toBe(BODY_MAP.toggle.showProjected);
    });

    it("should switch to Projected on a press of the button, announce it, and offer Show actual", () => {
      render(<BodyMapScreen />);

      fireEvent.click(toggle());

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      expect(toggle().textContent).toBe(BODY_MAP.toggle.showActual);
      expect(fillOf("back", BODY_ARTWORK.male.back.muscles.lats, "Projected")).toContain(
        "fill-heat-5",
      );
    });

    it("should switch on a click on a figure", () => {
      render(<BodyMapScreen />);

      fireEvent.click(figure("front"));

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      fireEvent.click(figure("back", "Projected"));
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should not switch on a drag across a figure", () => {
      render(<BodyMapScreen />);

      const front = figure("front");
      fireEvent.mouseDown(front, { clientX: 10, clientY: 10 });
      fireEvent.mouseUp(front, { clientX: 80, clientY: 90 });
      fireEvent.click(front, { clientX: 80, clientY: 90 });

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should say why Projected is what is logged today, in the board's words", () => {
      render(<BodyMapScreen />);
      expect(screen.queryByText(BODY_MAP.notes.todayProjected)).toBeNull();

      fireEvent.click(toggle());

      expect(screen.getByText(BODY_MAP.notes.todayProjected)).toBeTruthy();
    });

    it("should remember the view across a reload", () => {
      const first = render(<BodyMapScreen />);
      fireEvent.click(toggle());
      first.unmount();

      render(<BodyMapScreen />);

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      expect(toggle().textContent).toBe(BODY_MAP.toggle.showActual);
    });

    it("should open on Actual when the saved view is not one, or storage is blocked", () => {
      window.localStorage.setItem("bodyMap.view", "sideways");
      render(<BodyMapScreen />);
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
      cleanup();

      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      render(<BodyMapScreen />);
      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should hide the figures of the view that is not shown from a screen reader", () => {
      render(<BodyMapScreen />);
      expect(screen.queryByRole("img", { name: "Body map, Projected, heat, front" })).toBeNull();
      expect(screen.queryByRole("img", { name: "Body map, Projected, heat, back" })).toBeNull();

      fireEvent.click(toggle());

      expect(screen.queryByRole("img", { name: "Body map, Actual, heat, front" })).toBeNull();
      expect(screen.queryByRole("img", { name: "Body map, Actual, heat, back" })).toBeNull();
      expect(figure("front", "Projected")).toBeTruthy();
    });

    it("should still switch the view for the visit when the choice cannot be saved", () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      render(<BodyMapScreen />);

      fireEvent.click(toggle());

      expect(within(viewLabel()).getByText("Projected")).toBeTruthy();
      expect(toggle().textContent).toBe(BODY_MAP.toggle.showActual);
    });

    it("should draw the loading skeleton on the server, whatever view is saved", () => {
      window.localStorage.setItem("bodyMap.view", "projected" satisfies BodyMapView);

      const page = document.createElement("div");
      page.innerHTML = renderToString(
        <ToastProvider>
          <BodyMapScreen />
        </ToastProvider>,
      );

      expect(
        within(page).getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
      expect(within(page).queryByText("Actual")).toBeNull();
      expect(within(page).queryByText("Projected")).toBeNull();
      expect(within(page).queryByRole("button", { name: /^Show/ })).toBeNull();
    });

    it("should cross-fade the figures, and swap at once under reduced motion", () => {
      render(<BodyMapScreen />);

      const layer = figure("front").parentElement;
      expect(layer?.className).toContain("transition-opacity");
      expect(layer?.className).toContain("duration-standard");
      expect(layer?.className).toContain("motion-reduce:transition-none");
    });
  });

  describe("with no routine", () => {
    const noRoutine = { ...goldenActual, projectedAvailable: false };

    beforeEach(() => {
      show(read(noRoutine));
    });

    it("should disable the button and say Projected needs a routine", () => {
      render(<BodyMapScreen />);

      expect(toggle().hasAttribute("disabled")).toBe(true);
      expect(screen.getByText(BODY_MAP.toggle.projectedNeedsRoutine)).toBeTruthy();
    });

    it("should describe the disabled button by the line that says why", () => {
      render(<BodyMapScreen />);

      expect(
        screen.getByRole("button", {
          name: BODY_MAP.toggle.showProjected,
          description: BODY_MAP.toggle.projectedNeedsRoutine,
        }),
      ).toBeTruthy();
    });

    it("should still show Actual when Projected was saved", () => {
      window.localStorage.setItem("bodyMap.view", "projected" satisfies BodyMapView);
      render(<BodyMapScreen />);

      fireEvent.click(figure("front"));

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
    });

    it("should do nothing on a click on a figure, and leave the saved view as it was", () => {
      window.localStorage.setItem("bodyMap.view", "actual" satisfies BodyMapView);
      render(<BodyMapScreen />);

      fireEvent.click(figure("front"));

      expect(within(viewLabel()).getByText("Actual")).toBeTruthy();
      expect(window.localStorage.getItem("bodyMap.view")).toBe("actual");
    });
  });

  describe("with no sets", () => {
    beforeEach(() => {
      show(read({ ...goldenActual, values: RESTING_HEAT, nothingLogged: true }));
    });

    it("should say nothing is logged in the last 14 days under the label", () => {
      render(<BodyMapScreen />);

      expect(within(viewLabel()).getByText("Nothing logged in the last 14 days")).toBeTruthy();
    });

    it("should show the empty state and leave the legend out", () => {
      render(<BodyMapScreen />);

      expect(
        screen.getByRole("heading", { level: 2, name: BODY_MAP.emptyState.title }),
      ).toBeTruthy();
      expect(screen.getByText(BODY_MAP.emptyState.body)).toBeTruthy();
      expect(screen.queryByRole("region", { name: BODY_MAP.legendNames.heat })).toBeNull();
    });

    it("should offer no Start a session while there is something to show", () => {
      show(read(goldenActual));
      render(<BodyMapScreen />);

      expect(screen.queryByRole("button", { name: BODY_MAP.emptyState.action })).toBeNull();
    });

    it("should offer Start a session, which starts a free session in the profile's zone", () => {
      render(<BodyMapScreen />);

      fireEvent.click(screen.getByRole("button", { name: BODY_MAP.emptyState.action }));

      expect(sessionStart.start).toHaveBeenCalledWith({
        routineDayId: null,
        timeZone: "Europe/London",
      });
    });

    it("should open the session page once it has started", () => {
      render(<BodyMapScreen />);

      act(() => {
        sessionStart.notices.onStarted();
      });

      expect(router.push).toHaveBeenCalledWith("/train/session");
    });

    it("should say at the top that the start failed, and open nothing", () => {
      render(<BodyMapScreen />);

      act(() => {
        sessionStart.notices.onFailure();
      });

      expect(screen.getByText(TRAIN_START_FAILED)).toBeTruthy();
      expect(router.push).not.toHaveBeenCalled();
    });

    it("should still draw the figures at rest", () => {
      render(<BodyMapScreen />);

      expect(fillOf("front", BODY_ARTWORK.male.front.muscles.quads)).toContain("fill-heat-0");
    });
  });

  describe("while it loads, fails or is offline", () => {
    it("should show a labelled skeleton while the rows are read", () => {
      show(pending);
      render(<BodyMapScreen />);

      expect(
        screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Show/ })).toBeNull();
    });

    it("should say the read failed, and read again on Try again", () => {
      show(failed);
      render(<BodyMapScreen />);

      expect(screen.getByText(TRAIN_ERROR.title)).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: TRAIN_ERROR.action }));
      expect(refetch).toHaveBeenCalled();
    });

    it("should say the body map is not available offline when nothing was read", () => {
      show(pending);
      onlineManager.setOnline(false);
      act(() => undefined);
      render(<BodyMapScreen />);

      expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(screen.getByText(BODY_MAP.dashboardCard.offlineUnavailable)).toBeTruthy();
    });

    it("should keep the Back link in every state", () => {
      show(failed);
      render(<BodyMapScreen />);

      expect(screen.getByRole("link", { name: BODY_MAP.back })).toBeTruthy();
    });
  });
  describe("the figure setting", () => {
    const figureDialog = () =>
      screen.getByRole("dialog", { name: BODY_MAP.figureSetting.sheetTitle });
    const queryFigureDialog = () =>
      screen.queryByRole("dialog", { name: BODY_MAP.figureSetting.sheetTitle });
    const headerControl = () => screen.getByRole("button", { name: BODY_MAP.figureSetting.label });
    const chooseFemale = () => {
      fireEvent.click(within(figureDialog()).getByRole("radio", { name: "Female" }));
    };
    const closeFigureDialog = () => {
      fireEvent.click(
        within(figureDialog()).getByRole("button", { name: BODY_MAP.figureSetting.done }),
      );
    };
    const visitAgain = () => {
      cleanup();
      resetBodyFigureForTests();
      render(<BodyMapScreen />);
    };

    beforeEach(() => {
      window.localStorage.clear();
      resetBodyFigureForTests();
    });

    it("should ask on the first open, with the body map behind it", () => {
      render(<BodyMapScreen />);

      expect(figureDialog()).toBeTruthy();
      expect(
        within(figureDialog()).getByRole("radiogroup", { name: BODY_MAP.figureSetting.label }),
      ).toBeTruthy();
      expect(figure("front")).toBeTruthy();
    });

    it("should not ask when a figure is stored", () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      render(<BodyMapScreen />);

      expect(queryFigureDialog()).toBeNull();
    });

    it("should store Male when it is closed without a choice, and never ask again", () => {
      render(<BodyMapScreen />);

      closeFigureDialog();

      expect(queryFigureDialog()).toBeNull();
      expect(window.localStorage.getItem("bodyMap.figure")).toBe("male");
      visitAgain();
      expect(queryFigureDialog()).toBeNull();
    });

    it("should store Male when it is closed from the X button without a choice", () => {
      render(<BodyMapScreen />);

      fireEvent.click(within(figureDialog()).getByRole("button", { name: "Close" }));

      expect(queryFigureDialog()).toBeNull();
      expect(window.localStorage.getItem("bodyMap.figure")).toBe("male");
    });

    it("should store Male when the dimmed page is pressed without a choice", () => {
      render(<BodyMapScreen />);

      // The panel's parent is the full-screen layer that takes a press on the dimmed page.
      const dimmedPage = figureDialog().parentElement;
      expect(dimmedPage).not.toBeNull();
      if (dimmedPage !== null) fireEvent.mouseDown(dimmedPage);

      expect(queryFigureDialog()).toBeNull();
      expect(window.localStorage.getItem("bodyMap.figure")).toBe("male");
    });

    it("should count Escape as closing without a choice", () => {
      render(<BodyMapScreen />);

      fireEvent.keyDown(document, { key: "Escape" });

      expect(queryFigureDialog()).toBeNull();
      expect(window.localStorage.getItem("bodyMap.figure")).toBe("male");
    });

    it("should ask once in a visit, not again when the screen redraws", () => {
      const { rerender } = render(<BodyMapScreen />);
      closeFigureDialog();

      rerender(<BodyMapScreen />);

      expect(queryFigureDialog()).toBeNull();
    });

    it("should redraw the figures as Female with the same fills, behind the open dialog", () => {
      render(<BodyMapScreen />);

      chooseFemale();

      const { front, back } = BODY_ARTWORK.female;
      expect(figureDialog()).toBeTruthy();
      expect(fillOf("front", front.muscles.chest_upper)).toContain("fill-heat-1");
      expect(fillOf("front", front.muscles.quads)).toContain("fill-heat-3");
      expect(fillOf("back", back.muscles.lats)).toContain("fill-heat-2");
      expect(fillOf("back", back.muscles.hamstrings)).toContain("fill-heat-3");
      expect(fillOf("front", BODY_ARTWORK.male.front.muscles.quads)).toBe("");
    });

    it("should keep Female for the next visit", () => {
      render(<BodyMapScreen />);
      chooseFemale();
      closeFigureDialog();

      visitAgain();

      expect(queryFigureDialog()).toBeNull();
      expect(fillOf("front", BODY_ARTWORK.female.front.muscles.quads)).toContain("fill-heat-3");
    });

    it("should reopen from the header control at any time, showing the figure drawn", () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      render(<BodyMapScreen />);

      fireEvent.click(headerControl());

      expect(
        within(figureDialog()).getByRole<HTMLInputElement>("radio", { name: "Female" }).checked,
      ).toBe(true);
    });

    it("should not change what is stored when a stored figure is closed unchanged", () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      render(<BodyMapScreen />);

      fireEvent.click(headerControl());
      closeFigureDialog();

      expect(window.localStorage.getItem("bodyMap.figure")).toBe("female");
    });

    it("should return focus to the header control when it closes", () => {
      window.localStorage.setItem("bodyMap.figure", "male");
      render(<BodyMapScreen />);
      headerControl().focus();
      fireEvent.click(headerControl());

      closeFigureDialog();

      expect(document.activeElement).toBe(headerControl());
    });

    it("should fall back to Male without asking when storage is blocked", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      render(<BodyMapScreen />);

      expect(queryFigureDialog()).toBeNull();
      expect(fillOf("front", BODY_ARTWORK.male.front.muscles.quads)).toContain("fill-heat-3");
    });

    it("should still apply a choice for the visit when it cannot be saved", () => {
      window.localStorage.setItem("bodyMap.figure", "male");
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });
      render(<BodyMapScreen />);

      fireEvent.click(headerControl());
      chooseFemale();

      expect(fillOf("front", BODY_ARTWORK.female.front.muscles.quads)).toContain("fill-heat-3");
    });

    it("should still cross-fade Actual and Projected when Female is drawn", () => {
      window.localStorage.setItem("bodyMap.figure", "female");
      render(<BodyMapScreen />);

      const actualLayer = figure("front", "Actual").parentElement;
      const projectedLayer = figure("front", "Projected").parentElement;
      expect(actualLayer?.className).toContain("opacity-100");
      expect(projectedLayer?.className).toContain("opacity-0");

      fireEvent.click(toggle());

      expect(actualLayer?.className).toContain("opacity-0");
      expect(projectedLayer?.className).toContain("opacity-100");
      expect(actualLayer?.className).toContain("transition-opacity");
    });

    it("should draw neither the dialog nor the stored figure on the server", () => {
      window.localStorage.setItem("bodyMap.figure", "female");

      const page = document.createElement("div");
      page.innerHTML = renderToString(
        <ToastProvider>
          <BodyMapScreen />
        </ToastProvider>,
      );

      expect(within(page).queryByRole("dialog")).toBeNull();
      expect(within(page).queryByRole("button", { name: BODY_MAP.figureSetting.label })).toBeNull();
      expect(page.innerHTML).not.toContain(BODY_ARTWORK.female.front.outline);
    });
  });
});
