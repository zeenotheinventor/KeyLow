import { keys, markAchievementsSeen } from "@keylow/api-client";
import { ACHIEVEMENTS, runAchievements } from "@keylow/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent } from "@testing-library/react-native";

import { DashboardBackfillCard } from "../components/AchievementsScreen";
import { resetRouterMock, routerMock } from "./support/expoRouterMock";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import { recordCelebrations, resetCelebrations } from "../lib/achievements/celebrationStore";
import { snapshotHolding, storedStatsWithOneEntry } from "../lib/achievements/storedStatsFixture";
import { ThemeProvider } from "../lib/theme";

import type { AchievementState } from "@keylow/api-client";

type HeldRows = AchievementState["held"];

// What the read answers. The read itself is tested where it lives, in `@keylow/api-client`.
const mockRead: { data: AchievementState | undefined } = { data: undefined };
// One object for every render, as the real client is, because the hook that marks rows seen depends on it.
const mockClient = { name: "the supabase client" };

jest.mock("@keylow/api-client", () => ({
  ...jest.requireActual<object>("@keylow/api-client"),
  useAchievementState: () => mockRead,
  useSupabase: () => mockClient,
  markAchievementsSeen: jest.fn(() => Promise.resolve()),
}));
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("./support/expoRouterMock").mockExpoRouter,
);

// 23 bronze badges, the first of them First Bite, worth 230 points, which is level 2.
const BRONZE_IDS = ACHIEVEMENTS.filter(({ tier }) => tier === "bronze")
  .slice(0, 23)
  .map(({ id }) => id);

const row = (id: string, overrides: Partial<HeldRows[number]> = {}): HeldRows[number] => ({
  id,
  unlockedAt: "2026-11-06T09:00:00.000Z",
  seenAt: null,
  backfilled: true,
  ...overrides,
});

function readHolding(rows: HeldRows): AchievementState {
  const run = runAchievements({
    stats: storedStatsWithOneEntry,
    weighInDates: [],
    held: rows.map((held) => held.id),
    ledger: [],
    device: { reminderEnabled: false },
    now: new Date("2026-11-19T12:00:00Z"),
    isBackfill: false,
  });
  return { run, held: rows, today: "2026-11-19", weeks: { training: [], weighIn: [] } };
}

let queryClient: QueryClient;

function Card() {
  return (
    <ThemeProvider fixedPreference="dark">
      <QueryClientProvider client={queryClient}>
        <DashboardBackfillCard isReadEnabled />
      </QueryClientProvider>
    </ThemeProvider>
  );
}

async function renderCard() {
  const user = userEvent.setup();
  await render(<Card />);
  return user;
}

