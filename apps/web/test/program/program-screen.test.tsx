import { OFFLINE_BANNER, PROGRAM_ERROR, PROGRAM_SCREEN } from "@keylow/core/copy";
import { buildProgramView } from "@keylow/core/program";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProgramBackend, resetProgramBackend } from "./programBackend";

import type { ExpenditureSnapshot, ProgramScreenState } from "@keylow/api-client";
import type {
  BuildProgramViewInput,
  CheckinSummaryView,
  SettlingChecklistView,
} from "@keylow/core/program";

import { ProgramScreen } from "@/components/program";
import { CHECKIN_SEEN_KEY } from "@/lib/checkinSeen";

const { useProgramScreen, useSettlingChecklist, useCheckinSummary } = vi.hoisted(() => ({
  useProgramScreen: vi.fn<() => ProgramScreenState>(),
  useSettlingChecklist: vi.fn<() => SettlingChecklistView | null>(),
  useCheckinSummary: vi.fn<() => CheckinSummaryView | null>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useProgramScreen,
  useSettlingChecklist,
  useCheckinSummary,
}));

const TODAY = "2026-10-30";
// The golden figures: an estimate of 2,580 kcal, likely 2,430 to 2,730, and targets of 2,140 kcal with
// 126 g protein, 245 g carbs and 73 g fat.
const GOLDEN_VARIANCE_KCAL2 = 13_700;
const PROGRAM = {
  goal: "lose",
  ratePctPerWeek: 0.5,
  proteinGPerKg: 1.6,
  splitPreset: "balanced",
  startedOn: "2026-10-02",
  nextCheckinDate: "2026-11-06",
} as const;

const START_SNAPSHOT: ExpenditureSnapshot = {
  id: "start",
  kind: "start",
  asOfDate: "2026-10-02",
  muKcal: 2580,
  varKcal2: GOLDEN_VARIANCE_KCAL2,
  measurement: null,
};

function viewOf(overrides: Partial<BuildProgramViewInput<ExpenditureSnapshot>> = {}) {
  const view = buildProgramView({
    program: PROGRAM,
    latestSnapshot: START_SNAPSHOT,
    previousSnapshot: null,
    currentTargets: null,
    targetsRead: { kcal: 2140, protein_g: 126, carbs_g: 245, fat_g: 73 },
    startBelief: null,
    fallbackWeightKg: 80,
    unit: "kg",
    today: TODAY,
    ...overrides,
  });
  if (view === null) {
    throw new Error("The fixture should give a view");
  }
  return view;
}

const SETTLING_VIEW: SettlingChecklistView = {
  title: "First check-in Friday 6 November, in 7 days",
  rows: [
    { label: "Days with a weigh-in", name: "Days with a weigh-in", count: 4, target: 8 },
    {
      label: "Days your weigh-ins cover, first to last",
      name: "Days your weigh-ins cover",
      count: 6,
      target: 14,
    },
    { label: "Complete days", name: "Complete days", count: 4, target: 10 },
  ],
  tip: "Weigh in on Thursday 5 November, the day before, so your weigh-ins cover the full 14 days.",
};

const NOT_MEASURED_VIEW: CheckinSummaryView = {
  name: "Last check-in, Friday 23 October, not measured",
  dateText: "Friday 23 October",
  isMeasured: false,
  rows: [
    { label: "Expenditure", value: "2,580 kcal, carried forward", name: "Expenditure: 2,580 kcal" },
    { label: "Calorie target", value: "2,140 kcal, no change", name: "Calorie target: 2,140 kcal" },
  ],
  lines: [
    { kind: "reason", text: "Too few weigh-ins this week." },
    { kind: "plain", text: "Your estimate stays at 2,580 kcal, likely 2,430 to 2,730." },
  ],
};

// A check-in two weeks after the start that could not measure: too few weigh-ins.
const CHECKIN_SNAPSHOT: ExpenditureSnapshot = {
  id: "checkin",
  kind: "checkin",
  asOfDate: "2026-10-23",
  muKcal: 2580,
  varKcal2: GOLDEN_VARIANCE_KCAL2,
  measurement: {
    eligible: false,
    reasons: ["weigh_days"],
    spanDays: 14,
    weighDays: 5,
    completeDays: 12,
  },
};

