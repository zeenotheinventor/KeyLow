import { KeyLowProvider } from "@keylow/api-client";
import { QueryClient } from "@tanstack/react-query";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { DashboardFrame } from "../components/DashboardScreen/DashboardFrame";
import { ThemeProvider } from "../lib/theme";
import { useReadsEnabled } from "../lib/useReadsEnabled";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { streakStatsClient } from "./support/streakFixtures";

import type { StreakStatsOptions } from "./support/streakFixtures";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);
jest.mock("../lib/useReadsEnabled");
// 13:00 on Thursday 19 November 2026, UTC, after yesterday has settled.
const mockNow = new Date("2026-11-19T13:00:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

setUpTests();

const phone = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, right: 0, bottom: 34, left: 0 },
};

describe("the Dashboard's streak chip", () => {
  let styles: string;
  let queryClient: QueryClient;

  beforeAll(async () => {
    styles = await compileKitStyles("", [
      "components/DashboardScreen",
      "components/StreakChip",
      "components/StreakCalendar",
      "components/StreakCalendarSheet",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(styles);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity } },
    });
    jest.mocked(useReadsEnabled).mockReturnValue(true);
  });

  afterEach(() => {
    queryClient.clear();
  });

  async function renderDashboard(options: StreakStatsOptions | "fails") {
    const { client } = streakStatsClient(options);
    await render(
      <SafeAreaProvider initialMetrics={phone}>
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={client} queryClient={queryClient}>
            <DashboardFrame eyebrow="Thursday 19 November">
              <Text>Day content</Text>
            </DashboardFrame>
          </KeyLowProvider>
        </ThemeProvider>
      </SafeAreaProvider>,
    );
  }

  it("should show the streak and ask to complete today while today is not complete", async () => {
    await renderDashboard({ completeDays: ["2026-11-16", "2026-11-17", "2026-11-18"] });

    expect(
      await screen.findByRole("button", {
        name: "3 day streak, not complete today. Open streak calendar",
      }),
    ).toBeOnTheScreen();
    expect(screen.getByText("3 · Complete today")).toBeOnTheScreen();
  });

  it("should show only the number once today is complete", async () => {
    await renderDashboard({
      completeDays: ["2026-11-17", "2026-11-18", "2026-11-19"],
    });

    expect(
      await screen.findByRole("button", { name: "3 day streak. Open streak calendar" }),
    ).toBeOnTheScreen();
  });

  it("should invite a first streak when there is none", async () => {
    await renderDashboard({});

    expect(
      await screen.findByRole("button", { name: "Start a streak. Open streak calendar" }),
    ).toBeOnTheScreen();
  });

  it("should open the calendar, with the frozen day marked", async () => {
    const user = userEvent.setup();
    await renderDashboard({
      completeDays: [
        "2026-11-12",
        "2026-11-13",
        "2026-11-15",
        "2026-11-16",
        "2026-11-17",
        "2026-11-18",
      ],
      earnedFreezes: 1,
    });

    await user.press(await screen.findByRole("button", { name: /Open streak calendar/ }));

    expect(await screen.findByLabelText("Your streak")).toHaveProp("role", "dialog");
    expect(screen.getByRole("heading", { name: "Your streak" })).toBeOnTheScreen();
    expect(screen.getByLabelText("14, frozen")).toBeOnTheScreen();
    expect(screen.getByLabelText("19, today, not complete yet")).toBeOnTheScreen();
    expect(screen.getByLabelText(/freezes held/)).toBeOnTheScreen();
  });

  it("should leave the chip out and keep the screen when the streak cannot be read", async () => {
    await renderDashboard("fails");

    expect(screen.getByText("Day content")).toBeOnTheScreen();
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /Open streak calendar/ })).not.toBeOnTheScreen();
    });
  });
});
