import { KeyLowProvider } from "@keylow/api-client";
import { addCalendarDays, toLocalDate } from "@keylow/core/dates";
import { render, screen } from "@testing-library/react-native";

import { WeightScreen } from "../../components/WeightScreen";
import { ThemeProvider } from "../../lib/theme";
import { resetRouterMock } from "../support/expoRouterMock";
import {
  createWeightQueryClient,
  resetWeightBackend,
  weightBackend,
  weightClient,
  weighInRow,
} from "../support/weightBackend";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
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

async function renderWeightScreen() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={weightClient} queryClient={createWeightQueryClient()}>
        <WeightScreen />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

const today = () => toLocalDate(new Date(), "Europe/London");

// Every reading is taken in UTC, so a clock time reads as written whatever the season.
const reading = (daysAgo: number, utcTime: string, weightKg: number, source?: "health_connect") =>
  weighInRow({
    localDate: addCalendarDays(today(), -daysAgo),
    utcTime,
    weightKg,
    timeZone: "UTC",
    ...(source === undefined ? {} : { source }),
  });

// A fixed Saturday that is neither today nor yesterday, with a reading far from the rest on it.
const outlierDay = "2026-10-10";

// The seed's shape: an import today, a manual weigh-in yesterday, and older weeks around 82 kg with one
// reading of 99 kg that the trend leaves out. Newest first, as the list reads them.
function seedWeighIns() {
  const olderDays = ["2026-10-09", "2026-10-08", "2026-10-07", "2026-10-06", "2026-10-05"];
  const earlierDays = ["2026-10-03", "2026-10-02", "2026-10-01", "2026-09-30", "2026-09-29"];
  weightBackend.weighIns = [
    reading(0, "07:42", 81.6, "health_connect"),
    reading(1, "07:50", 81.9),
    weighInRow({ localDate: outlierDay, utcTime: "08:00", weightKg: 99, timeZone: "UTC" }),
    ...[...olderDays, ...earlierDays].map((localDate, index) =>
      weighInRow({
        localDate,
        utcTime: "07:30",
        weightKg: 82 + (index % 3) * 0.2,
        timeZone: "UTC",
      }),
    ),
  ];
}

type Instance = NonNullable<ReturnType<typeof screen.getByRole>>;

function isInside(node: Instance | null, ancestor: Instance): boolean {
  return node !== null && (node === ancestor || isInside(node.parent, ancestor));
}

// Icons are decoration with no role, so the drawings in a row are counted.
function drawingsIn(row: Instance) {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView" && isInside(node, row)) ?? [];
}

const rowNames = () =>
  screen.getAllByLabelText(/ kg$/).map((row) => String(row.props["aria-label"]));

describe("the Weight screen's list", () => {
  beforeEach(() => {
    resetRouterMock();
    resetWeightBackend();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should be headed Weigh-ins", async () => {
    seedWeighIns();
    await renderWeightScreen();

    expect(await screen.findByRole("heading", { name: "Weigh-ins" })).toBeOnTheScreen();
  });

  it("should read the rows newest first, each with its day, time, source, weight and what the trend did", async () => {
    seedWeighIns();
    await renderWeightScreen();
    await screen.findByRole("heading", { name: "Weigh-ins" });

    expect(rowNames().slice(0, 3)).toEqual([
      "Today, 07:42 · Health Connect, 81.6 kg",
      "Yesterday, 07:50 · Added by you, 81.9 kg",
      "Sat 10 Oct, 08:00 · Added by you, Left out of trend, 99.0 kg",
    ]);
  });

  it("should badge only the reading the trend left out", async () => {
    seedWeighIns();
    await renderWeightScreen();
    await screen.findByRole("heading", { name: "Weigh-ins" });

    expect(screen.getAllByText("Left out of trend")).toHaveLength(1);
  });

  it("should draw only the source icon in a row, with no chevron, because a row goes nowhere", async () => {
    seedWeighIns();
    await renderWeightScreen();
    await screen.findByRole("heading", { name: "Weigh-ins" });

    const rows = screen.getAllByLabelText(/ kg$/);

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(drawingsIn(row)).toHaveLength(1);
    }
  });

  it("should not offer a row as a button", async () => {
    seedWeighIns();
    await renderWeightScreen();
    await screen.findByRole("heading", { name: "Weigh-ins" });

    expect(screen.queryByRole("button", { name: / kg$/ })).not.toBeOnTheScreen();
  });

  it("should tell a manual row from an imported one by its words, not by colour alone", async () => {
    seedWeighIns();
    await renderWeightScreen();
    await screen.findByRole("heading", { name: "Weigh-ins" });

    expect(screen.getByText("07:42 · Health Connect")).toBeOnTheScreen();
    expect(screen.getAllByText(/Added by you/).length).toBeGreaterThan(0);
  });

  it("should take today from the profile's time zone", async () => {
    // At 23:30 UTC on 23 October it is already the 24th in Kiritimati, so its own day is today there.
    jest.useFakeTimers({
      now: new Date("2026-10-23T23:30:00Z"),
      doNotFake: [
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
      ],
    });
    weightBackend.timeZone = "Pacific/Kiritimati";
    weightBackend.weighIns = [
      weighInRow({ localDate: "2026-10-24", utcTime: "07:42", weightKg: 81.6, timeZone: "UTC" }),
    ];
    await renderWeightScreen();
    await screen.findByRole("heading", { name: "Weigh-ins" });

    expect(rowNames()).toEqual(["Today, 07:42 · Added by you, 81.6 kg"]);
  });

  describe("with a long history", () => {
    const ROWS = 1100;

    async function renderLongHistory() {
      weightBackend.weighIns = Array.from({ length: ROWS }, (_, daysAgo) =>
        reading(daysAgo, "07:30", 82),
      );
      await renderWeightScreen();
      await screen.findByRole("heading", { name: "Weigh-ins" });
    }

    it("should read all of them, over two pages", async () => {
      await renderLongHistory();

      expect(weightBackend.weighInRequestCount).toBe(2);
    });

    it("should draw a screenful of rows to start with, not all 1,100", async () => {
      await renderLongHistory();

      // A virtualised list draws its initial rows and no more until it is scrolled. Testing Library does not
      // expose the list's own props, so the count of rows drawn is what shows it.
      const drawn = screen.getAllByLabelText(/ kg$/).length;

      expect(drawn).toBeGreaterThan(0);
      expect(drawn).toBeLessThanOrEqual(15);
    });
  });
});
