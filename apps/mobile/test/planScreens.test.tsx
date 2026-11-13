import { MEAL_PLAN_WORDS, PLAN_SETTINGS_WORDS } from "@keylow/core/copy";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";

import PlanRoute from "../app/plan";
import PlanDayRoute from "../app/plan/day/[date]";
import PlanSettingsRoute from "../app/plan/settings";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { MealPlan } from "@keylow/api-client";

type MutationCallbacks = { onSuccess?: () => void; onError?: () => void };

const PLAN_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const TODAY = "2026-11-18";

const mockPlans: {
  plans: { data: MealPlan[] | undefined; isError: boolean; refetch: jest.Mock };
  limit: { data: number | null | undefined; isError: boolean; refetch: jest.Mock };
  targets: { data: object | undefined };
  isOnline: boolean;
  confirm: {
    mutate: jest.Mock<undefined, [{ day: { id: string } }, MutationCallbacks]>;
    isPending: boolean;
  };
  save: { mutate: jest.Mock<undefined, [number, MutationCallbacks]> };
  openAssistant: jest.Mock<undefined, [{ localDate: string; draft?: string }]>;
} = {
  plans: { data: [], isError: false, refetch: jest.fn() },
  limit: { data: 3, isError: false, refetch: jest.fn() },
  targets: { data: { kcal: 1300, protein_g: 90, carbs_g: 150, fat_g: 50 } },
  isOnline: true,
  confirm: {
    mutate: jest.fn<undefined, [{ day: { id: string } }, MutationCallbacks]>(),
    isPending: false,
  },
  save: { mutate: jest.fn<undefined, [number, MutationCallbacks]>() },
  openAssistant: jest.fn<undefined, [{ localDate: string; draft?: string }]>(),
};

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useMealPlans: () => mockPlans.plans,
  useMealPlanRepeatLimit: () => mockPlans.limit,
  useTargets: () => mockPlans.targets,
  useConfirmPlanDay: () => mockPlans.confirm,
  useSetMealPlanRepeatLimit: () => mockPlans.save,
  useProfileTimeZone: () => ({ data: "Europe/London", isError: false, refetch: jest.fn() }),
}));
jest.mock("../components/AssistantSheetHost", () => ({
  useOpenAssistant: () => mockPlans.openAssistant,
}));
jest.mock("../lib/connectivity", () => ({ useIsOnline: () => mockPlans.isOnline }));
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
const mockNow = { value: new Date("2026-11-18T12:00:00Z") };
jest.mock("../lib/useNow", () => ({ useNow: () => mockNow.value }));
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

const recipeItem = (id: string, time: string, kcal: number, protein: number, extra = {}) => ({
  kind: "recipe" as const,
  id,
  position: 0,
  slotTime: time,
  recipeId: "r1",
  servings: 1,
  nutrients: { kcal, protein_g: protein, carbs_g: 50, fat_g: 10 },
  leftoverOf: null,
  snapshot: { name: "Eval porridge bowl", servings: 1, effectiveGrams: 340 },
  ...extra,
});

const foodItem = (
  id: string,
  time: string,
  name: string,
  grams: number,
  kcal: number,
  protein: number,
) => ({
  kind: "food" as const,
  id,
  position: 1,
  slotTime: time,
  foodId: `f-${id}`,
  grams,
  portionId: null,
  nutrients: { kcal, protein_g: protein, carbs_g: 20, fat_g: 5 },
  leftoverOf: null,
  snapshot: { name },
});

const planDay = (
  id: string,
  localDate: string,
  items: MealPlan["days"][number]["items"],
  confirmedAt: string | null = null,
): MealPlan["days"][number] => ({
  id,
  localDate,
  target: { kcal: 1300, protein_g: 90 },
  confirmedAt,
  confirmedEntryIds: confirmedAt === null ? null : ["e1"],
  items,
});

