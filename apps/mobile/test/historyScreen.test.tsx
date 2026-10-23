import { KeyLowProvider } from "@keylow/api-client";
import { HISTORY_LOAD_EARLIER_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { HistoryScreen } from "../components/HistoryScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import {
  earlierHistoryWeek,
  goldenHistoryWeek,
  historyBackend,
  historyClient,
  historySession,
  historyWeeks,
  resetHistoryBackend,
  withEverySetDeleted,
} from "./support/historyBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";

import type { HistoryScreenProps } from "../components/HistoryScreen";
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
// 11:20 in London on Thursday 15 October 2026, in the golden week.
jest.mock("../lib/useNow", () => {
  const mockNow = new Date("2026-10-15T10:20:00Z");

  return { useNow: () => mockNow };
});

setUpTests();

const THIS_WEEK = "This week · Mon 12 to Sun 18 Oct";
const LAST_WEEK = "Last week · Mon 5 to Sun 11 Oct";

let queryClient: QueryClient;

async function renderHistory(props: Partial<HistoryScreenProps> = {}, client = queryClient) {
  const user = userEvent.setup();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={historyClient} queryClient={client}>
        <ToastProvider>
          <HistoryScreen
            onBack={() => undefined}
            onOpenSession={() => undefined}
            onResumeSession={() => undefined}
            {...props}
          />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>,
  );
  return user;
}

// The week cards. A list is not an accessibility element, so it is found by its name.
const weekLists = () => screen.queryAllByLabelText(/ to Sun /);

const goOffline = () =>
  act(() => {
    onlineManager.setOnline(false);
  });

