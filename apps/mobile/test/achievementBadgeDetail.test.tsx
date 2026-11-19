import { runAchievements } from "@keylow/core";
import { act, render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { resolvedColor } from "./support/themeColor";
import { viewsDrawn } from "./support/viewsDrawn";
import BadgeDetailRoute from "../app/(tabs)/more/achievements/[id]";
import { storedStatsWithOneEntry } from "../lib/achievements/storedStatsFixture";
import { ThemeProvider } from "../lib/theme";

import type { AchievementState } from "@keylow/api-client";

type HeldRows = AchievementState["held"];

// What the two reads answer. The reads themselves are tested where they live, in `@keylow/api-client`.
const mockRead: { data: AchievementState | undefined; isError: boolean } = {
  data: undefined,
  isError: false,
};
const mockTimeZone: { data: string | null | undefined } = { data: "Europe/London" };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAchievementState: () => mockRead,
  useProfileTimeZone: () => mockTimeZone,
}));
jest.mock("../lib/useReadsEnabled", () => ({ useReadsEnabled: () => true }));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);
jest.mock("@gorhom/bottom-sheet", () =>
  jest
    .requireActual<{ mockBottomSheet: () => unknown }>("./support/sheetScrollViewMock")
    .mockBottomSheet(),
);

setUpTests();

const frame = { x: 0, y: 0, width: 390, height: 844 };
const insets = { top: 47, right: 0, bottom: 34, left: 0 };

function readHolding(rows: HeldRows): AchievementState {
  const run = runAchievements({
    stats: storedStatsWithOneEntry,
    weighInDates: [],
    held: rows.map((row) => row.id),
    ledger: [],
    device: { reminderEnabled: false },
    now: new Date("2026-11-19T12:00:00Z"),
    isBackfill: false,
  });
  return { run, held: rows, today: "2026-11-19", weeks: { training: [], weighIn: [] } };
}

const heldFortnight = (unlockedAt: string): HeldRows => [
  { id: "fortnight", unlockedAt, seenAt: "2026-11-06T09:05:00.000Z", backfilled: false },
];