// The page's own reads are mocked above. The chart card and the How it works row read through the real hooks
// from a fake database, which `program-chart.test.tsx` fills.
function renderScreen() {
  return renderWithProgramBackend(<ProgramScreen />);
}

describe("ProgramScreen", () => {
  beforeEach(() => {
    resetProgramBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    useSettlingChecklist.mockReturnValue(null);
    useCheckinSummary.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe("with a programme", () => {
    beforeEach(() => {
      useProgramScreen.mockReturnValue({ status: "program", view: viewOf() });
    });

    it("should lead with the way back to More and the Programme title", () => {
      renderScreen();

      expect(screen.getByRole("link", { name: PROGRAM_SCREEN.backName }).getAttribute("href")).toBe(
        "/more",
      );
      expect(screen.getByRole("heading", { level: 1, name: PROGRAM_SCREEN.title })).toBeTruthy();
    });

    it("should say the estimate is an estimate, with its likely range", () => {
      renderScreen();

      const hero = screen.getByRole("region", {
        name: "Estimated expenditure, 2,580 kilocalories a day, likely 2,430 to 2,730 kcal",
      });
      expect(within(hero).getByText("2,580")).toBeTruthy();
      expect(within(hero).getByText("Estimate")).toBeTruthy();
      expect(within(hero).getByText("Likely 2,430 to 2,730 kcal")).toBeTruthy();
    });

    it("should show this week's targets with the macros as one run each", () => {
      renderScreen();

      const targets = screen.getByRole("region", {
        name: "This week's targets, 2,140 kilocalories a day",
      });
      expect(within(targets).getByText("2,140")).toBeTruthy();
      expect(within(targets).getByText("126 g")).toBeTruthy();
      expect(within(targets).getByText("245 g")).toBeTruthy();
      expect(within(targets).getByText("73 g")).toBeTruthy();
    });

    it("should list the programme's own settings under Your programme", () => {
      renderScreen();

      const group = screen.getByRole("region", { name: PROGRAM_SCREEN.details.title });
      expect(
        within(group)
          .getAllByRole("listitem")
          .map((item) => item.textContent),
      ).toEqual([
        expect.stringContaining("Goal"),
        expect.stringContaining("Rate"),
        expect.stringContaining("Protein"),
        expect.stringContaining("Diet style"),
      ]);
    });

    it("should end with the not-medical-advice line", () => {
      renderScreen();

      expect(screen.getByText(PROGRAM_SCREEN.notMedicalAdvice)).toBeTruthy();
    });

    it("should show no Settling badge and no first check-in banner once a check-in made the estimate", () => {
      useProgramScreen.mockReturnValue({
        status: "program",
        view: viewOf({
          latestSnapshot: CHECKIN_SNAPSHOT,
          previousSnapshot: START_SNAPSHOT,
        }),
      });
      // Were the banner mounted it would draw this, so its absence is the page's own doing.
      useSettlingChecklist.mockReturnValue(SETTLING_VIEW);

      renderScreen();

      expect(screen.getByText("Estimate")).toBeTruthy();
      expect(screen.queryByText("Settling")).toBeNull();
      expect(screen.queryByText(SETTLING_VIEW.title)).toBeNull();
      expect(screen.queryByRole("progressbar")).toBeNull();
    });
  });

  describe("settling", () => {
    beforeEach(() => {
      useProgramScreen.mockReturnValue({ status: "program", view: viewOf() });
      useSettlingChecklist.mockReturnValue(SETTLING_VIEW);
    });

    it("should add the Settling badge before the Estimate badge", () => {
      renderScreen();

      const hero = screen.getByRole("region", { name: /^Estimated expenditure/ });
      expect(within(hero).getByText("Settling")).toBeTruthy();
      expect(within(hero).getByText("Estimate")).toBeTruthy();
    });

    it("should show the first check-in banner with its three counts and its tip", () => {
      renderScreen();

      const banner = screen.getByRole("note");
      expect(within(banner).getByText(SETTLING_VIEW.title)).toBeTruthy();
      expect(
        within(banner).getByRole("progressbar", { name: "Days with a weigh-in, 4 of 8" }),
      ).toBeTruthy();
      expect(
        within(banner).getByRole("progressbar", { name: "Days your weigh-ins cover, 6 of 14" }),
      ).toBeTruthy();
      expect(
        within(banner).getByRole("progressbar", { name: "Complete days, 4 of 10" }),
      ).toBeTruthy();
      expect(within(banner).getByText(SETTLING_VIEW.tip ?? "")).toBeTruthy();
    });

    it("should show the first check-in row of the targets", () => {
      renderScreen();

      expect(screen.getByText(PROGRAM_SCREEN.targets.firstCheckIn)).toBeTruthy();
    });
  });

  describe("after a check-in that did not measure", () => {
    it("should show the Not measured badge, the reason and the carried forward line", () => {
      useProgramScreen.mockReturnValue({
        status: "program",
        view: viewOf({ latestSnapshot: CHECKIN_SNAPSHOT }),
      });
      useCheckinSummary.mockReturnValue(NOT_MEASURED_VIEW);

      renderScreen();

      const card = screen.getByRole("group", { name: NOT_MEASURED_VIEW.name });
      expect(within(card).getByText("Not measured")).toBeTruthy();
      expect(within(card).getByText("Too few weigh-ins this week.")).toBeTruthy();
      expect(within(card).getByText(/carried forward/)).toBeTruthy();
    });
  });

  describe("with no programme", () => {
    beforeEach(() => {
      useProgramScreen.mockReturnValue({ status: "no-program", ownTargetKcal: 2200 });
    });

    it("should show the offer with its three points", () => {
      renderScreen();

      expect(
        screen.getByRole("heading", { level: 2, name: "Let Ki-Lo set your targets" }),
      ).toBeTruthy();
      expect(screen.getAllByRole("listitem")).toHaveLength(3);
    });

    it("should offer Estimate my targets, which opens the setup wizard in recalculate mode", () => {
      renderScreen();

      expect(screen.getByRole("link", { name: "Estimate my targets" }).getAttribute("href")).toBe(
        "/setup?mode=recalculate",
      );
      expect(screen.queryByRole("link", { name: "Set my own targets" })).toBeNull();
    });

    it("should say the own targets stay until the person starts", () => {
      renderScreen();

      expect(
        screen.getByText("Your own targets (2,200 kcal a day) stay until you start."),
      ).toBeTruthy();
    });

    it("should leave the line out when the person has no calorie target", () => {
      useProgramScreen.mockReturnValue({ status: "no-program", ownTargetKcal: null });

      renderScreen();

      expect(screen.queryByText(/stay until you start/)).toBeNull();
    });

    it("should end with the not-medical-advice line", () => {
      renderScreen();

      expect(screen.getByText(PROGRAM_SCREEN.notMedicalAdvice)).toBeTruthy();
    });
  });

  describe("loading", () => {
    it("should be a status named Loading your programme", () => {
      useProgramScreen.mockReturnValue({ status: "loading", isPaused: false });

      renderScreen();

      expect(screen.getByRole("status", { name: PROGRAM_SCREEN.loadingName })).toBeTruthy();
    });

    it("should never leave a skeleton on screen while the reads are paused", () => {
      useProgramScreen.mockReturnValue({ status: "loading", isPaused: true });

      renderScreen();

      expect(screen.queryByRole("status", { name: PROGRAM_SCREEN.loadingName })).toBeNull();
      const alert = screen.getByRole("alert");
      expect(within(alert).getByRole("heading", { name: PROGRAM_ERROR.title })).toBeTruthy();
      expect(screen.queryByRole("button", { name: PROGRAM_ERROR.retryLabel })).toBeNull();
    });

    it("should draw the offline board when the connection is down though no read has paused yet", () => {
      onlineManager.setOnline(false);
      useProgramScreen.mockReturnValue({ status: "loading", isPaused: false });

      renderScreen();

      expect(screen.queryByRole("status", { name: PROGRAM_SCREEN.loadingName })).toBeNull();
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  describe("when a read fails", () => {
    it("should show the error board and read again on Try again", () => {
      const retry = vi.fn();
      useProgramScreen.mockReturnValue({ status: "error", retry });

      renderScreen();
      act(() => {
        screen.getByRole("button", { name: PROGRAM_ERROR.retryLabel }).click();
      });

      expect(screen.getByRole("heading", { name: PROGRAM_ERROR.title })).toBeTruthy();
      expect(retry).toHaveBeenCalledTimes(1);
    });
  });

  describe("when the connection goes while the page is open", () => {
    it("should keep the figures under an offline banner that says they are from this session", () => {
      useProgramScreen.mockReturnValue({ status: "program", view: viewOf() });
      onlineManager.setOnline(false);

      renderScreen();

      const banner = screen.getByRole("status");
      expect(within(banner).getByText(OFFLINE_BANNER.title)).toBeTruthy();
      expect(banner.textContent).toContain(
        "Showing your programme from this session. Changes need a connection.",
      );
      expect(screen.getByText("2,580")).toBeTruthy();
    });

    it("should show no offline banner while online", () => {
      useProgramScreen.mockReturnValue({ status: "program", view: viewOf() });

      renderScreen();

      expect(screen.queryByText(OFFLINE_BANNER.title)).toBeNull();
    });
  });
  describe("the first open after a new check-in", () => {
    // The check-in of 23 October moved the estimate from 2,500 to 2,580 kcal.
    const CHECKIN_DATE = "2026-10-23";
    const PREVIOUS_SNAPSHOT: ExpenditureSnapshot = { ...START_SNAPSHOT, muKcal: 2500 };

    beforeEach(() => {
      window.localStorage.clear();
      useProgramScreen.mockReturnValue({
        status: "program",
        view: viewOf({ latestSnapshot: CHECKIN_SNAPSHOT, previousSnapshot: PREVIOUS_SNAPSHOT }),
      });
      useCheckinSummary.mockReturnValue(NOT_MEASURED_VIEW);
    });

    const estimateCard = () => screen.getByRole("region", { name: /^Estimated expenditure/ });
    const checkinCard = () => screen.getByRole("group", { name: NOT_MEASURED_VIEW.name });

    it("should start the estimate at the one before the check-in and cut the check-in card in", () => {
      renderScreen();

      expect(within(estimateCard()).getByText("2,500")).toBeTruthy();
      expect(checkinCard().className).toContain("animate-kl-cut-in");
    });

    it("should start the estimate at the final figure when there is no estimate before the check-in", () => {
      useProgramScreen.mockReturnValue({
        status: "program",
        view: viewOf({ latestSnapshot: CHECKIN_SNAPSHOT, previousSnapshot: null }),
      });

      renderScreen();

      expect(within(estimateCard()).getAllByText("2,580")).toHaveLength(2);
      expect(within(estimateCard()).queryByText("0")).toBeNull();
    });

    it("should remember the check-in's date for this browser", () => {
      renderScreen();

      expect(window.localStorage.getItem(CHECKIN_SEEN_KEY)).toBe(CHECKIN_DATE);
    });

    it("should show the page at rest on the next open, with the estimate as it is", () => {
      window.localStorage.setItem(CHECKIN_SEEN_KEY, CHECKIN_DATE);

      renderScreen();

      expect(within(estimateCard()).getByText("2,580").className).not.toContain("animate-flash");
      expect(within(estimateCard()).queryByText("2,500")).toBeNull();
      expect(checkinCard().className).not.toContain("animate-");
    });

    it("should play nothing when this browser's storage cannot be read, since it would be a guess", () => {
      vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
        throw new DOMException("blocked", "SecurityError");
      });

      renderScreen();

      expect(within(estimateCard()).getByText("2,580").className).not.toContain("animate-flash");
      expect(checkinCard().className).not.toContain("animate-");
    });

    it("should play nothing when the latest snapshot is not a check-in", () => {
      useProgramScreen.mockReturnValue({ status: "program", view: viewOf() });

      renderScreen();

      expect(within(estimateCard()).getByText("2,580").className).not.toContain("animate-flash");
      expect(window.localStorage.getItem(CHECKIN_SEEN_KEY)).toBeNull();
    });
  });
});
