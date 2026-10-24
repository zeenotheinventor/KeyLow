import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen } from "@testing-library/react-native";

import { SettlingChecklist } from "./SettlingChecklist";
import { ThemeProvider } from "../../../lib/theme";
import {
  completeDayLog,
  createDiaryQueryClient,
  dayTotalsRow,
  diaryBackend,
  resetDiaryBackend,
} from "../../../test/support/diaryBackend";
import {
  programBackend,
  programClient,
  resetProgramBackend,
} from "../../../test/support/programBackend";

import type { SettlingChecklistProps } from "./types";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

/*
 * The first check-in's needs, as the board `program: settling` draws them: the setup canvas's sample man, set up
 * on Friday 23 October, weighing in on 23, 25, 27 and 28 October with 23, 24, 26 and 27 October complete, and
 * today Wednesday 28 October. The first check-in is Friday 6 November, so its window is 9 October to 5 November.
 */

const CANVAS_CASE: SettlingChecklistProps = {
  firstCheckinDate: "2026-11-06",
  daysLeft: 9,
  today: "2026-10-28",
};

const FIRST_CHECKIN_TITLE = "First check-in Friday 6 November, in 9 days";
const DAY_BEFORE_TIP =
  "Weigh in on Thursday 5 November, the day before, so your weigh-ins cover the full 14 days.";

// Newest first, as the weigh-in list reads them. The weight is steady, so no reading is a spike.
function weighInOn(...localDates: string[]): void {
  programBackend.weighIns = [...localDates]
    .sort()
    .reverse()
    .map((localDate) => ({ weight_kg: 80, local_date: localDate }));
}

// A complete day as the check-in counts it: marked complete, with something logged.
function completeOn(...localDates: string[]): void {
  diaryBackend.dayLogs = localDates.map(completeDayLog);
  diaryBackend.dayTotals = localDates.map((localDate) =>
    dayTotalsRow(localDate, [2000, 100, 200, 70]),
  );
}

function showCanvasCase(): void {
  weighInOn("2026-10-23", "2026-10-25", "2026-10-27", "2026-10-28");
  completeOn("2026-10-23", "2026-10-24", "2026-10-26", "2026-10-27");
}

async function renderChecklist(props: SettlingChecklistProps = CANVAS_CASE) {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
        <SettlingChecklist {...props} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// Long enough for every read that is not held up to answer, so that a draw nothing test cannot pass by being early.
async function letEveryReadAnswer() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 150));
  });
}

const weighDaysBar = (count: number) =>
  screen.findByRole("progressbar", { name: `Days with a weigh-in, ${count} of 8` });

