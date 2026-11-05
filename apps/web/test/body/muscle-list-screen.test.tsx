import { RESTING_HEAT } from "@keylow/api-client";
import {
  BODY_MAP,
  MUSCLE_GROUP_NAMES,
  MUSCLE_SHEET,
  SEARCH_CLEAR_LABEL,
  TRAIN_ERROR,
  TRAIN_OFFLINE_TITLE,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goldenMuscleList } from "./muscleListGolden";

import type { BodyMap, BodyMapDay, TrainingReadResult } from "@keylow/api-client";
import type { MuscleDetail, MuscleListGroup } from "@keylow/core/training";

import { MuscleListScreen } from "@/components/body/MuscleListScreen";

const reads = vi.hoisted(
  (): {
    byView: Record<string, unknown>;
    list: unknown;
    bodyMapAsked: { view: string; at?: string }[];
    listAsked: { view: string; at?: string }[];
    detailAsked: { muscle: string; options: Record<string, unknown> }[];
    routine: unknown;
    notTrained: boolean;
  } => ({
    byView: {},
    list: undefined,
    bodyMapAsked: [],
    listAsked: [],
    detailAsked: [],
    routine: null,
    notTrained: false,
  }),
);
const router = vi.hoisted(() => ({ back: vi.fn(), push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProfileTimeZone: () => ({ data: "Europe/London" }),
  useBodyMap: (options: { view: string; at?: string }) => {
    reads.bodyMapAsked.push(options);
    return reads.byView[options.view];
  },
  useMuscleList: (options: { view: string; at?: string }) => {
    reads.listAsked.push(options);
    return reads.list;
  },
  useMuscleDetail: (muscle: string, options: Record<string, unknown>) => {
    reads.detailAsked.push({ muscle, options });
    return read(reads.notTrained ? notTrainedHamstringsDetail : hamstringsDetail);
  },
  useActiveRoutine: () => ({ data: reads.routine }),
}));

const refetch = vi.fn<() => Promise<unknown>>(() => Promise.resolve());
const read = <Data,>(data: Data | undefined, isError = false): TrainingReadResult<Data> => ({
  data,
  isPending: data === undefined && !isError,
  isError,
  error: null,
  refetch,
});

// Thursday 15 October 2026 at 19:00 in London, the agreed golden week.
const THURSDAY_19_00 = "2026-10-15T18:00:00.000Z";

const dayOf = (date: string, selectable: boolean): BodyMapDay => ({
  date,
  at: `${date}T19:00:00.000Z`,
  isToday: date === "2026-10-15",
  status: "rest",
  plannedDayName: null,
  sessionDayName: null,
  selectable,
});
const weekDays = (lastSelectable: string): BodyMapDay[] =>
  ["12", "13", "14", "15", "16", "17", "18"].map((day) =>
    dayOf(`2026-10-${day}`, `2026-10-${day}` <= lastSelectable),
  );
const bodyMap: BodyMap = {
  values: { ...RESTING_HEAT, hamstrings: 3, quads: 3 },
  computedAt: THURSDAY_19_00,
  days: weekDays("2026-10-15"),
  todayProjectedIsActual: true,
  projectedAvailable: true,
  nothingLogged: false,
};
const hamstringsDetail: MuscleDetail = {
  muscle: "hamstrings",
  heatPercent: 55,
  heatStep: 3,
  readyInHours: 31,
  weeklySets: {
    actual: 5.5,
    planned: 11,
    bands: { growingFromSets: 4, productiveFromSets: 10, highAboveSets: 20 },
    actualStatus: "growing",
    plannedStatus: "productive",
    volumeStatus: "growing",
  },
  targeting: { targeted: true, routineTrains: true, goalRanks: false },
  lastTrained: null,
};

// Hamstrings read with no sets this week, so its sheet is the Not trained one.
const notTrainedHamstringsDetail: MuscleDetail = {
  ...hamstringsDetail,
  weeklySets: {
    ...hamstringsDetail.weeklySets,
    actual: 0,
    planned: 0,
    actualStatus: "not_trained",
    plannedStatus: "not_trained",
    volumeStatus: "not_trained",
  },
  targeting: { targeted: false, routineTrains: false, goalRanks: false },
};

