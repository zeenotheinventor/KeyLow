import { KeyLowProvider } from "@keylow/api-client";
import { cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { AssistantSheetHost } from "../components/AssistantSheetHost";
import { DiaryScreen } from "../components/DiaryScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  resetDiaryBackend,
  sampleDay,
} from "./support/diaryBackend";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { installVirtualClock } from "./support/virtualClock";

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
// 11:20 in London on Thursday 15 October 2026.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});

const planRow = (confirmedAt: string | null) => ({
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  start_date: "2026-10-15",
  day_count: 1,
  rules: {},
  source: "assistant",
  archived_at: null,
  created_at: "2026-10-14T10:00:00+00:00",
  meal_plan_days: [
    {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      local_date: "2026-10-15",
      target: { kcal: 1300, protein_g: 90 },
      confirmed_at: confirmedAt,
      confirmed_entry_ids: null,
      meal_plan_items: [
        {
          id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          position: 0,
          slot_time: "07:30:00",
          item_type: "food",
          food_id: "55555555-5555-4555-8555-555555555555",
          recipe_id: null,
          servings: null,
          grams: 50,
          portion_id: null,
          nutrients: { kcal: 1294, protein_g: 93 },
          leftover_of: null,
          snapshot: { name: "Porridge oats" },
        },
      ],
    },
  ],
});

async function renderDiary() {
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={diaryClient} queryClient={createDiaryQueryClient()}>
        <ToastProvider>
          <AssistantSheetHost>
            <DiaryScreen />
          </AssistantSheetHost>
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  await screen.findByRole("button", { name: "Add food at 08:00" });
}

const userSetup = () => userEvent.setup({ advanceTimers: jest.advanceTimersByTime });

describe("the diary's way into the meal plan, as diary · plan-entry draws it", () => {
  beforeEach(() => {
    installVirtualClock();
    resetRouterMock();
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
  });

  afterEach(async () => {
    await cleanup();
    jest.useRealTimers();
  });

  it("should offer Meal plan first in the More sheet, and open the Plan screen on the day", async () => {
    const user = userSetup();
    await renderDiary();

    await user.press(screen.getByRole("button", { name: "More" }));
    expect(screen.getByText("Plan your week from your recipes and foods")).toBeOnTheScreen();
    await user.press(screen.getByRole("button", { name: /^Meal plan/ }));

    expect(routerMock.push).toHaveBeenCalledWith("/plan?day=2026-10-15");
  });

  it("should show Planned for today when today is in a plan and not confirmed, and open that day", async () => {
    diaryBackend.mealPlans = [planRow(null)];
    const user = userSetup();
    await renderDiary();

    const row = await screen.findByRole("button", {
      name: "Planned for today, 1 meal · 1,294 kcal · P 93 g · not confirmed",
    });
    await user.press(row);

    expect(routerMock.push).toHaveBeenCalledWith("/plan/day/2026-10-15");
  });

  it("should show no planned row on a day that is confirmed, where the entries are already in the log", async () => {
    diaryBackend.mealPlans = [planRow("2026-10-15T09:00:00+00:00")];
    await renderDiary();

    expect(screen.queryByText("Planned for today")).toBeNull();
  });

  it("should show no planned row on a day with nothing planned", async () => {
    const row = planRow(null);
    diaryBackend.mealPlans = [
      {
        ...row,
        meal_plan_days: row.meal_plan_days.map((day) => ({ ...day, meal_plan_items: [] })),
      },
    ];
    await renderDiary();

    expect(screen.queryByText("Planned for today")).toBeNull();
  });

  it("should show no planned row when there is no plan", async () => {
    await renderDiary();

    expect(screen.queryByText("Planned for today")).toBeNull();
  });
});
