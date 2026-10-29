import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { ExpoRoot, Slot, useLocalSearchParams } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import WeekAveragesRoute from "../../app/week";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  noTargets,
  resetDiaryBackend,
} from "../support/diaryBackend";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import {
  showEmptyWeek,
  showOverTargetWeek,
  showSampleWeek,
  showWeek,
} from "../support/weekFixtures";

import type { QueryClient } from "@tanstack/react-query";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "react-native-safe-area-context",
  () =>
    jest.requireActual<{ default: unknown }>("react-native-safe-area-context/jest/mock").default,
);
// 11:20 in London on Thursday 15 October 2026, unless a test moves it.
const THURSDAY = new Date("2026-10-15T10:20:00Z");
let mockNow = THURSDAY;
jest.mock("../../lib/useNow", () => ({ useNow: () => mockNow }));

let queryClient: QueryClient;

function Providers() {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={queryClient}>
        <ToastProvider>
          <Slot />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

// The diary has its own tests. Here it shows the day it was opened on.
function DiaryStandIn() {
  const { day } = useLocalSearchParams<{ day?: string }>();

  return <Text role="heading">{`Diary day=${day ?? "none"}`}</Text>;
}

const routes = {
  _layout: Providers,
  "(tabs)/diary": DiaryStandIn,
  week: WeekAveragesRoute,
};

async function renderScreen() {
  await render(<ExpoRoot context={getMockContext(routes)} location="/week" />);
}

const rowsOf = async (heading: string) =>
  within(await screen.findByLabelText(heading))
    .getAllByRole("listitem")
    .map((row) => row.props["aria-label"] as string);

let kitStyles: string;

beforeAll(async () => {
  kitStyles = await compileKitStyles("", [
    "components/WeekAveragesScreen",
    "components/NutrientTable",
    "components/DashboardScreen",
    "app",
  ]);
});

beforeEach(() => {
  registerAppStyles(kitStyles);
  mockNow = THURSDAY;
  resetDiaryBackend();
  showSampleWeek();
  queryClient = createDiaryQueryClient();
});

afterEach(async () => {
  await cleanup();
  queryClient.clear();
});

describe("the weekly averages screen", () => {
  it("should head the screen and name the week", async () => {
    await renderScreen();

    expect(await screen.findByRole("heading", { name: "Weekly averages" })).toBeOnTheScreen();
    expect(await screen.findByText("Week of Mon 12 Oct, Mon to yesterday")).toBeOnTheScreen();
  });

  it("should list every nutrient's daily average against its target, from Monday to yesterday", async () => {
    await renderScreen();

    // Monday 2,140, Tuesday 2,260 and Wednesday 1,286: today's 1,039 is left out.
    expect(await rowsOf("Daily average")).toEqual([
      "Energy: 1,895 / 2,200 kcal",
      "Protein: 95 / 160 g",
      "Carbohydrate: 190 / 220 g",
      "Fat: 63 / 70 g",
      "Fibre: not given",
      "Saturated fat: not given",
      "Sugars: not given",
      "Salt: not given",
    ]);
  });

  it("should list the week so far as totals, leaving out today", async () => {
    await renderScreen();

    expect((await rowsOf("Week so far")).slice(0, 4)).toEqual([
      "Energy: 5,686 kcal",
      "Protein: 284 g",
      "Carbohydrate: 569 g",
      "Fat: 190 g",
    ]);
  });

  it("should not change a number when today's entries change", async () => {
    showWeek([2140, 2260, 1286, 3500], ["2026-10-12", "2026-10-13"]);
    await renderScreen();

    expect((await rowsOf("Daily average"))[0]).toBe("Energy: 1,895 / 2,200 kcal");
    expect((await rowsOf("Week so far"))[0]).toBe("Energy: 5,686 kcal");
  });

  it("should draw the calories average over the days logged before today, captioned Mon to yesterday", async () => {
    await renderScreen();

    expect(await screen.findByText("From 3 days with food logged")).toBeOnTheScreen();
    expect(screen.getByText("· Mon to yesterday")).toBeOnTheScreen();
    expect(screen.queryByText(/Mon to today/)).toBeNull();
  });

  it("should print the overshoot of the days before today", async () => {
    // Monday 2,140, Tuesday 2,260 and Wednesday 2,988 average 2,463, which is 263 over.
    showOverTargetWeek();
    await renderScreen();

    expect(await screen.findByText("+263 kcal")).toBeOnTheScreen();
  });

  it("should write the averages alone when no target is set", async () => {
    diaryBackend.targets = noTargets;
    await renderScreen();

    expect((await rowsOf("Daily average")).slice(0, 2)).toEqual([
      "Energy: 1,895 kcal",
      "Protein: 95 g",
    ]);
  });

  it("should say the averages start tomorrow on a Monday, with no tables", async () => {
    // 11:20 in London on Monday 12 October 2026.
    mockNow = new Date("2026-10-12T10:20:00Z");
    await renderScreen();

    expect(await screen.findByText("Your averages start tomorrow.")).toBeOnTheScreen();
    expect(screen.getByText("Week of Mon 12 Oct")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Daily average")).toBeNull();
    expect(screen.getByRole("button", { name: "See each day in the diary" })).toBeOnTheScreen();
  });

  it("should say nothing is logged before today when only today has entries", async () => {
    showWeek([null, null, null, 1039]);
    await renderScreen();

    expect(await screen.findByText("Nothing logged before today this week.")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Daily average")).toBeNull();
  });

  it("should say nothing is logged before today, with no tables, for an empty week", async () => {
    showEmptyWeek();
    await renderScreen();

    expect(await screen.findByText("Nothing logged before today this week.")).toBeOnTheScreen();
    expect(screen.queryByLabelText("Daily average")).toBeNull();
  });

  it("should open the diary on today for the days one by one", async () => {
    const user = userEvent.setup();
    await renderScreen();

    await user.press(await screen.findByRole("button", { name: "See each day in the diary" }));

    expect(await screen.findByRole("heading", { name: "Diary day=2026-10-15" })).toBeOnTheScreen();
  });

  it("should offer Try again when the week fails to load", async () => {
    diaryBackend.weekReadsFail = true;
    await renderScreen();

    expect(await screen.findByText("Couldn't load this week")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
  });
});
