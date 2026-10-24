import { KeyLowProvider, keys } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { ExpoRoot, Slot, useLocalSearchParams } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import TabsLayout from "../app/(tabs)/_layout";
import DashboardRoute from "../app/(tabs)/dashboard";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import {
  createDiaryQueryClient,
  diaryBackend,
  diaryClient,
  foodEntry,
  noTargets,
  recipeEntry,
  requestsTo,
  resetDiaryBackend,
  showLiveTargets,
  sampleDay,
} from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";

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
// 11:20 in London on Thursday 15 October 2026. A test moves the clock with `moveClockTo`.
let mockNow = new Date("2026-10-15T10:20:00Z");
const mockClockListeners = new Set<() => void>();
jest.mock("../lib/useNow", () => {
  const { useSyncExternalStore } = jest.requireActual<typeof import("react")>("react");

  return {
    useNow: () =>
      useSyncExternalStore(
        (listener: () => void) => {
          mockClockListeners.add(listener);

          return () => {
            mockClockListeners.delete(listener);
          };
        },
        () => mockNow,
      ),
  };
});

async function moveClockTo(instant: string) {
  await act(() => {
    mockNow = new Date(instant);
    for (const listener of mockClockListeners) {
      listener();
    }
  });
}

setUpTests();

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

// The diary has its own tests. Here it shows the day it was opened on, because these tests are about the card.
function DiaryStandIn() {
  const { day } = useLocalSearchParams<{ day?: string }>();

  return <Text role="heading">{`Diary day=${day ?? "none"}`}</Text>;
}

const standIn = (text: string) =>
  function StandIn() {
    return <Text role="heading">{text}</Text>;
  };

const routes = {
  _layout: Providers,
  "(tabs)/_layout": TabsLayout,
  "(tabs)/dashboard": DashboardRoute,
  "(tabs)/diary": DiaryStandIn,
  "(tabs)/recipes": standIn("Recipes screen"),
  "(tabs)/train": standIn("Train screen"),
  "(tabs)/more": standIn("More screen"),
  targets: standIn("Targets screen"),
  "foods/index": standIn("Search sheet"),
  "foods/scan": standIn("Scan screen"),
};

async function renderDashboard() {
  queryClient = createDiaryQueryClient();
  await render(<ExpoRoot context={getMockContext(routes)} location="/dashboard" />);
}

const card = () => screen.findByRole("button", { name: /^Today, open the diary\. / });

// The ring and the bars sit inside the card's one button, which a screen reader reads by its own name. So
// they are hidden from it, and the tests ask for hidden elements to read what they say.
const hidden = { includeHiddenElements: true };

// 1,039 kcal eaten and a lasagne on top of it: 2,412 kcal, 212 over the 2,200 target.
function addLasagne() {
  diaryBackend.entries.push(
    foodEntry({
      date: "2026-10-15",
      utcTime: "12:00",
      name: "Lasagne",
      quantity: 400,
      unit: "g",
      kcal: 1373,
      protein: 64,
      fat: 62,
      carbs: 128,
    }),
  );
}

const underTargetName =
  "Today, open the diary. 1,161 calories remaining of 2,200. Protein: 86 of 160 grams. Carbs: 129 of 220 grams. Fat: 19 of 70 grams";