describe("the settling checklist", () => {
  beforeEach(() => {
    resetDiaryBackend();
    resetProgramBackend();
  });

  describe("with the canvas case (program: settling)", () => {
    beforeEach(showCanvasCase);

    it("should say when the first check-in is and that the targets stay as they are until then", async () => {
      await renderChecklist();

      expect(await screen.findByText(FIRST_CHECKIN_TITLE)).toBeOnTheScreen();
      expect(
        screen.getByText("Until then your targets stay as they are. The check-in needs:"),
      ).toBeOnTheScreen();
    });

    it("should name the weigh-in days bar 'Days with a weigh-in, 4 of 8'", async () => {
      await renderChecklist();

      const bar = await weighDaysBar(4);

      expect(bar).toHaveProp("aria-valuenow", 4);
      expect(bar).toHaveProp("aria-valuemax", 8);
    });

    it("should name the cover bar 'Days your weigh-ins cover, 6 of 14'", async () => {
      await renderChecklist();

      const bar = await screen.findByRole("progressbar", {
        name: "Days your weigh-ins cover, 6 of 14",
      });

      expect(bar).toHaveProp("aria-valuenow", 6);
      expect(bar).toHaveProp("aria-valuemax", 14);
    });

    it("should name the complete days bar 'Complete days, 4 of 10'", async () => {
      await renderChecklist();

      const bar = await screen.findByRole("progressbar", { name: "Complete days, 4 of 10" });

      expect(bar).toHaveProp("aria-valuenow", 4);
      expect(bar).toHaveProp("aria-valuemax", 10);
    });

    it("should write each count beside its label", async () => {
      await renderChecklist();
      await weighDaysBar(4);

      // The captions are drawn but hidden from screen readers, since each bar's name already says them.
      const captions = { includeHiddenElements: true };
      expect(screen.getByText("Days with a weigh-in", captions)).toBeOnTheScreen();
      expect(
        screen.getByText("Days your weigh-ins cover, first to last", captions),
      ).toBeOnTheScreen();
      expect(screen.getByText("Complete days", captions)).toBeOnTheScreen();
      expect(screen.getByText("4 of 8", captions)).toBeOnTheScreen();
      expect(screen.getByText("6 of 14", captions)).toBeOnTheScreen();
      expect(screen.getByText("4 of 10", captions)).toBeOnTheScreen();
    });

    it("should tell them to weigh in on 5 November, the day before", async () => {
      await renderChecklist();

      expect(await screen.findByText(DAY_BEFORE_TIP)).toBeOnTheScreen();
    });
  });

  describe("the tip", () => {
    it("should say 'on or after' the date, when older weigh-ins put the needed date earlier than the day before", async () => {
      weighInOn("2026-10-20", "2026-10-23", "2026-10-25", "2026-10-27", "2026-10-28");
      await renderChecklist();

      expect(
        await screen.findByText(
          "Weigh in on or after Monday 2 November so your weigh-ins cover the full 14 days.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText(DAY_BEFORE_TIP)).not.toBeOnTheScreen();
    });

    it("should not show once the weigh-ins cover the 14 days", async () => {
      weighInOn("2026-10-14", "2026-10-28");
      await renderChecklist();

      expect(
        await screen.findByRole("progressbar", { name: "Days your weigh-ins cover, 14 of 14" }),
      ).toBeOnTheScreen();
      expect(screen.queryByText(/Weigh in on/)).not.toBeOnTheScreen();
    });

    it("should not show when the date that would complete the cover has gone by", async () => {
      weighInOn("2026-10-10", "2026-10-20");
      await renderChecklist();
      await weighDaysBar(2);

      expect(screen.queryByText(/Weigh in on/)).not.toBeOnTheScreen();
    });

    it("should not show with no weigh-in to count from", async () => {
      await renderChecklist();
      await weighDaysBar(0);

      expect(screen.queryByText(/Weigh in on/)).not.toBeOnTheScreen();
    });
  });

  describe("what counts", () => {
    it("should count a reading from before the programme was set up", async () => {
      weighInOn("2026-10-12", "2026-10-23");
      await renderChecklist();

      expect(await weighDaysBar(2)).toBeOnTheScreen();
    });

    it("should not count a reading the trend rejected as a spike", async () => {
      programBackend.weighIns = [
        ["2026-10-26", 80.3],
        ["2026-10-25", 100],
        ["2026-10-24", 80],
        ["2026-10-23", 80],
        ["2026-10-22", 80],
        ["2026-10-21", 80],
        ["2026-10-20", 80],
      ].map(([localDate, weightKg]) => ({ weight_kg: weightKg, local_date: localDate }));
      await renderChecklist();

      expect(await weighDaysBar(6)).toBeOnTheScreen();
    });

    it("should not count a day marked complete with nothing logged", async () => {
      showCanvasCase();
      diaryBackend.dayLogs.push(completeDayLog("2026-10-28"));
      await renderChecklist();

      expect(
        await screen.findByRole("progressbar", { name: "Complete days, 4 of 10" }),
      ).toBeOnTheScreen();
    });

    it("should not count a complete day whose total kilocalories are null", async () => {
      showCanvasCase();
      diaryBackend.dayLogs.push(completeDayLog("2026-10-28"));
      diaryBackend.dayTotals.push({ ...dayTotalsRow("2026-10-28", [0, 0, 0, 0]), kcal: null });
      await renderChecklist();

      expect(
        await screen.findByRole("progressbar", { name: "Complete days, 4 of 10" }),
      ).toBeOnTheScreen();
    });

    it("should not count a day with something logged that is not marked complete", async () => {
      showCanvasCase();
      diaryBackend.dayTotals.push(dayTotalsRow("2026-10-28", [1500, 80, 150, 50]));
      await renderChecklist();

      expect(
        await screen.findByRole("progressbar", { name: "Complete days, 4 of 10" }),
      ).toBeOnTheScreen();
    });

    it("should count a complete day from the part of the first week that is inside the window", async () => {
      completeOn("2026-10-10");
      await renderChecklist();

      expect(
        await screen.findByRole("progressbar", { name: "Complete days, 1 of 10" }),
      ).toBeOnTheScreen();
    });

    it("should not count a complete day from the week's first Monday that is before the window", async () => {
      completeOn("2026-10-05", "2026-10-30", "2026-11-02");
      await renderChecklist({ firstCheckinDate: "2026-11-06", daysLeft: 3, today: "2026-11-03" });

      expect(
        await screen.findByRole("progressbar", { name: "Complete days, 2 of 10" }),
      ).toBeOnTheScreen();
    });

    it("should count the complete days of both months the window touches", async () => {
      completeOn("2026-10-30", "2026-11-02");
      await renderChecklist({ firstCheckinDate: "2026-11-06", daysLeft: 3, today: "2026-11-03" });

      expect(
        await screen.findByRole("progressbar", { name: "Complete days, 2 of 10" }),
      ).toBeOnTheScreen();
    });
  });

  describe("before the reads have answered", () => {
    it("should draw nothing while the weigh-ins load, and not a count of 0", async () => {
      showCanvasCase();
      diaryBackend.hungTables.add("weigh_ins");
      await renderChecklist();
      await letEveryReadAnswer();

      expect(screen.queryByText(FIRST_CHECKIN_TITLE)).not.toBeOnTheScreen();
      expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
    });

    it.each(["2026-10-05", "2026-11-02"])(
      "should draw nothing while the week of %s loads, the first and the last alike",
      async (hungWeekStart) => {
        showCanvasCase();
        diaryBackend.hungWeekStarts.add(hungWeekStart);
        await renderChecklist();
        await letEveryReadAnswer();

        expect(screen.queryByText(FIRST_CHECKIN_TITLE)).not.toBeOnTheScreen();
        expect(screen.queryByRole("progressbar")).not.toBeOnTheScreen();
      },
    );

    it("should draw nothing when the weeks cannot be read", async () => {
      showCanvasCase();
      diaryBackend.weekReadsFail = true;
      await renderChecklist();
      await letEveryReadAnswer();

      expect(screen.queryByText(FIRST_CHECKIN_TITLE)).not.toBeOnTheScreen();
    });

    it("should not wait for a fifth week the window does not reach", async () => {
      showCanvasCase();
      // The window of a check-in on Monday 9 November is 12 October to 8 November, four weeks.
      diaryBackend.hungWeekStarts.add("2026-11-09");
      await renderChecklist({ firstCheckinDate: "2026-11-09", daysLeft: 12, today: "2026-10-28" });

      expect(await weighDaysBar(4)).toBeOnTheScreen();
    });

    it("should read nothing while the terms are not accepted", async () => {
      showCanvasCase();
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderChecklist();
      await letEveryReadAnswer();

      expect(screen.queryByText(FIRST_CHECKIN_TITLE)).not.toBeOnTheScreen();
      expect(
        diaryBackend.requests.filter((request) => !request.search.includes("terms_accepted_at")),
      ).toEqual([]);
    });
  });
});