// Monday confirmed, Wednesday (today) within target, Thursday short on protein.
const livePlan = (): MealPlan => ({
  id: PLAN_ID,
  startDate: "2026-11-16",
  dayCount: 7,
  rules: {},
  source: "assistant",
  archivedAt: null,
  createdAt: "2026-11-13T10:00:00Z",
  days: [
    planDay("d16", "2026-11-16", [recipeItem("a16", "07:30:00", 1296, 86)], "2026-11-16T09:00:00Z"),
    planDay("d18", "2026-11-18", [
      recipeItem("a18", "07:30:00", 389, 13),
      foodItem("b18", "12:30:00", "Chicken, breast, grilled without skin, meat only", 130, 905, 80),
    ]),
    planDay("d19", "2026-11-19", [
      foodItem("a19", "07:30:00", "Yogurt, Greek style, plain", 300, 1292, 68),
    ]),
  ],
});

async function renderRoute(element: React.ReactElement) {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <ToastProvider>{element}</ToastProvider>
    </ThemeProvider>,
  );
  return user;
}

describe("the Plan screens", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/PlanScreen",
      "components/PlanDayScreen",
      "components/PlanSettingsScreen",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockNow.value = new Date("2026-11-18T12:00:00Z");
    mockPlans.plans = { data: [livePlan()], isError: false, refetch: jest.fn() };
    mockPlans.limit = { data: 3, isError: false, refetch: jest.fn() };
    mockPlans.isOnline = true;
    mockPlans.confirm = {
      mutate: jest.fn<undefined, [{ day: { id: string } }, MutationCallbacks]>(),
      isPending: false,
    };
    mockPlans.save = { mutate: jest.fn<undefined, [number, MutationCallbacks]>() };
    mockPlans.openAssistant = jest.fn<undefined, [{ localDate: string; draft?: string }]>();
  });

  describe("plan · week", () => {
    it("should be headed Meal plan with the week and a Plan settings button", async () => {
      const user = await renderRoute(<PlanRoute />);

      expect(screen.getByRole("heading", { name: "Meal plan" })).toBeOnTheScreen();
      expect(screen.getByText("Mon 16 to Sun 22 Nov")).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Plan settings" }));
      expect(routerMock.push).toHaveBeenCalledWith("/plan/settings");
    });

    it("should draw a card for each planned day with its figures against its own target and its status", async () => {
      await renderRoute(<PlanRoute />);

      const monday = screen.getByRole("button", {
        name: /^Monday 16, Confirmed, 1,296 of 1,300 kcal/,
      });
      const wednesday = screen.getByRole("button", {
        name: /^Wednesday 18, Today, Within target, 1,294 of 1,300 kcal · P 93 of 90 g/,
      });
      const thursday = screen.getByRole("button", {
        name: /^Thursday 19, Short, 1,292 of 1,300 kcal · P 68 of 90 g/,
      });

      expect(within(monday).getByText("Confirmed")).toBeOnTheScreen();
      expect(within(wednesday).getByText("Within target")).toBeOnTheScreen();
      expect(within(thursday).getByText("Short")).toBeOnTheScreen();
    });

    it("should name a recipe in full and a food by the part of its name before the comma, a line to a band", async () => {
      await renderRoute(<PlanRoute />);

      const wednesday = screen.getByRole("button", { name: /^Wednesday 18, / });
      expect(within(wednesday).getByText("Eval porridge bowl")).toBeOnTheScreen();
      expect(within(wednesday).getByText("Chicken")).toBeOnTheScreen();
      expect(within(wednesday).getByText("Morning")).toBeOnTheScreen();
      expect(within(wednesday).getByText("Midday")).toBeOnTheScreen();
    });

    it("should mark the strip: a tick for a confirmed day and a warning for a short one, and open a day from its pill", async () => {
      const user = await renderRoute(<PlanRoute />);

      expect(
        screen.getByRole("button", { name: "Monday 16 November, confirmed" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Thursday 19 November, short" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Thursday 19 November, short" }));
      expect(routerMock.push).toHaveBeenCalledWith("/plan/day/2026-11-19");
    });

    it("should leave a day with no plan unavailable on the strip", async () => {
      await renderRoute(<PlanRoute />);

      expect(screen.getByRole("button", { name: "Friday 20 November" })).toBeDisabled();
    });

    it("should open a day from its card", async () => {
      const user = await renderRoute(<PlanRoute />);

      await user.press(screen.getByRole("button", { name: /^Wednesday 18, / }));

      expect(routerMock.push).toHaveBeenCalledWith("/plan/day/2026-11-18");
    });

    it("should show the newest plan's day for a date two plans cover", async () => {
      const newer: MealPlan = {
        ...livePlan(),
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        createdAt: "2026-11-14T10:00:00Z",
        days: [
          planDay("d18-new", "2026-11-18", [
            foodItem("n", "12:30:00", "Eggs, boiled", 100, 1300, 90),
          ]),
        ],
      };
      mockPlans.plans = { data: [livePlan(), newer], isError: false, refetch: jest.fn() };

      await renderRoute(<PlanRoute />);

      const wednesday = screen.getByRole("button", { name: /^Wednesday 18, / });
      expect(within(wednesday).getByText("Eggs")).toBeOnTheScreen();
      expect(within(wednesday).queryByText("Eval porridge bowl")).toBeNull();
    });

    it("should show the week of the day a link names", async () => {
      routerMock.searchParams = { day: "2026-11-25" };
      mockPlans.plans = { data: [livePlan()], isError: false, refetch: jest.fn() };

      await renderRoute(<PlanRoute />);

      expect(screen.getByText(MEAL_PLAN_WORDS.emptyTitle)).toBeOnTheScreen();
    });

    it("should say the starting limit applies while no limit is chosen, with a link to the settings", async () => {
      mockPlans.limit = { data: null, isError: false, refetch: jest.fn() };
      const user = await renderRoute(<PlanRoute />);

      expect(screen.getByText("Recipes repeat up to twice a week")).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Change" }));
      expect(routerMock.push).toHaveBeenCalledWith("/plan/settings");
    });

    it("should draw no variety banner once a limit is chosen", async () => {
      await renderRoute(<PlanRoute />);

      expect(screen.queryByText("Recipes repeat up to twice a week")).toBeNull();
    });

    it("should say the plans could not be loaded, with Try again", async () => {
      mockPlans.plans = { data: undefined, isError: true, refetch: jest.fn() };
      const user = await renderRoute(<PlanRoute />);

      expect(screen.getByText(MEAL_PLAN_WORDS.loadFailedTitle)).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Try again" }));
      expect(mockPlans.plans.refetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("moving between weeks", () => {
    // A plan made on Sunday 22 November runs Sunday to Saturday 28, across two calendar weeks.
    const sundayPlan = (): MealPlan => ({
      ...livePlan(),
      startDate: "2026-11-22",
      days: [
        planDay("d22", "2026-11-22", [foodItem("s", "12:30:00", "Eggs, boiled", 100, 1300, 90)]),
        planDay("d23", "2026-11-23", [foodItem("m", "12:30:00", "Rice, boiled", 100, 1300, 90)]),
        planDay("d28", "2026-11-28", [foodItem("t", "12:30:00", "Oats, plain", 100, 1300, 90)]),
      ],
    });
    const swipe = async (from: number, to: number) => {
      const strip = screen.getByLabelText(/^(This week|Week of)/);
      await fireEvent(strip, "touchStart", { nativeEvent: { pageX: from, pageY: 0 } });
      await fireEvent(strip, "touchEnd", { nativeEvent: { pageX: to, pageY: 0 } });
    };

    it("should reach Monday to Saturday of a Sunday plan by going on to the next week, and back again", async () => {
      mockNow.value = new Date("2026-11-22T12:00:00Z");
      mockPlans.plans = { data: [sundayPlan()], isError: false, refetch: jest.fn() };
      await renderRoute(<PlanRoute />);
      expect(screen.getByText("Mon 16 to Sun 22 Nov")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: /^Monday 23, / })).toBeNull();

      await swipe(200, 10);

      expect(await screen.findByText("Mon 23 to Sun 29 Nov")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Monday 23, / })).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Saturday 28, / })).toBeOnTheScreen();

      await swipe(10, 200);

      expect(await screen.findByText("Mon 16 to Sun 22 Nov")).toBeOnTheScreen();
    });

    it("should open on the first week that has a planned day when this week has none", async () => {
      mockPlans.plans = {
        data: [{ ...sundayPlan(), days: sundayPlan().days.slice(1, 2) }],
        isError: false,
        refetch: jest.fn(),
      };

      await renderRoute(<PlanRoute />);

      expect(screen.getByText("Mon 23 to Sun 29 Nov")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Monday 23, / })).toBeOnTheScreen();
    });
  });

  describe("plan · empty", () => {
    beforeEach(() => {
      mockPlans.plans = { data: [], isError: false, refetch: jest.fn() };
    });

    it("should say there is no plan yet, with the settings still in the header and no line under the title", async () => {
      await renderRoute(<PlanRoute />);

      expect(screen.queryByText("Mon 16 to Sun 22 Nov")).toBeNull();
      expect(screen.getByText("No meal plan yet")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "The assistant can plan a week from your recipes and the foods you usually log, to your targets for each day.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Plan settings" })).toBeOnTheScreen();
    });

    it("should open the assistant with the words for today to Sunday and send nothing", async () => {
      const user = await renderRoute(<PlanRoute />);

      await user.press(screen.getByRole("button", { name: "Plan my week" }));

      expect(mockPlans.openAssistant).toHaveBeenCalledWith({
        localDate: TODAY,
        draft: "Plan my meals for Wed 18 to Sun 22 Nov",
      });
    });
  });
});

