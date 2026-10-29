import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";

import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
import DiaryRoute from "../../app/(tabs)/diary";
import WeekAveragesRoute from "../../app/week";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
  sampleDay,
} from "../support/diaryBackend";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { showSampleWeek } from "../support/weekFixtures";

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
// 11:20 in London on Thursday 15 October 2026.
jest.mock("../../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});

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

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

// The real Dashboard, the real weekly averages and the real Diary under the real tab layout, from one fixture.
const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": DashboardRoute,
  "(tabs)/diary": DiaryRoute,
  "(tabs)/train": standIn("Train screen"),
  "(tabs)/more": standIn("More screen"),
  targets: standIn("Targets screen"),
  week: WeekAveragesRoute,
};

const hidden = { includeHiddenElements: true };

// The sample week as the diary's week strip names its pills: Monday and Tuesday complete, Thursday today.
const dayNames = [
  "Monday 12 October, complete",
  "Tuesday 13 October, complete",
  "Wednesday 14 October",
  "Thursday 15 October, today",
  "Friday 16 October",
  "Saturday 17 October",
  "Sunday 18 October",
];

describe("the This week card and the diary's week strip, from one fixture", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/DashboardScreen",
      "components/DiaryScreen",
      "components/WeekAveragesScreen",
      "components/NutrientTable",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    showSampleWeek();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should name every day as the diary's week strip does, so the days complete are the days it ticks", async () => {
    const user = userEvent.setup();
    await render(<ExpoRoot context={getMockContext(routes)} location="/dashboard" />);
    const card = await screen.findByRole("button", {
      name: /^This week, open your weekly averages\./,
    });

    for (const name of dayNames) {
      expect(screen.getByRole("img", { name, ...hidden })).toBeOnTheScreen();
    }
    expect(card).toHaveAccessibleName(/ 2 of 4 days complete\.$/);

    await user.press(card);
    // The weekly averages read the same week but leave out today, so Thursday's 1,039 is not in the average.
    expect(await screen.findByRole("listitem", { name: /^Energy: 1,895 / })).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: "See each day in the diary" }));
    await screen.findByRole("heading", { name: "Today" });

    for (const name of dayNames) {
      expect(await screen.findByRole("button", { name })).toBeOnTheScreen();
    }
  });
});
