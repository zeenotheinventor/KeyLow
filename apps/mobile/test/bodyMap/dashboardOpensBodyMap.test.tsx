import { KeyLowProvider, keys } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { ExpoRoot, Slot } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { setUpTests } from "react-native-reanimated";

import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
import BodyMapRoute from "../../app/body-map";
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

import type { ActiveRoutine, TrainingSet } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";

// The figure is already chosen (Male), so the screen does not stop to ask. The figure tests cover the question.
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: {
    getItem: (key: string) => Promise.resolve(key === "bodyMap.figure" ? "male" : null),
    setItem: () => Promise.resolve(),
  },
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
const NO_DAYS_ROUTINE: ActiveRoutine = {
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
  "body-map": BodyMapRoute,
};

describe("the dashboard card opening the body map", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/DashboardScreen",
      "components/BodyMapScreen",
      "components/BodyMapCard",
      "components/BodyMapLegend",
      "components/ViewLabel",
      "app",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    showSampleWeek();
    queryClient = createDiaryQueryClient();
    queryClient.setQueryData(keys.profiles.timeZone, "Europe/London");
    queryClient.setQueryData(keys.training.activeRoutine, NO_DAYS_ROUTINE);
    queryClient.setQueryData(keys.training.goals, null);
    queryClient.setQueryData(keys.training.sets("2026-09-27"), trainingSets);
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

  it("should open the body map, Actual heat with the legend, when the card is pressed", async () => {
    await render(<ExpoRoot context={getMockContext(routes)} location="/dashboard" />);
    const user = userEvent.setup();

    await user.press(await screen.findByRole("button", { name: /Open the body map$/ }));

    expect(await screen.findByRole("heading", { name: "Body map" })).toBeOnTheScreen();
    expect(
      await screen.findByRole("img", { name: "Body map, Actual, heat, front" }),
    ).toBeOnTheScreen();
    expect(screen.getByRole("group", { name: "Heat legend" })).toBeOnTheScreen();
  });

  it("should go back to the Dashboard from the body map", async () => {
    await render(<ExpoRoot context={getMockContext(routes)} location="/dashboard" />);
    const user = userEvent.setup();
    await user.press(await screen.findByRole("button", { name: /Open the body map$/ }));

    await user.press(await screen.findByRole("button", { name: "Back" }));

    expect(await screen.findByRole("button", { name: /Open the body map$/ })).toBeOnTheScreen();
    expect(screen.queryByRole("heading", { name: "Body map" })).not.toBeOnTheScreen();
  });
});