describe("the dashboard screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen", "app"]);
  });

  beforeEach(() => {
    mockNow = new Date("2026-10-15T10:20:00Z");
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("today", () => {
    it("should show today's date over the title Dashboard", async () => {
      await renderDashboard();
      await card();

      expect(screen.getByText("Thursday 15 October")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeOnTheScreen();
    });

    it("should name the card by the ring and the three macros, as one button to the diary", async () => {
      await renderDashboard();

      expect(await card()).toHaveAccessibleName(underTargetName);
    });

    it("should count a recipe entry in the day: 1,039 kcal and the golden serving's 374.2 leave 787", async () => {
      diaryBackend.entries.push(recipeEntry({ date: "2026-10-15", utcTime: "17:00" }));
      await renderDashboard();

      expect(await card()).toHaveAccessibleName(
        "Today, open the diary. 787 calories remaining of 2,200. Protein: 118 of 160 grams. Carbs: 168 of 220 grams. Fat: 27 of 70 grams",
      );
    });

    it("should draw the ring and the three macro bars from the day's foods against the targets", async () => {
      await renderDashboard();
      await card();

      expect(
        screen.getByRole("img", { name: "1,161 calories remaining of 2,200", ...hidden }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("group", { name: "Protein: 86 of 160 grams", ...hidden }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("group", { name: "Carbs: 129 of 220 grams", ...hidden }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("group", { name: "Fat: 19 of 70 grams", ...hidden }),
      ).toBeOnTheScreen();
    });

    it("should title the card Today, with no estimate on the target line", async () => {
      await renderDashboard();
      await card();

      expect(screen.getByText("Today", hidden)).toBeOnTheScreen();
      expect(screen.getByText("2,200 target", hidden)).toBeOnTheScreen();
      expect(screen.queryByText(/\(est\.\)/, hidden)).not.toBeOnTheScreen();
    });

    it("should show the target and an Edit link under the card's hairline", async () => {
      await renderDashboard();
      await card();

      expect(screen.getByText("Target 2,200 kcal")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Edit targets" })).toBeOnTheScreen();
    });

    it("should draw Edit in the accent ink", async () => {
      await renderDashboard();
      await card();

      expect(screen.getByText("Edit")).toHaveStyle({ color: resolvedColor("dark", "accent-ink") });
    });

    it("should show no banner", async () => {
      await renderDashboard();
      await card();

      expect(screen.queryByText("No target set")).not.toBeOnTheScreen();
      expect(screen.queryByText("You're offline")).not.toBeOnTheScreen();
    });

    it("should keep the Edit link outside the card's button, so there are no nested buttons", async () => {
      await renderDashboard();
      const cardButton = await card();

      expect(within(cardButton).queryByRole("button", { name: "Edit targets" })).toBeNull();
    });

    it("should read today in the profile's zone, so the card rolls over at its midnight", async () => {
      diaryBackend.timezone = "Pacific/Kiritimati";
      await renderDashboard();
      await screen.findByText("Friday 16 October");

      expect(screen.queryByText("Thursday 15 October")).not.toBeOnTheScreen();
    });
  });

  describe("with a program's day by day targets", () => {
    beforeEach(() => {
      showLiveTargets();
    });

    it("should read today's figure from the program, a Thursday at 2,000, and not the week's 2,140", async () => {
      await renderDashboard();

      expect(await card()).toHaveAccessibleName(
        "Today, open the diary. 961 calories remaining of 2,000. Protein: 86 of 126 grams. Carbs: 129 of 245 grams. Fat: 19 of 73 grams",
      );
      expect(screen.getByText("Target 2,000 kcal")).toBeOnTheScreen();
    });
  });

  describe("nothing logged", () => {
    it("should read the whole target as remaining, with empty bars and the footer", async () => {
      diaryBackend.entries = [];
      await renderDashboard();

      expect(await card()).toHaveAccessibleName(
        "Today, open the diary. 2,200 calories remaining of 2,200. Protein: 0 of 160 grams. Carbs: 0 of 220 grams. Fat: 0 of 70 grams",
      );
      expect(screen.getByText("Target 2,200 kcal")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Edit targets" })).toBeOnTheScreen();
    });
  });

  describe("over target", () => {
    beforeEach(() => {
      addLasagne();
    });

    it("should read how far over the ring and each bar are", async () => {
      await renderDashboard();

      expect(await card()).toHaveAccessibleName(
        "Today, open the diary. 212 calories over target of 2,200. Protein: 150 of 160 grams. Carbs: 257 of 220 grams, 37 over. Fat: 81 of 70 grams, 11 over",
      );
      expect(
        screen.getByRole("img", { name: "212 calories over target of 2,200", ...hidden }),
      ).toBeOnTheScreen();
    });

    it("should print the amount over under the numeral, and the deltas on the bars that are over", async () => {
      await renderDashboard();
      await card();

      expect(screen.getByText("over target", hidden)).toBeOnTheScreen();
      expect(screen.getByText("+37 g", hidden)).toBeOnTheScreen();
      expect(screen.getByText("+11 g", hidden)).toBeOnTheScreen();
    });

    it("should outline the bars that are over, and no other", async () => {
      await renderDashboard();
      await card();

      expect(screen.getByTestId("carbs-outline", hidden)).toBeOnTheScreen();
      expect(screen.getByTestId("fat-outline", hidden)).toBeOnTheScreen();
      expect(screen.queryByTestId("protein-outline", hidden)).not.toBeOnTheScreen();
    });
  });

  describe("with no target", () => {
    beforeEach(() => {
      diaryBackend.targets = noTargets;
    });

    it("should show the info banner above the card, and Set target should open Targets", async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await card();

      expect(screen.getByText("No target set")).toBeOnTheScreen();
      expect(
        screen.getByText("Set a calorie and macro target to see what is left."),
      ).toBeOnTheScreen();

      await user.press(screen.getByRole("button", { name: "Set target" }));

      expect(await screen.findByRole("heading", { name: "Targets screen" })).toBeOnTheScreen();
    });

    it("should read the calories eaten and the grams only", async () => {
      await renderDashboard();

      expect(await card()).toHaveAccessibleName(
        "Today, open the diary. 1,039 calories eaten, no target set. Protein: 86 grams. Carbs: 129 grams. Fat: 19 grams",
      );
      expect(
        screen.getByRole("img", { name: "1,039 calories eaten, no target set", ...hidden }),
      ).toBeOnTheScreen();
      expect(screen.getByText("eaten", hidden)).toBeOnTheScreen();
    });

    it("should leave the footer off", async () => {
      await renderDashboard();
      await card();

      expect(screen.queryByText(/^Target /)).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Edit targets" })).not.toBeOnTheScreen();
    });
  });

  describe("pressing", () => {
    it("should open the Diary for today from the card", async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.press(await card());

      expect(
        await screen.findByRole("heading", { name: "Diary day=2026-10-15" }),
      ).toBeOnTheScreen();
    });

    it("should open the Diary for today in the profile's zone", async () => {
      const user = userEvent.setup();
      diaryBackend.timezone = "Pacific/Kiritimati";
      await renderDashboard();

      await user.press(await card());

      expect(
        await screen.findByRole("heading", { name: "Diary day=2026-10-16" }),
      ).toBeOnTheScreen();
    });

    it("should open Targets from Edit, not the Diary", async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await card();

      await user.press(screen.getByRole("button", { name: "Edit targets" }));

      expect(await screen.findByRole("heading", { name: "Targets screen" })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: /^Diary/ })).not.toBeOnTheScreen();
    });
  });

  describe("loading", () => {
    beforeEach(() => {
      diaryBackend.hungTables.add("food_log_entries");
    });

    it("should keep the header and show the card skeleton, named as loading, and no card", async () => {
      await renderDashboard();

      // The date arrives with the profile's zone, and the day then goes on loading.
      expect(await screen.findByText("Thursday 15 October")).toBeOnTheScreen();
      expect(screen.getByRole("status", { name: "Loading today's nutrition" })).toBeOnTheScreen();
      expect(screen.getByTestId("skeleton-nutrition-card", hidden)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^Today, open the diary/ }),
      ).not.toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Edit targets" })).not.toBeOnTheScreen();
    });

    // The 200 ms delay and the fade belong to the kit's Skeleton, which tests them with its clock. Here the card's
    // skeleton is the one that is drawn, and it starts clear.
    it("should start the card skeleton clear, so a quick load never flickers", async () => {
      await renderDashboard();
      await screen.findByText("Thursday 15 October");

      // The This week card may be a skeleton beside it, depending on how soon its reads answer, so the
      // Today card's is found inside its own status, and every skeleton drawn must start clear.
      const todays = screen.getByRole("status", { name: "Loading today's nutrition" });
      expect(within(todays).getByTestId("skeleton", hidden)).toHaveStyle({ opacity: 0 });
      for (const skeleton of screen.getAllByTestId("skeleton", hidden)) {
        expect(skeleton).toHaveStyle({ opacity: 0 });
      }
    });
  });

  describe("a failed load", () => {
    it("should show the error state in place of the card, with the header kept", async () => {
      diaryBackend.failingTables.add("food_log_entries");
      await renderDashboard();

      expect(await screen.findByText("Couldn't load today's nutrition")).toBeOnTheScreen();
      expect(screen.getByText("Check your connection and try again.")).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Try again" })).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeOnTheScreen();
      expect(screen.getByText("Thursday 15 October")).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^Today, open the diary/ }),
      ).not.toBeOnTheScreen();
    });

    it("should not put the database's own words on the screen", async () => {
      diaryBackend.failingTables.add("food_log_entries");
      await renderDashboard();

      await screen.findByText("Couldn't load today's nutrition");

      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should show the card after Try again succeeds", async () => {
      const user = userEvent.setup();
      diaryBackend.failingTables.add("food_log_entries");
      await renderDashboard();
      await screen.findByText("Couldn't load today's nutrition");

      diaryBackend.failingTables.clear();
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await card()).toHaveAccessibleName(underTargetName);
    });

    it("should read again only what failed: the targets, and not the day", async () => {
      const user = userEvent.setup();
      diaryBackend.targetsReadFails = true;
      await renderDashboard();
      await screen.findByText("Couldn't load today's nutrition");
      const dayReads = requestsTo("food_log_entries");

      diaryBackend.targetsReadFails = false;
      // The targets are the This week card's too, so it shows its own Try again under the Today card's.
      const [todaysRetry] = screen.getAllByRole("button", { name: "Try again" });
      if (todaysRetry === undefined) {
        throw new Error("The Today card has no Try again");
      }
      await user.press(todaysRetry);
      await card();

      expect(requestsTo("food_log_entries")).toBe(dayReads);
    });

    it("should read again the day when only the day failed", async () => {
      const user = userEvent.setup();
      diaryBackend.failingTables.add("food_log_entries");
      await renderDashboard();
      await screen.findByText("Couldn't load today's nutrition");
      const dayReads = requestsTo("food_log_entries");

      diaryBackend.failingTables.clear();
      await user.press(screen.getByRole("button", { name: "Try again" }));
      await card();

      expect(requestsTo("food_log_entries")).toBeGreaterThan(dayReads);
    });

    it("should show the error state, with the title kept, when the time zone cannot be read, and read it again", async () => {
      const user = userEvent.setup();
      diaryBackend.timeZoneReadFails = true;
      await renderDashboard();

      expect(await screen.findByText("Couldn't load today's nutrition")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: "Dashboard" })).toBeOnTheScreen();

      diaryBackend.timeZoneReadFails = false;
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await card()).toHaveAccessibleName(underTargetName);
    });
  });

  describe("a refetch that fails once the card is on screen", () => {
    // react-query tells the screen about the failed answer on the next turn of the event loop.
    async function refetchEverything() {
      await act(async () => {
        await queryClient.invalidateQueries();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
    }

    it("should keep the card when the day fails to refetch", async () => {
      await renderDashboard();
      await card();

      diaryBackend.failingTables.add("food_log_entries");
      await refetchEverything();

      expect(screen.queryByText("Couldn't load today's nutrition")).not.toBeOnTheScreen();
      expect(await card()).toHaveAccessibleName(underTargetName);
    });

    it("should keep the card when the targets fail to refetch", async () => {
      await renderDashboard();
      await card();

      diaryBackend.targetsReadFails = true;
      await refetchEverything();

      expect(screen.queryByText("Couldn't load today's nutrition")).not.toBeOnTheScreen();
      expect(await card()).toHaveAccessibleName(underTargetName);
    });

    it("should keep the card when the time zone fails to refetch", async () => {
      await renderDashboard();
      await card();

      diaryBackend.timeZoneReadFails = true;
      await refetchEverything();

      expect(screen.queryByText("Couldn't load today's nutrition")).not.toBeOnTheScreen();
      expect(await card()).toHaveAccessibleName(underTargetName);
    });
  });

  describe("at midnight", () => {
    it("should roll the date over and keep the card on screen while the new day loads", async () => {
      await renderDashboard();
      await card();

      // 00:30 in London on Friday 16 October. The new day never answers.
      diaryBackend.hungTables.add("food_log_entries");
      await moveClockTo("2026-10-15T23:30:00Z");

      expect(await screen.findByText("Friday 16 October")).toBeOnTheScreen();
      expect(
        screen.queryByRole("status", { name: "Loading today's nutrition" }),
      ).not.toBeOnTheScreen();
      expect(screen.getByRole("button", { name: /^Today, open the diary\. / })).toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    it("should show the offline banner and keep the cached card readable", async () => {
      await renderDashboard();
      await card();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText("You're offline")).toBeOnTheScreen();
      expect(
        screen.getByText("Showing your last saved diary. Changes need a connection."),
      ).toBeOnTheScreen();
      expect(await card()).toHaveAccessibleName(underTargetName);
      expect(screen.getByRole("button", { name: "Edit targets" })).toBeEnabled();
    });

    // The dock and the plus dim themselves offline from the tab bar, whichever tab is open. This holds it on this one.
    it("should dim the search dock to half strength on this tab, and disable it and the centre plus", async () => {
      await renderDashboard();
      await card();

      await act(() => {
        onlineManager.setOnline(false);
      });

      const dock = screen.getByRole("button", { name: "Search for a food" });
      expect(dock).toBeDisabled();
      // The bar's box is three views up from its button: the press wrapper, the flexible slot, then the box.
      expect(dock.parent?.parent?.parent).toHaveStyle({ opacity: 0.5 });
      expect(screen.getByRole("button", { name: "Find food" })).toBeDisabled();
    });

    it("should open nothing from the disabled dock", async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await card();
      await act(() => {
        onlineManager.setOnline(false);
      });

      await user.press(screen.getByRole("button", { name: "Search for a food" }));

      expect(screen.queryByRole("heading", { name: "Search sheet" })).not.toBeOnTheScreen();
    });

    it("should show the banner over the skeleton when nothing is cached", async () => {
      onlineManager.setOnline(false);
      await renderDashboard();

      expect(await screen.findByText("You're offline")).toBeOnTheScreen();
      expect(
        await screen.findByRole("status", { name: "Loading today's nutrition" }),
      ).toBeOnTheScreen();
      expect(screen.getByTestId("skeleton-nutrition-card", hidden)).toBeOnTheScreen();
    });
  });

  describe("the terms gate", () => {
    it("should make no time zone, diary or targets request while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderDashboard();
      await screen.findByRole("status", { name: "Loading today's nutrition" });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // The gate's own read of the acceptance is the only request.
      expect(diaryBackend.requests.length).toBeGreaterThan(0);
      expect(
        diaryBackend.requests.filter((request) => !request.search.includes("terms_accepted_at")),
      ).toEqual([]);
      expect(requestsTo("food_log_entries")).toBe(0);
    });

    it("should stop reading, with the card already on screen, once the terms need accepting again", async () => {
      await renderDashboard();
      await card();
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await act(async () => {
        await queryClient.invalidateQueries({ queryKey: keys.profiles.termsAcceptance });
        // The new answer reaches the screen on the next turn of the event loop.
        await new Promise((resolve) => setTimeout(resolve, 20));
      });
      const readsBefore = diaryBackend.requests.length;

      await act(async () => {
        await queryClient.invalidateQueries();
      });

      // Only the gate's own read of the acceptance is made again.
      expect(
        diaryBackend.requests
          .slice(readsBefore)
          .filter((request) => !request.search.includes("terms_accepted_at")),
      ).toEqual([]);
    });

    it("should make no request while the acceptance is still loading, because that counts as not accepted", async () => {
      diaryBackend.hungTables.add("profiles");
      await renderDashboard();
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(requestsTo("food_log_entries")).toBe(0);
      expect(requestsTo("profiles")).toBe(1);
    });
  });
});
