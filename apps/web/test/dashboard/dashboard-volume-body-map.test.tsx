import { RESTING_HEAT } from "@keylow/api-client";
import { BODY_MAP } from "@keylow/core/copy";
import { BODY_ARTWORK, VOLUME_STATUSES } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { hydrateRoot } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenThursdayBodyMap } from "./bodyMapFixtures";

import type {
  BodyMap,
  DashboardBodyMap as DashboardBodyMapData,
  TrainingReadResult,
  UseBodyMapInput,
} from "@keylow/api-client";

import BodyMapPage from "@/app/(dashboard)/body-map/page";
import { DashboardBodyChartSetting } from "@/app/(dashboard)/more/DashboardBodyChartSetting";
import { DashboardBodyMap } from "@/components/dashboard/DashboardBodyMap";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";
import { resetDashboardBodyChartForTests } from "@/lib/dashboardBodyChart/testing";

type TodayRead = TrainingReadResult<DashboardBodyMapData>;
type VolumeRead = TrainingReadResult<BodyMap>;
// A cached read as React Query gives it, which says it is paused when the browser is offline.
type ZoneRead = {
  data: string | undefined;
  isError: boolean;
  fetchStatus: "fetching" | "paused" | "idle";
};

const reads = vi.hoisted(
  (): {
    today: unknown;
    zone: unknown;
    volume: unknown;
    volumeInputs: UseBodyMapInput[];
    // A figure setting that is known on the server too, so a test can leave only the chart unknown.
    knownFigure: boolean;
  } => ({
    today: undefined,
    zone: undefined,
    volume: undefined,
    volumeInputs: [],
    knownFigure: false,
  }),
);

vi.mock("@/lib/bodyFigure", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/bodyFigure")>();
  return {
    ...original,
    useBodyFigure: () =>
      reads.knownFigure
        ? { figure: "male" as const, isReady: true, hasChosen: true, setFigure: vi.fn() }
        : original.useBodyFigure(),
  };
});

