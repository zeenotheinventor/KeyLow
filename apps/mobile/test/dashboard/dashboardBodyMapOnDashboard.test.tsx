import { KeyLowProvider, keys } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { setUpTests } from "react-native-reanimated";

import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
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
import { expectTextsInOrder } from "../support/textsInOrder";
import { showSampleWeek } from "../support/weekFixtures";

import type { ActiveRoutine, TrainingSet } from "@keylow/api-client";
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
// 17:55 in London on Thursday 15 October 2026.
jest.mock("../../lib/useNow", () => ({
  useNow: () => new Date("2026-10-15T16:55:00Z"),
}));

setUpTests();

const LATS_EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
const REST_DAY_ROUTINE: ActiveRoutine = {
  id: "88888888-8888-4888-8888-888888888888",
  name: "Push Pull Legs",
  activatedAt: null,
  days: [],
};

const trainingSets: TrainingSet[] = [
  {
    id: "99999999-9999-4999-8999-000000000001",
    session_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    exercise_id: LATS_EXERCISE_ID,
    set_type: "working",
    rir: 0,
    rpe: null,
    performed_at: "2026-10-15T14:55:00+00:00",
    snapshot: buildSetSnapshot(
      { id: LATS_EXERCISE_ID, name: "Row", equipment: "barbell", mechanic: "compound" },
      [{ muscle_id: "lats", role: "primary", weight: 1 }],
    ),
    deleted_at: null,
  },
];

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

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": DashboardRoute,
};

async function renderDashboard() {
  await render(<ExpoRoot context={getMockContext(routes)} location="/dashboard" />);
}

const hidden = { includeHiddenElements: true };

describe("the body map card on the dashboard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen", "app"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    showSampleWeek();
    queryClient = createDiaryQueryClient();
    queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
    queryClient.setQueryData(keys.training.activeRoutine, REST_DAY_ROUTINE);
    queryClient.setQueryData(keys.training.goals, null);
    queryClient.setQueryData(keys.training.sets("2026-09-30"), trainingSets);
    queryClient.setQueryData(keys.training.weekSessions("2026-10-12"), []);
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should show on the Dashboard as soon as it merges, under Today and This week", async () => {
    await renderDashboard();

    await screen.findByLabelText(/^Body map, Actual heat now\./);
    await screen.findByRole("button", { name: /^Today, open the diary\. / });
    await screen.findByRole("button", { name: /^This week, open your weekly averages\./ });
    const titles = screen.getAllByText(/^(Today|This week|Training)$/, hidden);
    expectTextsInOrder(titles, ["Today", "This week", "Training"]);
  });

  it("should not make the Dashboard's other cards wait for it", async () => {
    diaryBackend.hungTables.add("workout_sets");
    queryClient.removeQueries({ queryKey: keys.training.sets("2026-09-30") });
    await renderDashboard();

    expect(
      await screen.findByRole("button", { name: /^Today, open the diary\. / }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("status", { name: "Loading the body map" })).toBeOnTheScreen();
  });
});