// The day route reads its date from the router.
describe("the Plan day screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/PlanDayScreen",
      "components/PlanSettingsScreen",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockPlans.plans = { data: [livePlan()], isError: false, refetch: jest.fn() };
    mockPlans.isOnline = true;
    mockPlans.confirm = {
      mutate: jest.fn<undefined, [{ day: { id: string } }, MutationCallbacks]>(),
      isPending: false,
    };
    mockPlans.openAssistant = jest.fn<undefined, [{ localDate: string; draft?: string }]>();
  });

  const renderDay = (date: string) => {
    routerMock.searchParams = { date };
    return renderRoute(<PlanDayRoute />);
  };

  describe("plan · day", () => {
    it("should head the day with its name and the plan's run, and show its totals and tolerance", async () => {
      await renderDay("2026-11-18");

      expect(screen.getByRole("heading", { name: "Wednesday 18 November" })).toBeOnTheScreen();
      expect(screen.getByText("Meal plan · Mon 16 to Sun 22 Nov")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Planned" })).toBeOnTheScreen();
      expect(screen.getByText("Within target")).toBeOnTheScreen();
      expect(
        screen.getByText("Within 5 % of 1,300 kcal and 5 g of 90 g protein."),
      ).toBeOnTheScreen();
    });

    it("should list each band with its time and figures, and each item with its amount and calories", async () => {
      await renderDay("2026-11-18");

      expect(screen.getByRole("heading", { name: "Morning 07:30" })).toBeOnTheScreen();
      expect(screen.getByText("389 kcal · P 13 g")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Midday 12:30" })).toBeOnTheScreen();
      expect(
        screen.getByText("Chicken, breast, grilled without skin, meat only"),
      ).toBeOnTheScreen();
      expect(screen.getByText("130 g")).toBeOnTheScreen();
      expect(screen.getByText("1 serving · 340 g")).toBeOnTheScreen();
    });

    it("should say how many items Confirm day adds, and write the day through the confirm hook", async () => {
      const user = await renderDay("2026-11-18");

      expect(
        screen.getByText("Confirm day adds these 2 items to your diary at their times."),
      ).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Confirm day" }));

      expect(mockPlans.confirm.mutate).toHaveBeenCalledTimes(1);
      const [variables] = mockPlans.confirm.mutate.mock.calls[0] ?? [];
      expect(variables).toMatchObject({
        day: { id: "d18", confirmedAt: null },
        timeZone: "Europe/London",
      });
    });

    it("should say so when confirming fails", async () => {
      const user = await renderDay("2026-11-18");
      await user.press(screen.getByRole("button", { name: "Confirm day" }));
      const [, callbacks] = mockPlans.confirm.mutate.mock.calls[0] ?? [];

      await act(() => {
        callbacks?.onError?.();
      });

      expect(await screen.findByText(MEAL_PLAN_WORDS.confirmFailed)).toBeOnTheScreen();
    });

    it("should not offer Confirm day while offline", async () => {
      mockPlans.isOnline = false;
      await renderDay("2026-11-18");

      expect(screen.getByRole("button", { name: "Confirm day" })).toBeDisabled();
    });

    it("should open the assistant with the replan words for the day and send nothing", async () => {
      const user = await renderDay("2026-11-19");

      await user.press(screen.getByRole("button", { name: "Regenerate day" }));

      expect(mockPlans.openAssistant).toHaveBeenCalledWith({
        localDate: "2026-11-19",
        draft: "Replan Thu 19 Nov: ",
      });
      expect(mockPlans.confirm.mutate).not.toHaveBeenCalled();
    });
  });

  it("should write a day only once when Confirm day is pressed twice while it is being written", async () => {
    const user = userEvent.setup();
    routerMock.searchParams = { date: "2026-11-18" };
    const tree = () => (
      <ThemeProvider fixedPreference="dark">
        <ToastProvider>
          <PlanDayRoute />
        </ToastProvider>
      </ThemeProvider>
    );
    const { rerender } = await render(tree());
    const button = screen.getByRole("button", { name: "Confirm day" });
    await user.press(button);
    expect(mockPlans.confirm.mutate).toHaveBeenCalledTimes(1);

    mockPlans.confirm = { ...mockPlans.confirm, isPending: true };
    await rerender(tree());
    await user.press(button);

    expect(mockPlans.confirm.mutate).toHaveBeenCalledTimes(1);
  });

  describe("a day with nothing planned", () => {
    beforeEach(() => {
      mockPlans.plans = {
        data: [{ ...livePlan(), days: [planDay("d20", "2026-11-20", [])] }],
        isError: false,
        refetch: jest.fn(),
      };
    });

    it("should have no Short badge and no banner, say so, and keep Confirm day disabled", async () => {
      await renderDay("2026-11-20");

      expect(screen.getByText("Nothing planned")).toBeOnTheScreen();
      expect(screen.queryByText("Short")).toBeNull();
      expect(screen.queryByText(/short on protein/)).toBeNull();
      expect(screen.queryByText(/^Within 5 %/)).toBeNull();
      expect(screen.getByText(MEAL_PLAN_WORDS.emptyDayCaption)).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Confirm day" })).toBeDisabled();
    });
  });

  describe("plan · day-short", () => {
    it("should say how far short and the closest the plan gets, and still let the day be confirmed", async () => {
      await renderDay("2026-11-19");

      expect(screen.getByText("Short")).toBeOnTheScreen();
      expect(screen.getByText("22 g short on protein")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "The closest the plan gets is 68 g of 90 g, with calories within 5 %. Confirm it as it is, or regenerate the day with other words.",
        ),
      ).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Confirm day" })).toBeEnabled();
    });
  });

  describe("plan · day-confirmed", () => {
    it("should say the day is logged, link to the diary and draw no buttons", async () => {
      const user = await renderDay("2026-11-16");

      expect(screen.getByRole("heading", { name: "Logged from the plan" })).toBeOnTheScreen();
      expect(screen.getByText("1 entry is in your diary. Change it there.")).toBeOnTheScreen();
      expect(
        screen.getByText("Confirmed days stay as they are. Edit the entries in your diary."),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Confirm day" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Regenerate day" })).toBeNull();
      await user.press(screen.getByRole("button", { name: "Open in diary" }));
      expect(routerMock.push).toHaveBeenCalledWith("/diary?day=2026-11-16");
    });

    it("should tick each item as in your diary, and never confirm it again", async () => {
      await renderDay("2026-11-16");

      expect(screen.getByLabelText("In your diary")).toBeOnTheScreen();
      expect(mockPlans.confirm.mutate).not.toHaveBeenCalled();
    });
  });

  it("should say a day outside the plan is not in it", async () => {
    await renderDay("2026-12-30");

    expect(screen.getByText(MEAL_PLAN_WORDS.dayNotFoundTitle)).toBeOnTheScreen();
  });
});

