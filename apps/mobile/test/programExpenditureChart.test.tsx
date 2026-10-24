import "./support/gestureHandler";

import { KeyLowProvider } from "@keylow/api-client";
import { act, render, screen, userEvent } from "@testing-library/react-native";

import { ProgramScreen } from "../components/ProgramScreen";
import { ExpenditureChartCard } from "../components/ProgramScreen/ExpenditureChartCard";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend, resetDiaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import {
  PROGRAM_ID,
  programBackend,
  programClient,
  resetProgramBackend,
  showGoldenFirstCheckin,
  showGoldenProgram,
  showSettlingProgram,
} from "./support/programBackend";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);

// Moves the date the card reads to the day a test names and leaves every timer running.
const ONLY_THE_DATE = [
  "hrtime",
  "nextTick",
  "performance",
  "queueMicrotask",
  "requestAnimationFrame",
  "cancelAnimationFrame",
  "requestIdleCallback",
  "cancelIdleCallback",
  "setImmediate",
  "clearImmediate",
  "setInterval",
  "clearInterval",
  "setTimeout",
  "clearTimeout",
] as const;

const FRIDAY_23_OCTOBER = "2026-10-23T09:00:00Z";
const SATURDAY_24_OCTOBER = "2026-10-24T09:00:00Z";
const MONDAY_26_OCTOBER = "2026-10-26T09:00:00Z";
const WEDNESDAY_28_OCTOBER = "2026-10-28T09:00:00Z";
const MONDAY_9_NOVEMBER = "2026-11-09T09:00:00Z";

function setToday(now: string) {
  jest.useFakeTimers({ now: new Date(now), doNotFake: [...ONLY_THE_DATE] });
}

// The axis values, the week labels and the legend are hidden from screen readers, so a query has to ask for them.
const hiddenToo = { includeHiddenElements: true };

const FIVE_WEEKS =
  "Estimated expenditure over 5 weeks: 2,500 kcal a day in the week of 21 September, 2,580 now, likely 2,430 to 2,730.";
const TWO_WEEKS =
  "Estimated expenditure over 2 weeks: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.";
const ONE_WEEK =
  "Estimated expenditure this week: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.";

/** The start snapshot the golden fixture began from, which `showGoldenProgram` leaves out: the chart's first two weeks. */
function addGoldenStartSnapshot() {
  programBackend.snapshots.push({
    id: "66666666-6666-4666-8666-666666666660",
    program_id: PROGRAM_ID,
    as_of_date: "2026-09-25",
    kind: "start",
    mu_kcal: 2500,
    var_kcal2: 140625,
    measurement: null,
  });
}