describe("the backfill card on the Dashboard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/AchievementsScreen"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetRouterMock();
    resetCelebrations();
    jest.mocked(markAchievementsSeen).mockClear();
    mockRead.data = readHolding(BRONZE_IDS.map((id) => row(id)));
    queryClient = new QueryClient();
  });

  afterEach(async () => {
    await cleanup();
    queryClient.clear();
  });

  it("should say how many badges were already earned and which level they reached", async () => {
    await renderCard();

    expect(screen.getByRole("heading", { name: "Achievements are here" })).toBeOnTheScreen();
    expect(
      screen.getByText("You have already earned 23 badges and reached level 2."),
    ).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "See your badges" })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeOnTheScreen();
  });

  it("should count only backfilled rows that are not yet seen", async () => {
    mockRead.data = readHolding([
      row("first-bite"),
      row("home-cook", { seenAt: "2026-11-07T09:00:00.000Z" }),
      row("jotter", { backfilled: false }),
    ]);
    await renderCard();

    expect(screen.getByText(/^You have already earned 1 badge and/)).toBeOnTheScreen();
  });

  it("should not show when nothing was backfilled", async () => {
    mockRead.data = readHolding([row("first-bite", { backfilled: false })]);
    await renderCard();

    expect(screen.queryByRole("heading", { name: "Achievements are here" })).not.toBeOnTheScreen();
  });

  it("should not show once every backfilled row is seen", async () => {
    mockRead.data = readHolding(
      BRONZE_IDS.map((id) => row(id, { seenAt: "2026-11-07T09:00:00Z" })),
    );
    await renderCard();

    expect(screen.queryByRole("heading", { name: "Achievements are here" })).not.toBeOnTheScreen();
  });

  it("should not show before the rows are read", async () => {
    mockRead.data = undefined;
    await renderCard();

    expect(screen.queryByRole("heading", { name: "Achievements are here" })).not.toBeOnTheScreen();
  });

  it("should read the database and not the celebration queue", async () => {
    mockRead.data = readHolding([]);
    recordCelebrations({ entries: [], notification: null, backfillSummary: 23 }, true);
    await renderCard();

    expect(screen.queryByRole("heading", { name: "Achievements are here" })).not.toBeOnTheScreen();
  });

  describe("See your badges", () => {
    it("should open the Achievements screen, which marks them seen", async () => {
      const user = await renderCard();

      await user.press(screen.getByRole("button", { name: "See your badges" }));

      expect(routerMock.push).toHaveBeenCalledWith("/more/achievements");
      expect(markAchievementsSeen).not.toHaveBeenCalled();
    });
  });

  describe("Dismiss", () => {
    it("should mark exactly the backfilled rows seen, hide the card at once and read the rows again", async () => {
      mockRead.data = readHolding([
        row("first-bite"),
        row("home-cook"),
        row("jotter", { backfilled: false }),
        row("notebook", { seenAt: "2026-11-07T09:00:00.000Z" }),
      ]);
      const invalidate = jest.spyOn(queryClient, "invalidateQueries");
      const user = await renderCard();

      await user.press(screen.getByRole("button", { name: "Dismiss" }));

      expect(markAchievementsSeen).toHaveBeenCalledTimes(1);
      expect(markAchievementsSeen).toHaveBeenCalledWith(mockClient, ["first-bite", "home-cook"]);
      expect(
        screen.queryByRole("heading", { name: "Achievements are here" }),
      ).not.toBeOnTheScreen();
      expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.achievements.all });
    });

    it("should stamp the cached read for exactly those rows before the write has answered", async () => {
      const rows = [row("first-bite"), row("home-cook", { backfilled: false })];
      mockRead.data = readHolding(rows);
      queryClient.setQueryData(keys.achievements.state, snapshotHolding(rows));
      jest.mocked(markAchievementsSeen).mockImplementationOnce(() => new Promise(() => undefined));
      const user = await renderCard();

      await user.press(screen.getByRole("button", { name: "Dismiss" }));

      const cached = queryClient.getQueryData<ReturnType<typeof snapshotHolding>>(
        keys.achievements.state,
      );
      expect(cached?.held.map(({ id, seenAt }) => [id, seenAt === null])).toEqual([
        ["first-bite", false],
        ["home-cook", true],
      ]);
    });

    it("should stay hidden for the session when the write fails", async () => {
      jest.mocked(markAchievementsSeen).mockRejectedValueOnce(new Error("offline"));
      const user = await renderCard();

      await user.press(screen.getByRole("button", { name: "Dismiss" }));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(
        screen.queryByRole("heading", { name: "Achievements are here" }),
      ).not.toBeOnTheScreen();
    });

    it("should stay hidden when the Dashboard mounts again while the write is in flight", async () => {
      jest.mocked(markAchievementsSeen).mockImplementationOnce(() => new Promise(() => undefined));
      const user = userEvent.setup();
      const view = await render(<Card />);

      await user.press(screen.getByRole("button", { name: "Dismiss" }));
      await view.unmount();
      await render(<Card />);

      expect(
        screen.queryByRole("heading", { name: "Achievements are here" }),
      ).not.toBeOnTheScreen();
    });
  });
});