const showReads = (list: MuscleListGroup[] | undefined = goldenMuscleList()) => {
  reads.byView = {
    actual: read(bodyMap),
    projected: read({ ...bodyMap, days: weekDays("2026-10-18") }),
  };
  reads.list = read(list);
};
const group = (name: string) => screen.getByRole("region", { name });
// The view's name and moment are one live region, and the search's result count is another.
const viewStatus = () => {
  const status = screen
    .getAllByRole("status")
    .find((candidate) => within(candidate).queryByText(/^(Actual|Projected)$/) !== null);
  if (status === undefined) {
    throw new Error("The view label is not on screen");
  }
  return status;
};
const allRows = () => screen.getAllByRole("button", { name: /, open details$/ });

describe("the muscle list page", () => {
  beforeEach(() => {
    window.localStorage.clear();
    onlineManager.setOnline(true);
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(THURSDAY_19_00));
    reads.bodyMapAsked = [];
    reads.listAsked = [];
    reads.detailAsked = [];
    reads.routine = null;
    router.push.mockReset();
    showReads();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
    refetch.mockClear();
    onlineManager.setOnline(true);
  });

  describe("what it shows", () => {
    it("should title itself Muscles at level one, with a Back link to the body map", () => {
      render(<MuscleListScreen />);

      expect(screen.getByRole("heading", { level: 1, name: BODY_MAP.listTitle })).toBeTruthy();
      expect(screen.getByRole("link", { name: BODY_MAP.back }).getAttribute("href")).toBe(
        "/body-map",
      );
    });

    it("should list all 22 muscles in the 7 groups, each group under its name", () => {
      render(<MuscleListScreen />);

      const sizes = [
        ["chest", 2],
        ["shoulders", 3],
        ["back", 4],
        ["arms", 3],
        ["core", 2],
        ["legs", 7],
        ["neck", 1],
      ] as const;
      for (const [key, size] of sizes) {
        expect(within(group(MUSCLE_GROUP_NAMES[key])).getAllByRole("button")).toHaveLength(size);
      }
      expect(allRows()).toHaveLength(22);
    });

    it("should name a row as the mobile list does", () => {
      render(<MuscleListScreen />);

      expect(
        within(group("Legs")).getByRole("button", {
          name: "Hamstrings, heat 55 percent, hot, ready in 31 hours, open details",
        }),
      ).toBeTruthy();
    });

    it("should say Actual and now, with a button for the other view", () => {
      render(<MuscleListScreen />);

      const status = viewStatus();
      expect(within(status).getByText("Actual")).toBeTruthy();
      expect(within(status).getByText("Now · Thu 15 Oct, 19:00")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Show projected" })).toBeTruthy();
    });
  });

  describe("the search field", () => {
    it("should narrow the list to the muscles whose name holds the text, and drop the groups left empty", () => {
      render(<MuscleListScreen />);

      fireEvent.change(screen.getByRole("searchbox", { name: BODY_MAP.muscleSearch.label }), {
        target: { value: "delts" },
      });

      expect(allRows().map((row) => row.getAttribute("aria-label")?.split(",")[0])).toStrictEqual([
        "Front delts",
        "Side delts",
        "Rear delts",
      ]);
      expect(screen.queryByRole("region", { name: "Chest" })).toBeNull();
      expect(screen.getByRole("region", { name: "Shoulders" })).toBeTruthy();
    });

    it("should say so when no muscle matches, and bring them all back on Clear search", () => {
      render(<MuscleListScreen />);
      const search = screen.getByRole("searchbox", { name: BODY_MAP.muscleSearch.label });

      fireEvent.change(search, { target: { value: "zzz" } });
      expect(screen.getByText(BODY_MAP.muscleSearch.noResults)).toBeTruthy();
      expect(screen.queryAllByRole("button", { name: /, open details$/ })).toHaveLength(0);

      fireEvent.click(screen.getByRole("button", { name: SEARCH_CLEAR_LABEL }));
      expect(allRows()).toHaveLength(22);
    });
  });

  describe("a row", () => {
    it("should open the muscle's sheet over the list", () => {
      render(<MuscleListScreen />);

      fireEvent.click(within(group("Legs")).getByRole("button", { name: /^Hamstrings,/ }));

      expect(screen.getByRole("dialog", { name: "Hamstrings" })).toBeTruthy();
      expect(allRows()).toHaveLength(22);
    });

    it("should return focus to that row when Escape closes the sheet, though a click did not focus it", () => {
      render(<MuscleListScreen />);
      const row = within(group("Legs")).getByRole("button", { name: /^Hamstrings,/ });

      fireEvent.click(row);
      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(row);
    });
  });

  describe("Edit routine on a row's Not trained sheet", () => {
    const openHamstringsSheet = () => {
      const row = within(group("Legs")).getByRole("button", { name: /^Hamstrings,/ });
      fireEvent.click(row);
      return row;
    };
    const pressEditRoutine = () => {
      fireEvent.click(
        within(screen.getByRole("dialog", { name: "Hamstrings" })).getByRole("button", {
          name: MUSCLE_SHEET.editRoutine,
        }),
      );
    };

    beforeEach(() => {
      reads.notTrained = true;
    });

    afterEach(() => {
      reads.notTrained = false;
    });

    it("should close the sheet and open the active routine's editor", () => {
      reads.routine = { id: "routine-1" };
      render(<MuscleListScreen />);
      openHamstringsSheet();

      pressEditRoutine();

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(router.push).toHaveBeenCalledExactlyOnceWith("/train/routines/routine-1");
    });

    it("should open the create page when there is no active routine", () => {
      render(<MuscleListScreen />);
      openHamstringsSheet();

      pressEditRoutine();

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(router.push).toHaveBeenCalledExactlyOnceWith("/train/routines/new");
    });

    it("should draw no button until the routine read has answered", () => {
      reads.routine = undefined;
      render(<MuscleListScreen />);

      openHamstringsSheet();

      expect(
        within(screen.getByRole("dialog", { name: "Hamstrings" })).queryByRole("button", {
          name: MUSCLE_SHEET.editRoutine,
        }),
      ).toBeNull();
    });

    it("should give focus back to the row as the sheet closes", () => {
      render(<MuscleListScreen />);
      const row = openHamstringsSheet();

      pressEditRoutine();

      expect(document.activeElement).toBe(row);
    });
  });

  describe("the view", () => {
    it("should switch to Projected on its button, read the list for it, and remember the choice", () => {
      render(<MuscleListScreen />);

      fireEvent.click(screen.getByRole("button", { name: "Show projected" }));

      expect(within(viewStatus()).getByText("Projected")).toBeTruthy();
      expect(reads.listAsked.at(-1)).toMatchObject({ view: "projected" });
      expect(window.localStorage.getItem("bodyMap.view")).toBe("projected");
    });

    it("should open in the view last chosen", () => {
      window.localStorage.setItem("bodyMap.view", "projected");

      render(<MuscleListScreen />);

      expect(within(viewStatus()).getByText("Projected")).toBeTruthy();
      expect(reads.listAsked.at(-1)).toMatchObject({ view: "projected" });
    });

    it("should show Actual and switch Projected off when there is no routine, saying why", () => {
      window.localStorage.setItem("bodyMap.view", "projected");
      reads.byView = {
        actual: read(bodyMap),
        projected: read({ ...bodyMap, projectedAvailable: false }),
      };

      render(<MuscleListScreen />);

      expect(within(viewStatus()).getByText("Actual")).toBeTruthy();
      expect(screen.getByRole("button", { name: "Show projected" })).toHaveProperty(
        "disabled",
        true,
      );
      expect(screen.getByText(BODY_MAP.toggle.projectedNeedsRoutine)).toBeTruthy();
    });
  });

  describe("the day in the address", () => {
    it("should read today with no day, the list and the sheet alike", () => {
      render(<MuscleListScreen />);
      fireEvent.click(within(group("Legs")).getByRole("button", { name: /^Hamstrings,/ }));

      expect(reads.listAsked.at(-1)?.at).toBeUndefined();
      expect(reads.detailAsked.at(-1)?.options.at).toBeUndefined();
    });

    it("should read an earlier day of the week the view can choose, and say it is not now", () => {
      render(<MuscleListScreen at="2026-10-14" />);
      fireEvent.click(within(group("Legs")).getByRole("button", { name: /^Hamstrings,/ }));

      expect(reads.listAsked.at(-1)).toMatchObject({ view: "actual", at: "2026-10-14" });
      expect(reads.detailAsked.at(-1)?.options).toMatchObject({ at: "2026-10-14" });
      expect(screen.queryByText(/^Now ·/)).toBeNull();
    });

    it("should fall back to today for a day the view cannot choose, or one that is not a day of this week", () => {
      for (const at of ["2026-10-16", "2026-11-30", "yesterday"]) {
        reads.listAsked = [];
        const { unmount } = render(<MuscleListScreen at={at} />);

        expect(reads.listAsked.at(-1)?.at).toBeUndefined();
        unmount();
      }
    });
  });

  describe("an address that is not a day of this week", () => {
    it.each(["2026-10-09", "2026-11-30", "yesterday", "2026-10-14T10:00", ""])(
      "should send %j to no read",
      (at) => {
        render(<MuscleListScreen at={at} />);

        expect(reads.bodyMapAsked.filter((asked) => asked.at !== undefined)).toStrictEqual([]);
        expect(reads.listAsked.filter((asked) => asked.at !== undefined)).toStrictEqual([]);
      },
    );

    it("should send a day of this week to the reads", () => {
      render(<MuscleListScreen at="2026-10-14" />);

      expect(reads.bodyMapAsked.some((asked) => asked.at === "2026-10-14")).toBe(true);
    });
  });

  describe("the result count", () => {
    const resultCount = () =>
      screen
        .getAllByRole("status")
        .find((candidate) => within(candidate).queryByText(/^(Actual|Projected)$/) === null);

    it("should say nothing until a search has settled, then how many muscles it found", () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(new Date(THURSDAY_19_00));
      render(<MuscleListScreen />);
      expect(resultCount()?.textContent).toBe("");

      fireEvent.change(screen.getByRole("searchbox", { name: BODY_MAP.muscleSearch.label }), {
        target: { value: "delts" },
      });
      expect(resultCount()?.textContent).toBe("");
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(resultCount()?.textContent).toBe("3 muscles");
    });

    it("should say No muscles when none matches", () => {
      vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
      vi.setSystemTime(new Date(THURSDAY_19_00));
      render(<MuscleListScreen />);

      fireEvent.change(screen.getByRole("searchbox", { name: BODY_MAP.muscleSearch.label }), {
        target: { value: "zzz" },
      });
      act(() => {
        vi.advanceTimersByTime(500);
      });

      expect(resultCount()?.textContent).toBe("No muscles");
    });
  });

  describe("when the reads are not there", () => {
    it("should show a loading status while they come, online", () => {
      reads.list = read<MuscleListGroup[]>(undefined);

      render(<MuscleListScreen />);

      expect(
        screen.getByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeTruthy();
    });

    it("should say there is no saved list, with no skeleton, when offline with nothing read", () => {
      onlineManager.setOnline(false);
      reads.byView = { actual: read<BodyMap>(undefined), projected: read<BodyMap>(undefined) };
      reads.list = read<MuscleListGroup[]>(undefined);

      render(<MuscleListScreen />);

      expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeTruthy();
      expect(screen.getByText(BODY_MAP.dashboardCard.offlineUnavailable)).toBeTruthy();
      expect(
        screen.queryByRole("status", { name: BODY_MAP.dashboardCard.loadingLabel }),
      ).toBeNull();
    });

    it("should offer Try again when a read failed, and read again", () => {
      reads.list = read<MuscleListGroup[]>(undefined, true);

      render(<MuscleListScreen />);
      fireEvent.click(screen.getByRole("button", { name: TRAIN_ERROR.action }));

      expect(screen.getByText(TRAIN_ERROR.title)).toBeTruthy();
      expect(refetch).toHaveBeenCalled();
    });
  });
});
