import { KeyLowProvider } from "@keylow/api-client";
import { TRAIN_FIRST_TIME } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";
import { Text as MockText } from "react-native";
import { setUpTests } from "react-native-reanimated";

import TrainRoute from "../app/(tabs)/train";
import { AssistantSheetHost } from "../components/AssistantSheetHost";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient, diaryBackend } from "./support/diaryBackend";
import { resetRouterMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resetTrainBackend, trainBackend, trainClient } from "./support/trainBackend";
import { goldenRoutine, thursdayLegsActive } from "./support/trainGoldenWeek";
import { installVirtualClock } from "./support/virtualClock";

import type { AssistantSheetProps } from "../components/AssistantSheet";
import type { QueryClient } from "@tanstack/react-query";

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

// The clock the screen reads, which a test moves.
let mockNow = new Date("2026-10-15T18:00:00Z");
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow }));

// The sheet has its own tests. Here it is a stand-in that says whether it is open, which day it was given and
// which screen opened it, so the Train side of it is what is tested. The host the button opens it through is
// the app's own.
jest.mock("../components/AssistantSheet", () => ({
  AssistantSheet: ({ open, localDate, from }: AssistantSheetProps) => (
    <MockText>{`Assistant sheet ${open ? "open" : "closed"} on ${localDate} from ${from ?? "the diary"}`}</MockText>
  ),
}));

setUpTests();

let queryClient: QueryClient;

async function renderTrain() {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <ToastProvider>
          <AssistantSheetHost>
            <TrainRoute />
          </AssistantSheetHost>
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

describe("the Assistant button on the Train tab", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/TrainScreen",
      "components/TodayCard",
      "components/PlanWeekStrip",
      "app",
    ]);
  });

  beforeEach(() => {
    installVirtualClock();
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetTrainBackend();
    mockNow = new Date("2026-10-15T18:00:00Z");
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
    jest.useRealTimers();
  });

  it("should open the sheet from Train on today's date", async () => {
    await renderTrain();
    await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });

    await userEvent.setup().press(screen.getByRole("button", { name: "Assistant" }));

    expect(screen.getByText("Assistant sheet open on 2026-10-15 from train")).toBeOnTheScreen();
  });

  it("should give today in the profile's time zone, not in UTC", async () => {
    // 00:30 on 16 October in Auckland, which is still the evening of the 15th in UTC.
    mockNow = new Date("2026-10-15T11:30:00Z");
    diaryBackend.timezone = "Pacific/Auckland";
    await renderTrain();
    await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });

    await userEvent.setup().press(screen.getByRole("button", { name: "Assistant" }));

    expect(screen.getByText("Assistant sheet open on 2026-10-16 from train")).toBeOnTheScreen();
  });

  it("should open the sheet during a workout too", async () => {
    trainBackend.routine = goldenRoutine;
    trainBackend.activeSession = thursdayLegsActive;
    await renderTrain();
    await screen.findByRole("button", { name: "Resume Legs" });

    await userEvent.setup().press(screen.getByRole("button", { name: "Assistant" }));

    expect(screen.getByText("Assistant sheet open on 2026-10-15 from train")).toBeOnTheScreen();
  });
});