describe("plan · settings", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/PlanSettingsScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockPlans.limit = { data: 3, isError: false, refetch: jest.fn() };
    mockPlans.save = { mutate: jest.fn<undefined, [number, MutationCallbacks]>() };
  });

  it("should ask the question and offer the eight answers", async () => {
    await renderRoute(<PlanSettingsRoute />);

    expect(
      screen.getByRole("heading", { name: "How often can a recipe repeat?" }),
    ).toBeOnTheScreen();
    expect(screen.getByText(PLAN_SETTINGS_WORDS.hint)).toBeOnTheScreen();
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("radio", { name: /^3 times a week/ })).toBeChecked();
    expect(screen.getByText(PLAN_SETTINGS_WORDS.caption)).toBeOnTheScreen();
  });

  it.each([
    ["Once a week", 1],
    ["Twice a week", 2],
    ["4 times a week", 4],
    ["7 times a week", 7],
    ["No limit", 0],
  ])("should save %s as %i at once", async (title, value) => {
    const user = await renderRoute(<PlanSettingsRoute />);

    await user.press(screen.getByRole("radio", { name: new RegExp(`^${title}`) }));

    expect(mockPlans.save.mutate).toHaveBeenCalledTimes(1);
    expect(mockPlans.save.mutate.mock.calls[0]?.[0]).toBe(value);
  });

  it("should say the limit was saved", async () => {
    const user = await renderRoute(<PlanSettingsRoute />);
    await user.press(screen.getByRole("radio", { name: /^Twice a week/ }));
    const [, callbacks] = mockPlans.save.mutate.mock.calls[0] ?? [];

    await act(() => {
      callbacks?.onSuccess?.();
    });

    expect(await screen.findByText("Repeat limit saved")).toBeOnTheScreen();
  });

  it("should mark twice a week as the starting limit while nothing is chosen", async () => {
    mockPlans.limit = { data: null, isError: false, refetch: jest.fn() };
    await renderRoute(<PlanSettingsRoute />);

    const twice = screen.getByRole("radio", { name: /^Twice a week/ });
    expect(twice).toBeChecked();
    expect(within(twice).getByText("Starting limit")).toBeOnTheScreen();
  });

  it("should say Zee's words under No limit, and mark it when chosen", async () => {
    mockPlans.limit = { data: 0, isError: false, refetch: jest.fn() };
    await renderRoute(<PlanSettingsRoute />);

    const noLimit = screen.getByRole("radio", { name: /^No limit/ });
    expect(noLimit).toBeChecked();
    expect(
      within(noLimit).getByText("You don't mind eating the same thing again and again."),
    ).toBeOnTheScreen();
  });
});