vi.mock("next/navigation", () => ({ useRouter: () => ({ back: vi.fn(), push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useDashboardBodyMap: () => reads.today,
  useProfileTimeZone: () => reads.zone,
  useBodyMap: (input: UseBodyMapInput) => {
    reads.volumeInputs.push(input);
    return reads.volume;
  },
  useMuscleList: () => muscleListRead,
  // The page's Muscles card reads this on the scale on screen, which main's body map screen does.
  useMuscleScaleList: () => muscleListRead,
  useStartSessionAction: () => ({ start: vi.fn(), isStarting: false }),
}));

const refetch = () => Promise.resolve();
const muscleListRead = {
  data: undefined,
  isPending: true,
  isError: false,
  error: null,
  refetch,
};
const volumeWeek = (values: BodyMap["values"]): VolumeRead => ({
  data: {
    values,
    computedAt: "2026-10-19T17:55:00.000Z",
    days: [],
    todayProjectedIsActual: true,
    projectedAvailable: true,
    nothingLogged: false,
  },
  isPending: false,
  isError: false,
  error: null,
  refetch,
});
const growing = VOLUME_STATUSES.indexOf("growing");
const productive = VOLUME_STATUSES.indexOf("productive");
// The phone board's week: eight muscles at Growing or above, among them the lats at Productive.
const monday = volumeWeek({
  ...RESTING_HEAT,
  chest_upper: growing,
  chest_lower: growing,
  delt_rear: growing,
  lats: productive,
  traps_mid: growing,
  biceps: growing,
  glute_max: growing,
  quads: growing,
});
const emptyWeek = volumeWeek(RESTING_HEAT);
const volumePending: VolumeRead = {
  data: undefined,
  isPending: true,
  isError: false,
  error: null,
  refetch,
};
const volumeFailed: VolumeRead = {
  ...volumePending,
  isPending: false,
  isError: true,
  error: new Error("read failed"),
};
const todayLoaded: TodayRead = {
  data: goldenThursdayBodyMap,
  isPending: false,
  isError: false,
  error: null,
  refetch,
};
const todayFailed: TodayRead = {
  data: undefined,
  isPending: false,
  isError: true,
  error: new Error("read failed"),
  refetch,
};
const zoneKnown: ZoneRead = { data: "Europe/London", isError: false, fetchStatus: "idle" };

// Monday 19 October 2026 at 00:30 in London, which is still Sunday the 18th in UTC.
const MONDAY_00_30_LONDON = "2026-10-18T23:30:00.000Z";

function chooseVolume() {
  window.localStorage.setItem("dashboard.bodyChart", "volume");
}

const card = () => screen.getByRole("region", { name: BODY_MAP.dashboardCard.title });
const cardLink = () => screen.getByRole("link", { name: /^Body map, weekly volume/ });

describe("DashboardBodyMap in Weekly volume", () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ["Date", "setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    vi.setSystemTime(new Date(MONDAY_00_30_LONDON));
    onlineManager.setOnline(true);
    window.localStorage.clear();
    resetBodyFigureForTests();
    resetDashboardBodyChartForTests();
    reads.volumeInputs = [];
    reads.knownFigure = false;
    reads.today = todayLoaded;
    reads.zone = zoneKnown;
    reads.volume = monday;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
  });

  describe("with nothing saved", () => {
    it("should be Heat and read none of what Weekly volume reads", () => {
      render(<DashboardBodyMap />);

      expect(screen.getByRole("link", { name: /^Body map, Actual heat now/ })).toBeTruthy();
      expect(reads.volumeInputs).toHaveLength(0);
    });
  });

  describe("with Weekly volume saved", () => {
    beforeEach(chooseVolume);

    it("should be one link named by what it shows and ending in the words that open Volume", () => {
      render(<DashboardBodyMap />);

      expect(cardLink().getAttribute("aria-label")).toBe(
        "Body map, weekly volume, Actual this week, Monday to Sunday. 8 of 22 muscles at Growing or above. Today: Legs, 16 sets planned. Open the body map on Volume",
      );
      expect(card().contains(cardLink())).toBe(true);
    });

    it("should open the body map on Volume", () => {
      render(<DashboardBodyMap />);

      expect(cardLink().getAttribute("href")).toBe("/body-map?scale=volume");
    });

    it("should keep the title and the card's one name that Heat has", () => {
      render(<DashboardBodyMap />);

      const words = within(card());
      expect(words.getByText(BODY_MAP.dashboardCard.title)).toBeTruthy();
      expect(words.getByText(BODY_MAP.dashboardCard.volumeView)).toBeTruthy();
      expect(words.getByText(BODY_MAP.dashboardCard.link)).toBeTruthy();
      expect(words.getByText("Today: Legs")).toBeTruthy();
    });

    it("should draw the figures on the Volume scale, from the week's bands", () => {
      render(<DashboardBodyMap />);

      const back = screen.getByRole("img", {
        name: "Body map, Actual, weekly sets, back",
        hidden: true,
      });
      const front = screen.getByRole("img", {
        name: "Body map, Actual, weekly sets, front",
        hidden: true,
      });
      const fillOf = (figure: HTMLElement, path: string) =>
        figure.querySelector(`path[d="${path}"]`)?.getAttribute("class");
      expect(fillOf(front, BODY_ARTWORK.male.front.muscles.chest_upper)).toContain(
        "fill-volume-growing",
      );
      expect(fillOf(back, BODY_ARTWORK.male.back.muscles.lats)).toContain("fill-volume-productive");
      expect(fillOf(back, BODY_ARTWORK.male.back.muscles.calves)).toContain(
        "fill-volume-not-trained",
      );
    });

    it("should draw the volume legend, and not the heat one", () => {
      render(<DashboardBodyMap />);

      expect(
        screen.getByRole("img", { name: BODY_MAP.legendNames.volume, hidden: true }),
      ).toBeTruthy();
      expect(
        screen.queryByRole("img", { name: BODY_MAP.legendNames.heat, hidden: true }),
      ).toBeNull();
    });

    describe("on a Monday with nothing logged this week", () => {
      it("should say no sets yet, keep the legend and the Today line, and not say Heat's 14 days", () => {
        reads.volume = emptyWeek;
        render(<DashboardBodyMap />);

        const words = within(card());
        expect(words.getByText(BODY_MAP.dashboardCard.volumeEmpty)).toBeTruthy();
        expect(words.getByText("Today: Legs")).toBeTruthy();
        expect(
          screen.getByRole("img", { name: BODY_MAP.legendNames.volume, hidden: true }),
        ).toBeTruthy();
        expect(words.queryByText(/14 days/)).toBeNull();
      });
    });

    describe("the week it reads", () => {
      it("should be Volume Actual, from the Monday of the profile's zone and not of UTC", () => {
        render(<DashboardBodyMap />);

        expect(reads.volumeInputs.at(-1)).toMatchObject({
          scale: "volume",
          view: "actual",
          weekStart: "2026-10-19",
          now: MONDAY_00_30_LONDON,
          enabled: true,
        });
      });

      it("should not read until the profile's zone is known", () => {
        reads.zone = {
          data: undefined,
          isError: false,
          fetchStatus: "fetching",
        } satisfies ZoneRead;
        render(<DashboardBodyMap />);

        expect(reads.volumeInputs.at(-1)).toMatchObject({ enabled: false });
        expect(reads.volumeInputs.every((input) => input.enabled === false)).toBe(true);
      });

      it("should be the read the body map page makes on Volume Actual at the same moment", async () => {
        render(<DashboardBodyMap />);
        const dashboardInput = reads.volumeInputs.at(-1);
        cleanup();
        reads.volumeInputs = [];

        render(await BodyMapPage({ searchParams: Promise.resolve({ scale: "volume" }) }), {
          wrapper: ToastProvider,
        });
        const pageInput = reads.volumeInputs.find(
          (input) => input.scale === "volume" && input.view === "actual",
        );

        expect(dashboardInput).toBeDefined();
        expect(pageInput).toBeDefined();
        expect({
          scale: dashboardInput?.scale,
          view: dashboardInput?.view,
          weekStart: dashboardInput?.weekStart,
          now: dashboardInput?.now,
        }).toStrictEqual({
          scale: pageInput?.scale,
          view: pageInput?.view,
          weekStart: pageInput?.weekStart,
          now: pageInput?.now,
        });
      });
    });

    describe("while the reads are on their way", () => {
      it("should be a status named for what is loading", () => {
        reads.volume = volumePending;
        render(<DashboardBodyMap />);

        expect(
          screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
        ).toBeTruthy();
        expect(screen.queryByRole("region")).toBeNull();
      });

      it("should wait for today's plan as well as the week", () => {
        reads.today = { ...todayFailed, data: undefined, isError: false, isPending: true };
        render(<DashboardBodyMap />);

        expect(
          screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
        ).toBeTruthy();
      });
    });

    describe("when a read fails", () => {
      it.each([
        ["the week", () => (reads.volume = volumeFailed)],
        ["today's plan", () => (reads.today = todayFailed)],
        [
          "the profile's zone",
          () => {
            reads.zone = { data: undefined, isError: true, fetchStatus: "idle" } satisfies ZoneRead;
            reads.volume = volumePending;
          },
        ],
      ])("should say so in a quiet line, with no Try again, when %s fails", (_name, fail) => {
        fail();
        render(<DashboardBodyMap />);

        expect(screen.getByText(BODY_MAP.dashboardCard.loadFailed)).toBeTruthy();
        expect(screen.queryByRole("button")).toBeNull();
        expect(screen.queryByRole("status")).toBeNull();
      });
    });

    describe("offline with nothing read", () => {
      it("should say the body map is not available offline, and not load for ever", () => {
        onlineManager.setOnline(false);
        reads.zone = { data: undefined, isError: false, fetchStatus: "paused" } satisfies ZoneRead;
        reads.volume = volumePending;
        render(<DashboardBodyMap />);

        expect(screen.getByText(BODY_MAP.dashboardCard.offlineUnavailable)).toBeTruthy();
        expect(screen.queryByRole("status")).toBeNull();
      });

      it("should keep the numbers on screen when they were read before the connection went", () => {
        onlineManager.setOnline(false);
        render(<DashboardBodyMap />);

        expect(cardLink()).toBeTruthy();
      });
    });

    describe("before the stored chart is known", () => {
      it("should draw the skeleton on the server, never a card of either scale", () => {
        reads.knownFigure = true;
        const page = document.createElement("div");
        page.innerHTML = renderToString(<DashboardBodyMap />);

        expect(
          within(page).getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
        ).toBeTruthy();
        expect(within(page).queryByRole("region")).toBeNull();
      });

      it("should hydrate that page with no mismatch and then show Weekly volume", async () => {
        reads.knownFigure = true;
        const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
        const container = document.createElement("div");
        document.body.appendChild(container);
        container.innerHTML = renderToString(<DashboardBodyMap />);

        await act(async () => {
          hydrateRoot(container, <DashboardBodyMap />);
          await Promise.resolve();
        });

        expect(consoleError).not.toHaveBeenCalled();
        expect(
          within(container).getByRole("link", { name: /^Body map, weekly volume/ }),
        ).toBeTruthy();
        container.remove();
      });
    });
  });

  describe("choosing the chart in More", () => {
    const chooseInMore = (name: string) => {
      fireEvent.click(screen.getByRole("radio", { name }));
    };

    it("should change the card with no reload, in both directions", () => {
      render(
        <>
          <ul>
            <DashboardBodyChartSetting />
          </ul>
          <DashboardBodyMap />
        </>,
      );
      expect(screen.getByRole("link", { name: /^Body map, Actual heat now/ })).toBeTruthy();

      chooseInMore("Weekly volume");
      expect(cardLink()).toBeTruthy();
      expect(screen.queryByRole("link", { name: /^Body map, Actual heat now/ })).toBeNull();

      chooseInMore("Heat");
      expect(screen.getByRole("link", { name: /^Body map, Actual heat now/ })).toBeTruthy();
    });

    it("should survive a reload", () => {
      render(
        <>
          <ul>
            <DashboardBodyChartSetting />
          </ul>
          <DashboardBodyMap />
        </>,
      );
      chooseInMore("Weekly volume");
      cleanup();

      // A reload forgets the page and keeps the browser's storage.
      resetDashboardBodyChartForTests();
      render(<DashboardBodyMap />);

      expect(cardLink()).toBeTruthy();
    });
  });
});
