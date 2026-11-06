import { valueDomain, weekBandPath, weekChartLayout, weekPlotArea } from "@keylow/core/chart";
import { PROGRAM_CHART, PROGRAM_ERROR, PROGRAM_SCREEN } from "@keylow/core/copy";
import { expenditureBand } from "@keylow/core/program";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  checkinSnapshotRow,
  goldenSnapshots,
  programBackend,
  renderWithProgramBackend,
  resetProgramBackend,
  startSnapshotRow,
} from "./programBackend";

import { ProgramScreen } from "@/components/program";
import { ProgramActionsCard } from "@/components/program/ProgramScreen/ProgramActionsCard";

// The board's own width: the chart is 754 wide in the wide column at 1280, and 536 at the 1024 breakpoint.
const WIDE_COLUMN_WIDTH = 754;

function stubWidth(width: number) {
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(
    () => new DOMRect(0, 0, width, 100),
  );
}

// The page runs on the real hooks and the fake database, so the card goes through `useExpenditureChart` itself.
async function renderLoadedPage() {
  renderWithProgramBackend(<ProgramScreen />);
  await screen.findByRole("region", { name: /^Estimated expenditure/ });
}

const GOLDEN_SUMMARY =
  "Estimated expenditure over 5 weeks: 2,500 kcal a day in the week of 21 September, 2,580 now, likely 2,430 to 2,730.";

