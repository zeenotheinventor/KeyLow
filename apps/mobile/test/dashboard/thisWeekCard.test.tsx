import { KeyLowProvider } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, within } from "@testing-library/react-native";
import { ExpoRoot, Slot, useLocalSearchParams } from "expo-router";
import { getMockContext } from "expo-router/testing-library";
import { Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import TabsLayout from "../../app/(tabs)/_layout";
import DashboardRoute from "../../app/(tabs)/dashboard";
import { ToastProvider } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import {
  createDiaryQueryClient,
  dayTotalsRow,
  diaryBackend,
  diaryClient,
  noTargets,
  requestsTo,
  resetDiaryBackend,
  sampleDay,
} from "../support/diaryBackend";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { expectTextsInOrder } from "../support/textsInOrder";
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
// 11:20 in London on Thursday 15 October 2026. A test moves the clock with `moveClockTo`.
let mockNow = new Date("2026-10-15T10:20:00Z");
const mockClockListeners = new Set<() => void>();
jest.mock("../../lib/useNow", () => {
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

// The words inside the card sit under its one button, which a screen reader reads by its own name. So
// they are hidden from it, and the tests ask for hidden elements to read what they say.
const hidden = { includeHiddenElements: true };

const sampleName =
  "This week, open the diary. Average 1,681 of 2,200 kilocalories a day, from 4 days with food logged. 2 of 4 days complete.";

// The week is read as a range of days, where a day is read by its date alone.
const weekReads = () =>
  diaryBackend.requests.filter(
    (request) => request.table === "day_totals" && request.search.includes("local_date=gte."),
  ).length;

const weekCard = () => screen.findByRole("button", { name: /^This week, open the diary\./ });
const todayCard = () => screen.findByRole("button", { name: /^Today, open the diary\. / });
const marker = (name: string) => screen.getByRole("img", { name, ...hidden });

describe("the This week card", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/DashboardScreen", "app"]);
  });

  beforeEach(() => {
    mockNow = new Date("2026-10-15T10:20:00Z");
    registerAppStyles(kitStyles);
    resetDiaryBackend();
    diaryBackend.entries = sampleDay();
    showSampleWeek();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the sample week", () => {
    it("should be one button to the diary, named by the average and the days complete", async () => {
      await renderDashboard();

      expect(await weekCard()).toHaveAccessibleName(sampleName);
    });

    it("should open the Diary on today when it is pressed", async () => {
      const user = userEvent.setup();
      await renderDashboard();

      await user.press(await weekCard());

      expect(
        await screen.findByRole("heading", { name: "Diary day=2026-10-15" }),
      ).toBeOnTheScreen();
    });

    it("should read the week that holds today, from its Monday to its Sunday", async () => {
      await renderDashboard();
      await weekCard();

      const reads = diaryBackend.requests.filter(
        (request) => request.table === "day_totals" && request.search.includes("local_date=gte."),
      );
      expect(reads.length).toBeGreaterThan(0);
      for (const read of reads) {
        expect(read.search).toContain("local_date=gte.2026-10-12");
        expect(read.search).toContain("local_date=lte.2026-10-18");
      }
    });

    it("should hold its words inside the button, hidden from a screen reader so they are not read twice", async () => {
      await renderDashboard();
      const card = await weekCard();

      expect(screen.queryByText("Week of Mon 12 Oct")).not.toBeOnTheScreen();
      const inside = within(card);
      expect(inside.getByText("This week", hidden)).toBeOnTheScreen();
      expect(inside.getByText("Week of Mon 12 Oct", hidden)).toBeOnTheScreen();
      expect(inside.getByText("From 4 days with food logged", hidden)).toBeOnTheScreen();
      expect(inside.getByText("2 of 4 days complete", hidden)).toBeOnTheScreen();
    });

    it("should print the average over the target, and what it is taken over", async () => {
      await renderDashboard();
      const inside = within(await weekCard());

      expect(inside.getByText(/^Average/, hidden)).toHaveTextContent("Average · Mon to today");
      expect(inside.getByText("1,681", hidden)).toBeOnTheScreen();
      expect(inside.getByText("/ 2,200 kcal", hidden)).toBeOnTheScreen();
      expect(inside.queryByText(/^\+/, hidden)).not.toBeOnTheScreen();
    });

    it("should draw the bar with no outline", async () => {
      await renderDashboard();
      await weekCard();

      expect(screen.getByTestId("calories-fill", hidden)).toBeOnTheScreen();
      expect(screen.queryByTestId("calories-outline", hidden)).not.toBeOnTheScreen();
    });

    it("should name the seven markers, Monday to Sunday, by their day and state", async () => {
      await renderDashboard();
      await weekCard();

      expect(marker("Monday 12 October, complete")).toBeOnTheScreen();
      expect(marker("Tuesday 13 October, complete")).toBeOnTheScreen();
      expect(marker("Wednesday 14 October")).toBeOnTheScreen();
      expect(marker("Thursday 15 October, today")).toBeOnTheScreen();
      expect(marker("Friday 16 October")).toBeOnTheScreen();
      expect(marker("Saturday 17 October")).toBeOnTheScreen();
      expect(marker("Sunday 18 October")).toBeOnTheScreen();
      expectTextsInOrder(screen.getAllByText(/^(Mo|Tu|We|Th|Fr|Sa|Su)$/, hidden), [
        "Mo",
        "Tu",
        "We",
        "Th",
        "Fr",
        "Sa",
        "Su",
      ]);
    });

    it("should tick the complete days, and only those", async () => {
      await renderDashboard();
      await weekCard();

      expect(
        within(marker("Monday 12 October, complete")).getByTestId("marker-tick", hidden),
      ).toBeOnTheScreen();
      expect(screen.getAllByTestId("marker-tick", hidden)).toHaveLength(2);
    });

    it("should leave the Today card as it was", async () => {
      await renderDashboard();
      await weekCard();

      expect(await todayCard()).toBeOnTheScreen();
      expect(screen.getByRole("button", { name: "Edit targets" })).toBeOnTheScreen();
    });

    it("should count a day marked complete that is still to come as no day at all", async () => {
      showWeek([2140, 2260, 1286, 1039], ["2026-10-12", "2026-10-13", "2026-10-16"]);
      await renderDashboard();

      expect(await weekCard()).toHaveAccessibleName(sampleName);
      expect(marker("Friday 16 October")).toBeOnTheScreen();
    });

    it("should say 1 of 1 day complete on a Monday, and from 1 day with food logged", async () => {
      mockNow = new Date("2026-10-12T08:00:00Z");
      showWeek([1500], ["2026-10-12"]);
      await renderDashboard();

      expect(await weekCard()).toHaveAccessibleName(
        "This week, open the diary. Average 1,500 of 2,200 kilocalories a day, from 1 day with food logged. 1 of 1 day complete.",
      );
      expect(screen.getByText("From 1 day with food logged", hidden)).toBeOnTheScreen();
    });
  });

  describe("nothing logged", () => {
    beforeEach(() => {
      showEmptyWeek();
    });

    it("should say so in place of the average, the bar and the basis", async () => {
      await renderDashboard();
      const inside = within(await weekCard());

      expect(inside.getByText("Nothing logged this week yet.", hidden)).toBeOnTheScreen();
      expect(inside.queryByText(/^Average/, hidden)).not.toBeOnTheScreen();
      expect(inside.queryByTestId("calories-fill", hidden)).not.toBeOnTheScreen();
      expect(inside.queryByText(/with food logged/, hidden)).not.toBeOnTheScreen();
    });

    it("should still count the days so far, none of them complete", async () => {
      await renderDashboard();

      expect(await weekCard()).toHaveAccessibleName(
        "This week, open the diary. Nothing logged this week yet. 0 of 4 days complete.",
      );
      expect(screen.getByText("0 of 4 days complete", hidden)).toBeOnTheScreen();
    });
  });

  describe("no target", () => {
    beforeEach(() => {
      diaryBackend.targets = noTargets;
    });

    it("should read the average as 1,681 kcal, with no bar", async () => {
      await renderDashboard();
      const inside = within(await weekCard());

      expect(inside.getByText("1,681", hidden)).toBeOnTheScreen();
      expect(inside.getByText("kcal", hidden)).toBeOnTheScreen();
      expect(inside.queryByText(/\//, hidden)).not.toBeOnTheScreen();
      expect(inside.queryByTestId("calories-fill", hidden)).not.toBeOnTheScreen();
    });

    it("should name the card without a target", async () => {
      await renderDashboard();

      expect(await weekCard()).toHaveAccessibleName(
        "This week, open the diary. Average 1,681 kilocalories a day, from 4 days with food logged. 2 of 4 days complete.",
      );
    });

    it("should show the one No target set banner, above both cards", async () => {
      await renderDashboard();
      await weekCard();

      expectTextsInOrder(screen.getAllByText(/^(No target set|Today|This week)$/, hidden), [
        "No target set",
        "Today",
        "This week",
      ]);
    });
  });

  describe("over target", () => {
    beforeEach(() => {
      showOverTargetWeek();
    });

    it("should read 2,450 over 2,200 kcal with +250 kcal after it", async () => {
      await renderDashboard();
      const card = await weekCard();
      const inside = within(card);

      expect(inside.getByText("2,450", hidden)).toBeOnTheScreen();
      expect(inside.getByText("/ 2,200 kcal", hidden)).toBeOnTheScreen();
      expect(inside.getByText("+250 kcal", hidden)).toBeOnTheScreen();
      expect(card).toHaveAccessibleName(/Average 2,450 of 2,200 kilocalories/);
    });

    it("should outline the bar in its own colour, and use no warning colour", async () => {
      await renderDashboard();
      await weekCard();

      expect(screen.getByTestId("calories-outline", hidden)).toBeOnTheScreen();
      expect(screen.getByTestId("calories-outline-colour", hidden)).toBeOnTheScreen();
      expect(screen.getByTestId("calories-outline-gap", hidden)).toBeOnTheScreen();
    });
  });

  describe("loading", () => {
    beforeEach(() => {
      diaryBackend.weekReadsHang = true;
    });

    it("should show a skeleton named Loading this week while the week loads, and no button", async () => {
      await renderDashboard();

      expect(await screen.findByRole("status", { name: "Loading this week" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^This week, open the diary/ }),
      ).not.toBeOnTheScreen();
    });

    it("should load on its own, so the Today card is already there", async () => {
      await renderDashboard();

      expect(await todayCard()).toBeOnTheScreen();
      expect(screen.getByRole("status", { name: "Loading this week" })).toBeOnTheScreen();
    });

    it("should be a skeleton under the Today skeleton while the time zone is unknown", async () => {
      diaryBackend.hungTables.add("profiles");
      await renderDashboard();

      expect(
        await screen.findByRole("status", { name: "Loading today's nutrition" }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("status", { name: "Loading this week" })).toBeOnTheScreen();
    });
  });

  describe("a failed load", () => {
    beforeEach(() => {
      diaryBackend.weekReadsFail = true;
    });

    it("should say Couldn't load this week inside the card, under its title and caption", async () => {
      await renderDashboard();

      const alert = await screen.findByRole("alert", { name: /Couldn't load this week/ });
      expect(within(alert).getByText("Couldn't load this week")).toBeOnTheScreen();
      expect(within(alert).getByText("Check your connection and try again.")).toBeOnTheScreen();
      expect(screen.getByText("Week of Mon 12 Oct")).toBeOnTheScreen();
      expect(screen.getByText("This week")).toBeOnTheScreen();
    });

    it("should not put the database's own words on the screen", async () => {
      await renderDashboard();
      await screen.findByText("Couldn't load this week");

      expect(screen.queryByText(/raw database text/)).not.toBeOnTheScreen();
    });

    it("should not be pressable while it shows the error", async () => {
      await renderDashboard();
      await screen.findByText("Couldn't load this week");

      expect(
        screen.queryByRole("button", { name: /^This week, open the diary/ }),
      ).not.toBeOnTheScreen();
    });

    it("should leave the Today card as it was", async () => {
      await renderDashboard();
      await screen.findByText("Couldn't load this week");

      expect(await todayCard()).toBeOnTheScreen();
      expect(screen.queryByText("Couldn't load today's nutrition")).not.toBeOnTheScreen();
    });

    it("should read the week again, and not the targets, when Try again is pressed", async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await screen.findByText("Couldn't load this week");
      await todayCard();
      const weekReadsBefore = weekReads();
      const profileReads = requestsTo("profiles");

      diaryBackend.weekReadsFail = false;
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await weekCard()).toHaveAccessibleName(sampleName);
      expect(weekReads()).toBeGreaterThan(weekReadsBefore);
      expect(requestsTo("profiles")).toBe(profileReads);
    });

    it("should read the targets again, and not the week, when they were what failed", async () => {
      const user = userEvent.setup();
      diaryBackend.weekReadsFail = false;
      diaryBackend.targetsReadFails = true;
      await renderDashboard();
      await screen.findByText("Couldn't load this week");
      await screen.findByText("Couldn't load today's nutrition");
      const weekReadsBefore = weekReads();

      diaryBackend.targetsReadFails = false;
      // The Today card's Try again is above the week card's, which is the last one.
      const retries = screen.getAllByRole("button", { name: "Try again" });
      expect(retries).toHaveLength(2);
      const weekRetry = retries.at(-1);
      if (weekRetry === undefined) {
        throw new Error("The week card has no Try again");
      }
      await user.press(weekRetry);

      expect(await weekCard()).toHaveAccessibleName(sampleName);
      expect(weekReads()).toBe(weekReadsBefore);
    });

    it("should keep the card when a refetch fails while the week is on screen", async () => {
      diaryBackend.weekReadsFail = false;
      await renderDashboard();
      await weekCard();

      diaryBackend.weekReadsFail = true;
      await act(async () => {
        await queryClient.invalidateQueries();
        await new Promise((resolve) => setTimeout(resolve, 20));
      });

      expect(screen.queryByText("Couldn't load this week")).not.toBeOnTheScreen();
      expect(await weekCard()).toHaveAccessibleName(sampleName);
    });
  });

  describe("offline", () => {
    it("should show the week it already has, still pressable, under the one offline banner", async () => {
      const user = userEvent.setup();
      await renderDashboard();
      await weekCard();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getAllByText("You're offline")).toHaveLength(1);
      expect(await weekCard()).toHaveAccessibleName(sampleName);

      await user.press(await weekCard());

      expect(
        await screen.findByRole("heading", { name: "Diary day=2026-10-15" }),
      ).toBeOnTheScreen();
    });

    it("should say This week isn't available offline when no week is on hand", async () => {
      diaryBackend.weekReadsHang = true;
      await renderDashboard();
      await todayCard();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(await screen.findByText("This week isn't available offline.")).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Loading this week" })).not.toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^This week, open the diary/ }),
      ).not.toBeOnTheScreen();
      expect(screen.getByText("Week of Mon 12 Oct")).toBeOnTheScreen();
    });

    it("should offer no Try again for a week that is not there offline", async () => {
      diaryBackend.weekReadsHang = true;
      await renderDashboard();
      await todayCard();

      await act(() => {
        onlineManager.setOnline(false);
      });
      await screen.findByText("This week isn't available offline.");

      expect(screen.queryByRole("button", { name: "Try again" })).not.toBeOnTheScreen();
    });
  });

  describe("at midnight", () => {
    // 22:00 in London on Sunday 18 October, the last day of the week.
    beforeEach(() => {
      mockNow = new Date("2026-10-18T21:00:00Z");
      showWeek([2140, 2260, 1286, 1039, 1800, 1500, 1200], ["2026-10-12", "2026-10-13"]);
    });

    it("should read the next week when Sunday turns into Monday, and never sum the old one for the new day", async () => {
      await renderDashboard();
      expect(await weekCard()).toHaveAccessibleName(/2 of 7 days complete\.$/);

      // 00:30 in London on Monday 19 October. The new week never answers.
      diaryBackend.weekReadsHang = true;
      await moveClockTo("2026-10-18T23:30:00Z");

      expect(await screen.findByRole("status", { name: "Loading this week" })).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: /^This week, open the diary/ }),
      ).not.toBeOnTheScreen();
      expect(
        diaryBackend.requests.some(
          (request) =>
            request.table === "day_totals" && request.search.includes("local_date=gte.2026-10-19"),
        ),
      ).toBe(true);
    });

    it("should show the new week once it has loaded", async () => {
      await renderDashboard();
      await weekCard();

      diaryBackend.dayTotals = [dayTotalsRow("2026-10-19", [1500, 100, 150, 50])];
      diaryBackend.dayLogs = [];
      await moveClockTo("2026-10-18T23:30:00Z");

      expect(await screen.findByText("Week of Mon 19 Oct", hidden)).toBeOnTheScreen();
      expect(await weekCard()).toHaveAccessibleName(
        "This week, open the diary. Average 1,500 of 2,200 kilocalories a day, from 1 day with food logged. 0 of 1 day complete.",
      );
    });
  });

  describe("midnight inside the week", () => {
    it("should move today along the markers without leaving the card", async () => {
      await renderDashboard();
      await weekCard();

      // 00:30 in London on Friday 16 October.
      await moveClockTo("2026-10-15T23:30:00Z");

      expect(
        await screen.findByRole("button", { name: /2 of 5 days complete\.$/ }),
      ).toBeOnTheScreen();
      expect(marker("Friday 16 October, today")).toBeOnTheScreen();
    });
  });

  describe("the time zone", () => {
    it("should count today in the profile's zone, the day the Today card counts", async () => {
      diaryBackend.timezone = "Pacific/Kiritimati";
      await renderDashboard();

      // 10:20 UTC on the 15th is 00:20 on Friday the 16th in Kiritimati.
      expect(await weekCard()).toHaveAccessibleName(/2 of 5 days complete\.$/);
      expect(marker("Friday 16 October, today")).toBeOnTheScreen();
    });
  });
});