function providers(children: React.ReactNode) {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={programClient} queryClient={createDiaryQueryClient()}>
        {children}
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function renderCard() {
  await render(providers(<ExpenditureChartCard />));
}

async function renderProgramScreen() {
  await render(providers(<ProgramScreen />));
}

type RenderedNode = string | { children: readonly RenderedNode[] | null };

function textsInOrder(node: RenderedNode | readonly RenderedNode[] | null): string[] {
  if (node === null) {
    return [];
  }
  if (typeof node === "string") {
    return [node];
  }
  if ("children" in node) {
    return textsInOrder(node.children);
  }
  return node.flatMap((child) => textsInOrder(child));
}

describe("the expenditure chart card", () => {
  beforeEach(() => {
    resetRouterMock();
    resetDiaryBackend();
    resetProgramBackend();
  });

  afterEach(async () => {
    jest.useRealTimers();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  describe("with the golden fixture after its third check-in (expenditure-chart: default)", () => {
    beforeEach(() => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
      addGoldenStartSnapshot();
    });

    it("should be one image named by the five weeks' sentence", async () => {
      await renderCard();

      expect(await screen.findByRole("img", { name: FIVE_WEEKS })).toBeOnTheScreen();
    });

    it("should write the sentence under the chart", async () => {
      await renderCard();

      expect(await screen.findByText(FIVE_WEEKS)).toBeOnTheScreen();
    });

    it("should write the axis to the nearest 10, with a thousands separator: 2,980, 2,500 and 2,020", async () => {
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("2,980", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("2,500", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("2,020", hiddenToo)).toBeOnTheScreen();
    });

    it("should label the chart and its unit", async () => {
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("Expenditure by week")).toBeOnTheScreen();
      expect(screen.getByText("kcal a day")).toBeOnTheScreen();
    });

    it("should name the line and the band in the legend", async () => {
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("Estimate", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("Likely range", hiddenToo)).toBeOnTheScreen();
    });

    it("should label every second week back from the latest: 21 Sep, 5 Oct and 19 Oct", async () => {
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("21 Sep", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("5 Oct", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("19 Oct", hiddenToo)).toBeOnTheScreen();
    });
  });

  describe("while settling (expenditure-chart: few-points)", () => {
    beforeEach(() => {
      showSettlingProgram();
    });

    it("should be named by the two weeks' sentence on Wednesday 28 October", async () => {
      setToday(WEDNESDAY_28_OCTOBER);
      await renderCard();

      expect(await screen.findByRole("img", { name: TWO_WEEKS })).toBeOnTheScreen();
    });

    it("should be named by the one week's sentence on Saturday 24 October", async () => {
      setToday(SATURDAY_24_OCTOBER);
      await renderCard();

      expect(await screen.findByRole("img", { name: ONE_WEEK })).toBeOnTheScreen();
    });

    it("should write the starting estimate's range on the axis, the middle (2,415) rounded to 10", async () => {
      setToday(SATURDAY_24_OCTOBER);
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("2,880", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("2,420", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("1,950", hiddenToo)).toBeOnTheScreen();
    });
  });

  describe("on the Monday after the third check-in, when the new week has no estimate yet", () => {
    beforeEach(() => {
      setToday(MONDAY_26_OCTOBER);
      showGoldenProgram();
      addGoldenStartSnapshot();
    });

    it("should still be 5 weeks, ending with the check-in's week", async () => {
      await renderCard();

      expect(await screen.findByRole("img", { name: FIVE_WEEKS })).toBeOnTheScreen();
    });

    it("should label the first week, 21 Sep, and not the empty week after the check-in", async () => {
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("21 Sep", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("19 Oct", hiddenToo)).toBeOnTheScreen();
      expect(screen.queryByText("26 Oct", hiddenToo)).not.toBeOnTheScreen();
    });
  });

  describe("with a week in the middle that has no estimate (expenditure-chart: gap)", () => {
    beforeEach(() => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
      addGoldenStartSnapshot();
      programBackend.snapshots = programBackend.snapshots.filter(
        (row) => row["as_of_date"] !== "2026-10-16",
      );
    });

    it("should count the empty week among the 5 and read from the first estimate", async () => {
      await renderCard();

      expect(await screen.findByRole("img", { name: FIVE_WEEKS })).toBeOnTheScreen();
    });

    it("should leave the empty week a gap and not a value of 0, so the axis stays 2,980, 2,500 and 2,020", async () => {
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("2,980", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("2,500", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("2,020", hiddenToo)).toBeOnTheScreen();
      expect(screen.queryByText("0", hiddenToo)).not.toBeOnTheScreen();
    });
  });

  describe("with a wide range in a middle week", () => {
    it("should widen the axis to that week's range: 1,290, 2,580 and 3,860", async () => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
      addGoldenStartSnapshot();
      programBackend.snapshots = programBackend.snapshots.map((row) =>
        row["as_of_date"] === "2026-10-16" ? { ...row, var_kcal2: 1_000_000 } : row,
      );
      await renderCard();
      await screen.findByRole("img");

      expect(screen.getByText("3,860", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("2,580", hiddenToo)).toBeOnTheScreen();
      expect(screen.getByText("1,290", hiddenToo)).toBeOnTheScreen();
    });
  });

  describe("the history it reads", () => {
    it("should read 12 weeks back from today: from 31 July on Friday 23 October", async () => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
      await renderCard();
      await screen.findByRole("img");

      const historyReads = diaryBackend.requests.filter(
        (request) =>
          request.table === "expenditure_snapshots" && request.search.includes("as_of_date.asc"),
      );

      expect(historyReads).toHaveLength(1);
      expect(historyReads[0]?.search).toContain("as_of_date=gte.2026-07-31");
    });

    it("should take today in the profile's zone: Monday 26 October in Auckland at 20:00 UTC on Sunday", async () => {
      jest.useFakeTimers({
        now: new Date("2026-10-25T20:00:00Z"),
        doNotFake: [...ONLY_THE_DATE],
      });
      diaryBackend.timezone = "Pacific/Auckland";
      showSettlingProgram();
      await renderCard();

      expect(await screen.findByRole("img", { name: TWO_WEEKS })).toBeOnTheScreen();
    });
  });

  describe("while still settling after more than 2 weeks", () => {
    it("should keep saying it is a starting estimate, over 4 weeks on Monday 9 November", async () => {
      setToday(MONDAY_9_NOVEMBER);
      showSettlingProgram();
      await renderCard();

      expect(
        await screen.findByRole("img", {
          name: "Estimated expenditure over 4 weeks: 2,413 kcal a day, a starting estimate from your answers, likely 1,950 to 2,880.",
        }),
      ).toBeOnTheScreen();
    });
  });

  describe("with no snapshot yet (expenditure-chart: empty)", () => {
    beforeEach(() => {
      setToday(FRIDAY_23_OCTOBER);
    });

    it("should keep its label and say there are no estimates yet", async () => {
      await renderCard();

      expect(await screen.findByRole("heading", { name: "No estimates yet" })).toBeOnTheScreen();
      expect(screen.getByText("Expenditure by week")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Your expenditure shows here week by week, starting from your setup answers.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });
  });

  describe("while the history is being read", () => {
    it("should draw nothing", async () => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
      diaryBackend.hungTables.add("expenditure_snapshots");
      await renderCard();

      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading")).not.toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });
  });

  describe("when the terms are not accepted", () => {
    it("should read no snapshot", async () => {
      showGoldenProgram();
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderCard();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(
        diaryBackend.requests.filter((request) => request.table === "expenditure_snapshots"),
      ).toEqual([]);
    });
  });

  describe("when the history cannot be read", () => {
    beforeEach(() => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
      programBackend.expenditureHistoryFails = true;
    });

    it("should say it could not load, with a retry, and not draw the chart", async () => {
      await renderCard();

      expect(await screen.findByRole("alert")).toHaveTextContent(/Couldn't load your programme/);
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });

    it("should read again and draw the chart when Try again is pressed", async () => {
      const user = userEvent.setup();
      await renderCard();
      const retry = await screen.findByRole("button", { name: "Try again" });
      programBackend.expenditureHistoryFails = false;
      await user.press(retry);

      expect(await screen.findByRole("img")).toBeOnTheScreen();
      expect(screen.queryByRole("alert")).not.toBeOnTheScreen();
    });

    it("should leave the rest of the Programme screen standing", async () => {
      await renderProgramScreen();

      expect(await screen.findByText("Couldn't load your programme")).toBeOnTheScreen();
      expect(
        screen.getByLabelText(
          "Estimated expenditure, 2,580 kilocalories a day, likely 2,430 to 2,730 kcal",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Programme" })).toBeOnTheScreen();
    });
  });

  describe("on the Programme screen", () => {
    it("should sit after the check-in card and before the programme's own settings", async () => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenFirstCheckin();
      await renderProgramScreen();
      await screen.findByRole("img");

      const texts = textsInOrder(screen.toJSON());
      const checkIn = texts.indexOf("Last check-in");
      const chart = texts.indexOf("Expenditure by week");
      const settings = texts.indexOf("Your programme");

      expect(checkIn).toBeGreaterThan(-1);
      expect(chart).toBeGreaterThan(checkIn);
      expect(settings).toBeGreaterThan(chart);
    });

    it("should read the history without limiting it to the active programme", async () => {
      setToday(FRIDAY_23_OCTOBER);
      showGoldenProgram();
      await renderProgramScreen();
      await screen.findByRole("img");

      const historyReads = diaryBackend.requests.filter(
        (request) =>
          request.table === "expenditure_snapshots" && request.search.includes("as_of_date.asc"),
      );

      expect(historyReads.length).toBeGreaterThan(0);
      expect(historyReads.every((request) => !request.search.includes("program_id=eq"))).toBe(true);
    });
  });
});