describe("the Programme page's chart card", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    resetProgramBackend();
    stubWidth(WIDE_COLUMN_WIDTH);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe("with the golden series", () => {
    beforeEach(() => {
      programBackend.snapshots = goldenSnapshots();
    });

    it("should draw the chart as one image named by the summary", async () => {
      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: GOLDEN_SUMMARY });
      expect(within(chart).getByText(PROGRAM_CHART.label)).toBeTruthy();
      expect(within(chart).getByText(PROGRAM_CHART.unit)).toBeTruthy();
      expect(within(chart).getByText(PROGRAM_CHART.legend.estimate)).toBeTruthy();
      expect(within(chart).getByText(PROGRAM_CHART.legend.band)).toBeTruthy();
    });

    it("should draw the five weeks, with a point for each and the latest as the marker", async () => {
      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: GOLDEN_SUMMARY });
      // The drawing is hidden from the tree, so it is reached through the figure.
      expect(chart.querySelectorAll("svg circle")).toHaveLength(5);
      expect(chart.querySelectorAll("svg circle.fill-chart-marker")).toHaveLength(1);
      expect(chart.querySelectorAll("svg path.stroke-chart-trend")).toHaveLength(1);
    });

    it("should draw the band of each week behind the line", async () => {
      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: GOLDEN_SUMMARY });
      const band = chart.querySelector("svg path.fill-chart-band");
      expect(band?.getAttribute("d")).toMatch(/^M/);
    });

    it("should sit in the first column, after the estimate and before Your programme", async () => {
      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: GOLDEN_SUMMARY });
      const estimate = screen.getByRole("region", { name: /^Estimated expenditure, / });
      const programme = screen.getByRole("region", { name: PROGRAM_SCREEN.details.title });
      expect(
        estimate.compareDocumentPosition(chart) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(
        chart.compareDocumentPosition(programme) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  describe("the likely range", () => {
    // 2,575 kcal with a variance whose unrounded ends are 2,426.6 and 2,723.4 kcal, which `expenditureBand`
    // rounds to 2,430 and 2,720, and whose middle is 2,575.
    const UNROUNDED_VARIANCE_KCAL2 = 13_400;

    beforeEach(() => {
      programBackend.snapshots = [checkinSnapshotRow("2026-10-26", 2575, UNROUNDED_VARIANCE_KCAL2)];
    });

    it("should read to the nearest 10 in the summary", async () => {
      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: /^Estimated expenditure/ });
      expect(chart.getAttribute("aria-label")).toContain(
        "this week: 2,575 kcal a day, likely 2,430 to 2,720.",
      );
    });

    it("should write the axis to the nearest 10 with a thousands separator", async () => {
      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: /^Estimated expenditure/ });
      // The middle value is 2,575, which a default writer would not round.
      expect(
        Array.from(chart.querySelectorAll("div.relative > span[aria-hidden]"))
          .map((tick) => tick.textContent)
          .filter((text) => /^[\d,]+$/.test(text)),
      ).toEqual(["2,720", "2,580", "2,430"]);
    });

    it("should draw the band from the ends expenditureBand gives, the same as the summary reads", async () => {
      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: /^Estimated expenditure/ });
      const drawn = chart.querySelector("svg path.fill-chart-band")?.getAttribute("d");
      const bandPathOf = (band: { low: number; high: number }) => {
        const area = weekPlotArea(WIDE_COLUMN_WIDTH, weekChartLayout(WIDE_COLUMN_WIDTH).height);
        return weekBandPath([2575], [band], area, valueDomain([2575], [band]));
      };
      const { lowKcal, highKcal } = expenditureBand({
        muKcal: 2575,
        varKcal2: UNROUNDED_VARIANCE_KCAL2,
      });
      expect(drawn).toBe(bandPathOf({ low: lowKcal, high: highKcal }));
    });
  });

  describe("with few weeks", () => {
    it("should draw two weeks with their band", async () => {
      programBackend.snapshots = [
        startSnapshotRow("2026-10-19", 2580, 13_700),
        startSnapshotRow("2026-10-26", 2580, 13_700),
      ];

      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: /^Estimated expenditure over 2 weeks/ });
      expect(chart.getAttribute("aria-label")).toContain("a starting estimate from your answers");
      expect(chart.querySelectorAll("svg circle")).toHaveLength(2);
      expect(chart.querySelector("svg path.fill-chart-band")).toBeTruthy();
    });

    it("should draw one week of settling as a point and a bar", async () => {
      programBackend.snapshots = [startSnapshotRow("2026-10-26", 2580, 13_700)];

      await renderLoadedPage();

      const chart = await screen.findByRole("img", { name: /^Estimated expenditure this week/ });
      expect(chart.querySelectorAll("svg circle")).toHaveLength(1);
      expect(chart.querySelectorAll("svg path.stroke-chart-trend")).toHaveLength(0);
      expect(chart.querySelector("svg path.fill-chart-band")).toBeTruthy();
    });
  });

  describe("with no estimate yet", () => {
    it("should keep the label over the empty state and draw no chart", async () => {
      // The page's own estimate is older than the 12 weeks the chart reads, so the chart has no week to draw.
      programBackend.snapshots = [startSnapshotRow("2026-01-05", 2580, 13_700)];

      await renderLoadedPage();

      expect(await screen.findByRole("heading", { name: PROGRAM_CHART.empty.title })).toBeTruthy();
      expect(screen.getByText(PROGRAM_CHART.empty.body)).toBeTruthy();
      expect(screen.getByText(PROGRAM_CHART.label)).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();
    });
  });

  describe("when the history cannot be read", () => {
    beforeEach(() => {
      programBackend.snapshots = goldenSnapshots();
      programBackend.failingHistory = true;
    });

    it("should show the error card in the chart's place with the rest of the page standing", async () => {
      await renderLoadedPage();

      const alert = await screen.findByRole("alert");
      expect(within(alert).getByRole("heading", { name: PROGRAM_ERROR.title })).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();
      expect(screen.getByRole("region", { name: /^Estimated expenditure/ })).toBeTruthy();
      expect(screen.getByRole("region", { name: PROGRAM_SCREEN.details.title })).toBeTruthy();
      expect(screen.getByRole("button", { name: PROGRAM_SCREEN.howItWorksLabel })).toBeTruthy();
    });

    it("should draw the chart after Try again once the history can be read", async () => {
      await renderLoadedPage();
      await screen.findByRole("alert");

      programBackend.failingHistory = false;
      act(() => {
        screen.getByRole("button", { name: PROGRAM_ERROR.retryLabel }).click();
      });

      expect(await screen.findByRole("img", { name: GOLDEN_SUMMARY })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("when the history failed and the connection goes", () => {
    it("should offer no Try again, which would do nothing", async () => {
      programBackend.snapshots = goldenSnapshots();
      programBackend.failingHistory = true;
      await renderLoadedPage();
      await screen.findByRole("button", { name: PROGRAM_ERROR.retryLabel });

      act(() => {
        onlineManager.setOnline(false);
      });

      await waitFor(() => {
        expect(screen.queryByRole("button", { name: PROGRAM_ERROR.retryLabel })).toBeNull();
      });
      expect(screen.getByRole("alert")).toBeTruthy();
    });
  });

  describe("while the history is being read", () => {
    beforeEach(() => {
      programBackend.snapshots = goldenSnapshots();
      programBackend.hangingHistory = true;
    });

    it("should hold the chart's place with a skeleton", async () => {
      await renderLoadedPage();

      expect(await screen.findByRole("status", { name: "Loading" })).toBeTruthy();
      expect(screen.queryByRole("img")).toBeNull();
    });

    it("should be the error card without Try again when the connection is gone, never a skeleton", async () => {
      await renderLoadedPage();
      await screen.findByRole("status", { name: "Loading" });

      act(() => {
        onlineManager.setOnline(false);
      });

      const alert = await screen.findByRole("alert");
      expect(within(alert).getByRole("heading", { name: PROGRAM_ERROR.title })).toBeTruthy();
      expect(screen.queryByRole("status", { name: "Loading" })).toBeNull();
      expect(screen.queryByRole("button", { name: PROGRAM_ERROR.retryLabel })).toBeNull();
    });
  });

  describe("when the connection goes while the page is open", () => {
    it("should keep the weeks already read", async () => {
      programBackend.snapshots = goldenSnapshots();
      await renderLoadedPage();
      await screen.findByRole("img", { name: GOLDEN_SUMMARY });

      act(() => {
        onlineManager.setOnline(false);
      });

      await waitFor(() => {
        expect(screen.getByText(PROGRAM_SCREEN.offlineBody)).toBeTruthy();
      });
      expect(screen.getByRole("img", { name: GOLDEN_SUMMARY })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });
});

describe("How it works", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-30T12:00:00Z"));
    resetProgramBackend();
    programBackend.snapshots = goldenSnapshots();
    stubWidth(WIDE_COLUMN_WIDTH);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  async function openExplainer() {
    await renderLoadedPage();
    const row = screen.getByRole("button", { name: PROGRAM_SCREEN.howItWorksLabel });
    // A click does not focus a button in Safari and Firefox on macOS, so the row is not focused here.
    expect(document.activeElement).not.toBe(row);
    act(() => {
      row.click();
    });
    return { row, dialog: await screen.findByRole("dialog", { name: "How your programme works" }) };
  }

  it("should be a row of the card named Programme, which has no heading", async () => {
    await renderLoadedPage();

    const card = screen.getByRole("region", { name: PROGRAM_SCREEN.title });
    expect(within(card).getByRole("button", { name: PROGRAM_SCREEN.howItWorksLabel })).toBeTruthy();
    expect(within(card).queryByRole("heading")).toBeNull();
  });

  it("should open the dialog with the seven sections and the not-medical-advice line", async () => {
    const { dialog } = await openExplainer();

    expect(
      within(dialog)
        .getAllByRole("heading", { level: 3 })
        .map((heading) => heading.textContent),
    ).toEqual([
      "Your expenditure",
      "The weekly check-in",
      "The first two weeks",
      "What a check-in needs",
      "The likely range",
      "Guardrails",
      "Water, glycogen and muscle",
    ]);
    expect(within(dialog).getByText(PROGRAM_SCREEN.notMedicalAdvice)).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeTruthy();
  });

  it("should name the weekday of the next check-in", async () => {
    // 6 November 2026 is a Friday, and the programme started on a Wednesday.
    programBackend.program = {
      ...(programBackend.program ?? {}),
      started_on: "2026-10-07",
      next_checkin_date: "2026-11-06",
    };

    const { dialog } = await openExplainer();

    expect(within(dialog).getByText(/^Every Friday, the day you started/)).toBeTruthy();
  });

  it("should name the weekday of the start when no check-in is set", async () => {
    programBackend.program = {
      ...(programBackend.program ?? {}),
      started_on: "2026-10-07",
      next_checkin_date: null,
    };

    const { dialog } = await openExplainer();

    expect(within(dialog).getByText(/^Every Wednesday, the day you started/)).toBeTruthy();
  });

  it("should open while the programme is settling", async () => {
    programBackend.snapshots = [startSnapshotRow("2026-10-26", 2580, 13_700)];

    const { dialog } = await openExplainer();

    expect(within(dialog).getAllByRole("heading", { level: 3 })).toHaveLength(7);
  });

  it("should name the weekday of a next check-in that is already past", async () => {
    // 16 October 2026 is a Friday, two weeks before the clock's day.
    programBackend.program = {
      ...(programBackend.program ?? {}),
      started_on: "2026-10-07",
      next_checkin_date: "2026-10-16",
    };

    const { dialog } = await openExplainer();

    expect(within(dialog).getByText(/^Every Friday, the day you started/)).toBeTruthy();
  });

  it("should return focus to the row on Escape, even when the click did not focus it", async () => {
    const { row, dialog } = await openExplainer();

    fireEvent.keyDown(dialog, { key: "Escape" });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(document.activeElement).toBe(row);
  });

  it("should close on Done and return focus to the row, even when the click did not focus it", async () => {
    const { row, dialog } = await openExplainer();

    act(() => {
      within(dialog).getByRole("button", { name: "Done" }).click();
    });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(row);
  });

  it("should stay on and open when the connection is gone", async () => {
    await renderLoadedPage();
    act(() => {
      onlineManager.setOnline(false);
    });
    await screen.findByText(PROGRAM_SCREEN.offlineBody);

    act(() => {
      screen.getByRole("button", { name: PROGRAM_SCREEN.howItWorksLabel }).click();
    });

    expect(await screen.findByRole("dialog", { name: "How your programme works" })).toBeTruthy();
  });

  it("should draw no row when the summary holds no programme", async () => {
    programBackend.program = null;

    renderWithProgramBackend(<ProgramActionsCard />);
    await waitFor(() => {
      expect(programBackend.requests.some((request) => request.table === "programs")).toBe(true);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });

    expect(screen.queryByRole("region", { name: PROGRAM_SCREEN.title })).toBeNull();
    expect(screen.queryByRole("button", { name: PROGRAM_SCREEN.howItWorksLabel })).toBeNull();
  });

  it("should not be on the page with no programme", async () => {
    programBackend.program = null;
    programBackend.snapshots = [];

    renderWithProgramBackend(<ProgramScreen />);
    await screen.findByRole("heading", { level: 2, name: "Let Ki-Lo set your targets" });

    expect(screen.queryByRole("button", { name: PROGRAM_SCREEN.howItWorksLabel })).toBeNull();
    expect(screen.queryByRole("img")).toBeNull();
  });
});