async function renderSheetFor(id: string, scheme: "dark" | "light" = "dark") {
  routerMock.searchParams = { id };
  const user = userEvent.setup();
  await render(
    <SafeAreaProvider initialMetrics={{ frame, insets }}>
      <ThemeProvider fixedPreference={scheme}>
        <BadgeDetailRoute />
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  return user;
}

describe("the badge detail route", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AchievementsScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    mockRead.data = readHolding(heldFortnight("2026-11-06T09:00:00.000Z"));
    mockRead.isError = false;
    mockTimeZone.data = "Europe/London";
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
  });

  it("should be a transparent modal over the Achievements screen", async () => {
    await renderSheetFor("fortnight");

    expect(routerMock.screenOptions).toContainEqual(
      expect.objectContaining({ presentation: "transparentModal" }),
    );
  });

  describe("an earned badge", () => {
    it("should show its tier and category, its name and how it was earned", async () => {
      await renderSheetFor("fortnight");

      expect(await screen.findByRole("heading", { name: "Fortnight" })).toBeOnTheScreen();
      expect(screen.getByText("Silver · Daily streaks")).toBeOnTheScreen();
      expect(screen.getByText("14-day streak")).toBeOnTheScreen();
    });

    it("should say the day it was earned in the person's time zone and what it was worth", async () => {
      mockRead.data = readHolding(heldFortnight("2026-11-06T23:30:00.000Z"));
      mockTimeZone.data = "Pacific/Auckland";
      await renderSheetFor("fortnight");

      expect(await screen.findByLabelText("Earned 7 November 2026")).toBeOnTheScreen();
      expect(screen.getByLabelText("Points +25")).toBeOnTheScreen();
    });

    it.each([null, undefined])(
      "should date it in the device's time zone while the profile's is %s",
      async (timeZone) => {
        mockRead.data = readHolding(heldFortnight("2026-11-06T23:30:00.000Z"));
        mockTimeZone.data = timeZone;
        jest.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockImplementation(() => ({
          locale: "en-GB",
          calendar: "gregory",
          numberingSystem: "latn",
          timeZone: "Pacific/Auckland",
        }));
        await renderSheetFor("fortnight");

        expect(await screen.findByLabelText("Earned 7 November 2026")).toBeOnTheScreen();
        expect(screen.getByLabelText("Points +25")).toBeOnTheScreen();
      },
    );
  });

  describe("a locked badge", () => {
    it("should show how far the person is, what it is worth and the freeze it brings", async () => {
      await renderSheetFor("month-strong");

      expect(await screen.findByRole("heading", { name: "Month Strong" })).toBeOnTheScreen();
      expect(screen.getByText("Gold · Daily streaks")).toBeOnTheScreen();
      expect(screen.getByRole("progressbar", { name: "Month Strong progress" })).toBeOnTheScreen();
      expect(screen.getByText("0 of 30 days")).toBeOnTheScreen();
      expect(screen.getByText("30 to go")).toBeOnTheScreen();
      expect(screen.getByLabelText("Worth +50 points")).toBeOnTheScreen();
      expect(screen.getByLabelText("Bonus +1 freeze")).toBeOnTheScreen();
    });
  });

  describe("a hidden badge", () => {
    it("should keep its secret", async () => {
      await renderSheetFor("midnight-snack");

      expect(await screen.findByRole("heading", { name: "A hidden badge" })).toBeOnTheScreen();
      expect(screen.getByText("Hidden and seasonal")).toBeOnTheScreen();
      expect(
        screen.getByText(
          "Some badges stay secret until you earn them. Keep using Ki-Lo and you might stumble on this one.",
        ),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Midnight Snack")).not.toBeOnTheScreen();
      expect(screen.queryByLabelText(/^Worth/)).not.toBeOnTheScreen();
    });
  });

  describe("the tier and category pill", () => {
    it.each([
      ["fortnight", "Silver · Daily streaks"],
      ["month-strong", "Gold · Daily streaks"],
      ["midnight-snack", "Hidden and seasonal"],
    ])("should be centred under the medal for %s", async (id, pill) => {
      await renderSheetFor(id);

      // The kit badge starts at the edge, so one of its ancestors is what centres it.
      let isCentred = false;
      for (let node = (await screen.findByText(pill)).parent; node; node = node.parent) {
        try {
          expect(node).toHaveStyle({ alignSelf: "center" });
          isCentred = true;
        } catch {
          // This ancestor is not the one.
        }
      }
      expect(isCentred).toBe(true);
    });
  });

  describe("the plain pills", () => {
    it.each([
      ["dark", "fortnight", "Silver · Daily streaks"],
      ["light", "fortnight", "Silver · Daily streaks"],
      ["dark", "midnight-snack", "Hidden and seasonal"],
      ["light", "midnight-snack", "Hidden and seasonal"],
    ] as const)(
      "should be outlined with the hairline in %s for %s, as its fill is the sheet's own colour",
      async (scheme, id, pill) => {
        await renderSheetFor(id, scheme);
        await screen.findByText(pill);

        expect(
          viewsDrawn({
            height: 20,
            borderWidth: 1,
            borderColor: resolvedColor(scheme, "border"),
            backgroundColor: resolvedColor(scheme, "surface-sheet"),
          }),
        ).toHaveLength(1);
      },
    );

    it("should leave a gold pill without the outline", async () => {
      await renderSheetFor("month-strong");
      await screen.findByText("Gold · Daily streaks");

      expect(viewsDrawn({ height: 20, borderColor: resolvedColor("dark", "border") })).toHaveLength(
        0,
      );
    });
  });

  describe("closing", () => {
    it("should go back from Done", async () => {
      const user = await renderSheetFor("fortnight");

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).toHaveBeenCalledTimes(1);
    });

    it("should open the Achievements screen when a link opened the sheet cold", async () => {
      routerMock.canGoBack.mockReturnValue(false);
      const user = await renderSheetFor("fortnight");

      await user.press(await screen.findByRole("button", { name: "Done" }));

      expect(routerMock.back).not.toHaveBeenCalled();
      expect(routerMock.replace).toHaveBeenCalledWith("/more/achievements");
    });
  });

  describe("when there is nothing to show", () => {
    it("should draw no sheet while the read is loading", async () => {
      mockRead.data = undefined;
      await renderSheetFor("fortnight");

      expect(screen.queryByRole("button", { name: "Done" })).not.toBeOnTheScreen();
      expect(routerMock.replace).not.toHaveBeenCalled();
    });

    it("should show the Achievements screen for an id the catalogue does not know", async () => {
      await renderSheetFor("not-a-badge");

      expect(screen.queryByRole("button", { name: "Done" })).not.toBeOnTheScreen();
      expect(routerMock.replace).toHaveBeenCalledWith("/more/achievements");
    });

    it("should show the Achievements screen, which says so, when the read failed", async () => {
      mockRead.data = undefined;
      mockRead.isError = true;
      await renderSheetFor("fortnight");

      expect(routerMock.replace).toHaveBeenCalledWith("/more/achievements");
    });
  });
});