describe("the history screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/HistoryScreen", "components/SessionRow"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetHistoryBackend();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("with the golden week and the week before it", () => {
    beforeEach(() => {
      historyBackend.sessions = [...goldenHistoryWeek, ...earlierHistoryWeek];
    });

    it("should be headed History, with Back to Train", async () => {
      const onBack = jest.fn();
      const user = await renderHistory({ onBack });

      expect(screen.getByRole("heading", { name: "History" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to Train" }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should draw the two weeks as cards of 3 and 4 sessions, newest week first", async () => {
      await renderHistory();

      const thisWeek = await screen.findByLabelText(THIS_WEEK);
      const lastWeek = await screen.findByLabelText(LAST_WEEK);
      expect(within(thisWeek).getAllByLabelText(/October/)).toHaveLength(3);
      expect(within(lastWeek).getAllByLabelText(/October/)).toHaveLength(4);
      const [title, firstWeek, secondWeek] = screen.getAllByRole("heading");
      expect(title).toHaveTextContent("History");
      expect(firstWeek).toHaveTextContent(THIS_WEEK);
      expect(secondWeek).toHaveTextContent(LAST_WEEK);
    });

    it("should head each week with its name and its total", async () => {
      await renderHistory();

      expect(await screen.findByRole("heading", { name: THIS_WEEK })).toBeOnTheScreen();
      expect(screen.getByText("3 sessions · 41 sets")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: LAST_WEEK })).toBeOnTheScreen();
      expect(screen.getByText("4 sessions · 63 sets")).toBeOnTheScreen();
    });

    it("should list a week's sessions newest first, each with the board's row text", async () => {
      await renderHistory();

      const thisWeek = await screen.findByLabelText(THIS_WEEK);
      const rows = within(thisWeek).getAllByLabelText(/October/);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveAccessibleName(
        "Legs, Thu 15 October, 30 minutes · 8 sets, open session",
      );
      expect(rows[1]).toHaveAccessibleName(
        "Pull, Tue 13 October, 51 minutes · 17 sets, open session",
      );
      expect(rows[2]).toHaveAccessibleName(
        "Push, Mon 12 October, 48 minutes · 16 sets, open session",
      );
      const pull = within(thisWeek).getByLabelText(/^Pull/);
      expect(within(pull).getByText("Tue")).toBeOnTheScreen();
      expect(within(pull).getByText("13")).toBeOnTheScreen();
      expect(within(pull).getByText("51 min · 17 sets")).toBeOnTheScreen();
      expect(within(pull).getByText("Lats · biceps · mid traps")).toBeOnTheScreen();
    });

    it("should draw every row as a button that opens its session", async () => {
      await renderHistory();

      await screen.findByLabelText(THIS_WEEK);
      expect(screen.getAllByRole("button", { name: /open session$/ })).toHaveLength(7);
    });

    it("should open the session of the row that is pressed, and no other", async () => {
      const onOpenSession = jest.fn();
      const user = await renderHistory({ onOpenSession });
      await screen.findByLabelText(THIS_WEEK);

      await user.press(screen.getByRole("button", { name: /^Pull, Tue 13 October/ }));

      expect(onOpenSession).toHaveBeenCalledTimes(1);
      expect(onOpenSession).toHaveBeenCalledWith(String(goldenHistoryWeek[1]?.["id"]));
    });

    it("should offer no earlier weeks when there are none", async () => {
      await renderHistory();

      await screen.findByLabelText(LAST_WEEK);
      expect(screen.queryByRole("button", { name: "Load earlier weeks" })).toBeNull();
    });
  });

  describe("with a session that was started and never ended", () => {
    const openLegs = historySession({
      localDate: "2026-10-15",
      dayName: "Legs",
      kind: "legs",
      minutes: null,
      workingSets: 8,
    });
    const OPEN_ROW = "Legs, Thu 15 October, 8 sets, in progress, resume session";

    beforeEach(() => {
      historyBackend.sessions = [...goldenHistoryWeek.slice(0, 2), openLegs, ...earlierHistoryWeek];
    });

    it("should draw it once, in its week and its newest first place, as In progress with its sets", async () => {
      await renderHistory();

      const thisWeek = await screen.findByLabelText(THIS_WEEK);
      const rows = within(thisWeek).getAllByLabelText(/October/);
      expect(rows).toHaveLength(3);
      expect(rows[0]).toHaveAccessibleName(OPEN_ROW);
      const open = within(thisWeek).getByRole("button", { name: OPEN_ROW });
      expect(within(open).getByText("In progress · 8 sets")).toBeOnTheScreen();
      expect(within(open).queryByText(/min/)).toBeNull();
      expect(screen.getAllByRole("button", { name: OPEN_ROW })).toHaveLength(1);
    });

    it("should count its sets in the week's total like any other session", async () => {
      await renderHistory();

      expect(await screen.findByText("3 sessions · 41 sets")).toBeOnTheScreen();
    });

    it("should resume the session, and open no detail, when its row is pressed", async () => {
      const onOpenSession = jest.fn();
      const onResumeSession = jest.fn();
      const user = await renderHistory({ onOpenSession, onResumeSession });
      await screen.findByLabelText(THIS_WEEK);

      await user.press(screen.getByRole("button", { name: OPEN_ROW }));

      expect(onResumeSession).toHaveBeenCalledTimes(1);
      expect(onOpenSession).not.toHaveBeenCalled();
    });

    it("should still open the detail, and not resume, when a finished session's row is pressed", async () => {
      const onOpenSession = jest.fn();
      const onResumeSession = jest.fn();
      const user = await renderHistory({ onOpenSession, onResumeSession });
      await screen.findByLabelText(THIS_WEEK);

      await user.press(screen.getByRole("button", { name: /^Pull, Tue 13 October/ }));

      expect(onOpenSession).toHaveBeenCalledWith(String(goldenHistoryWeek[1]?.["id"]));
      expect(onResumeSession).not.toHaveBeenCalled();
    });
  });

  describe("with sessions that have no logged set", () => {
    const emptySession = (localDate: string) =>
      historySession({ localDate, dayName: "Push", kind: "push", minutes: 40, workingSets: 0 });

    it("should leave out a started session with no set, and one whose sets were all deleted", async () => {
      historyBackend.sessions = [
        ...goldenHistoryWeek,
        emptySession("2026-10-14"),
        withEverySetDeleted(
          historySession({
            localDate: "2026-10-16",
            dayName: "Pull",
            kind: "pull",
            minutes: 40,
            workingSets: 6,
          }),
        ),
      ];
      await renderHistory();

      const thisWeek = await screen.findByLabelText(THIS_WEEK);
      expect(within(thisWeek).getAllByLabelText(/October/)).toHaveLength(3);
      expect(screen.getByText("3 sessions · 41 sets")).toBeOnTheScreen();
      expect(screen.queryByLabelText(/Wed 14 October/)).toBeNull();
      expect(screen.queryByLabelText(/Fri 16 October/)).toBeNull();
    });

    it("should skip a week that holds only empty sessions, in the list and in Load earlier weeks", async () => {
      historyBackend.sessions = [
        ...goldenHistoryWeek,
        emptySession("2026-10-06"),
        emptySession("2026-10-08"),
        ...historyWeeks("2026-09-28", 1),
      ];
      await renderHistory();

      await screen.findByLabelText(THIS_WEEK);
      await waitFor(() => {
        expect(weekLists()).toHaveLength(2);
      });
      expect(screen.getByLabelText("Mon 28 Sep to Sun 4 Oct")).toBeOnTheScreen();
      expect(screen.queryByLabelText(/Mon 5 to Sun 11 Oct/)).toBeNull();
      expect(screen.queryByRole("button", { name: "Load earlier weeks" })).toBeNull();
    });

    it("should show the empty state when no session anywhere has a logged set", async () => {
      historyBackend.sessions = [emptySession("2026-10-14"), emptySession("2026-10-06")];
      await renderHistory();

      expect(await screen.findByRole("heading", { name: "No sessions yet" })).toBeOnTheScreen();
      expect(weekLists()).toHaveLength(0);
    });
  });

  describe("with more weeks than it loads at first", () => {
    beforeEach(() => {
      historyBackend.sessions = historyWeeks("2026-10-12", 4);
    });

    it("should load two weeks, then the next earlier week each time Load earlier weeks is pressed", async () => {
      const user = await renderHistory();

      await screen.findByLabelText(THIS_WEEK);
      expect(weekLists()).toHaveLength(2);

      await user.press(screen.getByRole("button", { name: "Load earlier weeks" }));

      await waitFor(() => {
        expect(weekLists()).toHaveLength(3);
      });
      expect(screen.getByLabelText("Mon 28 Sep to Sun 4 Oct")).toBeOnTheScreen();
    });

    it("should take Load earlier weeks away once the oldest week is shown", async () => {
      const user = await renderHistory();
      await screen.findByLabelText(THIS_WEEK);

      await user.press(screen.getByRole("button", { name: "Load earlier weeks" }));
      await waitFor(() => {
        expect(weekLists()).toHaveLength(3);
      });
      await user.press(screen.getByRole("button", { name: "Load earlier weeks" }));

      await waitFor(() => {
        expect(weekLists()).toHaveLength(4);
      });
      expect(screen.queryByRole("button", { name: "Load earlier weeks" })).toBeNull();
    });

    it("should show a danger toast that states the rule, and keep the weeks, when the earlier week does not load", async () => {
      const user = await renderHistory();
      await screen.findByLabelText(LAST_WEEK);
      historyBackend.failing = true;

      await user.press(screen.getByRole("button", { name: "Load earlier weeks" }));

      expect(
        await screen.findByRole("status", { name: HISTORY_LOAD_EARLIER_FAILED }),
      ).toBeOnTheScreen();
      expect(weekLists()).toHaveLength(2);
      expect(screen.getByRole("button", { name: "Load earlier weeks" })).toBeEnabled();
    });

    it("should load the week on the next press once the connection is back, after a failure", async () => {
      const user = await renderHistory();
      await screen.findByLabelText(LAST_WEEK);
      historyBackend.failing = true;
      await user.press(screen.getByRole("button", { name: "Load earlier weeks" }));
      await screen.findByRole("status", { name: HISTORY_LOAD_EARLIER_FAILED });
      historyBackend.failing = false;

      await user.press(screen.getByRole("button", { name: "Load earlier weeks" }));

      await waitFor(() => {
        expect(weekLists()).toHaveLength(3);
      });
    });

    it("should dim Load earlier weeks while offline, since the earlier weeks are not saved", async () => {
      await renderHistory();
      await screen.findByLabelText(THIS_WEEK);

      await goOffline();

      expect(screen.getByRole("button", { name: "Load earlier weeks" })).toBeDisabled();
    });
  });

  describe("with nothing logged", () => {
    it("should say there are no sessions yet, and offer no Start without a handler", async () => {
      await renderHistory();

      expect(await screen.findByRole("heading", { name: "No sessions yet" })).toBeOnTheScreen();
      expect(
        screen.getByText("Every session you log shows here, newest first, with its sets."),
      ).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Start a session" })).toBeNull();
    });

    it("should start a session that follows no routine day, in the profile's zone, from Start a session", async () => {
      const onStartSession = jest.fn();
      const user = await renderHistory({ onStartSession });

      await user.press(await screen.findByRole("button", { name: "Start a session" }));

      expect(onStartSession).toHaveBeenCalledWith({
        routineDayId: null,
        timeZone: "Europe/London",
      });
    });

    it("should dim Start a session offline, since a start needs a connection", async () => {
      await renderHistory({ onStartSession: jest.fn() });
      await screen.findByRole("heading", { name: "No sessions yet" });

      await goOffline();

      expect(screen.getByRole("button", { name: "Start a session" })).toBeDisabled();
    });

    it("should dim Start a session while a start is under way", async () => {
      await renderHistory({ onStartSession: jest.fn(), isStarting: true });

      expect(await screen.findByRole("button", { name: "Start a session" })).toBeDisabled();
    });
  });

  describe("while it loads", () => {
    it("should say the history is loading, and draw no list", async () => {
      historyBackend.hung = true;
      await renderHistory();

      expect(screen.getByRole("status", { name: "Loading your history" })).toBeOnTheScreen();
      expect(weekLists()).toHaveLength(0);
      expect(screen.queryByRole("heading", { name: "No sessions yet" })).toBeNull();
    });
  });

  describe("when the history did not load", () => {
    it("should say so and read again on Try again", async () => {
      historyBackend.sessions = [...goldenHistoryWeek, ...earlierHistoryWeek];
      historyBackend.failing = true;
      const user = await renderHistory();

      expect(await screen.findByText("Your history did not load")).toBeOnTheScreen();
      expect(
        screen.getByText("Your sessions are safe. Check your connection, then try again."),
      ).toBeOnTheScreen();
      historyBackend.failing = false;
      await user.press(screen.getByRole("button", { name: "Try again" }));

      expect(await screen.findByLabelText(THIS_WEEK)).toBeOnTheScreen();
      expect(screen.queryByText("Your history did not load")).toBeNull();
    });

    it("should sit in a card at the top, the same shell as the empty state", async () => {
      historyBackend.failing = true;
      await renderHistory();

      await screen.findByText("Your history did not load");
      expect(screen.getByRole("alert").parent).toHaveStyle({
        paddingTop: 20,
        paddingLeft: 20,
        paddingRight: 20,
        paddingBottom: 16,
      });
    });

    it("should name no exercise, load or muscle in the error", async () => {
      historyBackend.failing = true;
      await renderHistory();

      await screen.findByText("Your history did not load");
      expect(screen.queryByText(/raw database text/)).toBeNull();
    });
  });

  describe("offline", () => {
    it("should show the weeks the phone saved, and ask for nothing", async () => {
      historyBackend.sessions = [...goldenHistoryWeek, ...earlierHistoryWeek];
      await renderHistory();
      await screen.findByLabelText(LAST_WEEK);
      await cleanup();
      await goOffline();
      const requestsBefore = historyBackend.requests.length;

      await renderHistory();

      expect(await screen.findByLabelText(THIS_WEEK)).toBeOnTheScreen();
      expect(await screen.findByLabelText(LAST_WEEK)).toBeOnTheScreen();
      expect(screen.queryByText("Your history did not load")).toBeNull();
      expect(historyBackend.requests).toHaveLength(requestsBefore);
    });

    it("should say the history did not load, not show a skeleton for ever, when nothing was saved", async () => {
      await goOffline();
      await renderHistory();

      expect(await screen.findByText("Your history did not load")).toBeOnTheScreen();
      expect(screen.queryByRole("status", { name: "Loading your history" })).toBeNull();
    });

    it("should offer no Try again offline, since it could read nothing, and bring the weeks in when the connection returns", async () => {
      historyBackend.sessions = [...goldenHistoryWeek, ...earlierHistoryWeek];
      await goOffline();
      await renderHistory();
      await screen.findByText("Your history did not load");

      expect(screen.queryByRole("button", { name: "Try again" })).toBeNull();

      await act(() => {
        onlineManager.setOnline(true);
      });

      expect(await screen.findByLabelText(THIS_WEEK)).toBeOnTheScreen();
    });
  });
});
