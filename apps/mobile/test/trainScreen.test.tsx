import { KeyLowProvider, keys } from "@keylow/api-client";
import {
  TRAIN_ERROR,
  TRAIN_FIRST_TIME,
  TRAIN_HOME,
  TRAIN_LOADING_NAME,
  TRAIN_NO_ROUTINE,
  TRAIN_OFFLINE_NOTHING_SAVED,
  TRAIN_OFFLINE_TITLE,
  describeOfflineBanner,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { TrainScreen } from "../components/TrainScreen";
import { ThemeProvider } from "../lib/theme";
import { diaryBackend, createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  activeRoutine,
  loggedSession,
  resetTrainBackend,
  trainBackend,
  trainClient,
  trainRequestsTo,
} from "./support/trainBackend";

import type { TrainScreenProps } from "../components/TrainScreen";
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

// 17:55 in London on Thursday 15 October 2026, which is BST: the week of Monday 12 October.
jest.mock("../lib/useNow", () => ({ useNow: () => new Date("2026-10-15T16:55:00Z") }));

setUpTests();

let queryClient: QueryClient;

async function renderTrain(props: TrainScreenProps = {}) {
  queryClient = createDiaryQueryClient();
  await render(
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={trainClient} queryClient={queryClient}>
        <TrainScreen {...props} />
      </KeyLowProvider>
    </ThemeProvider>,
  );
}

// The skeleton is hidden from a screen reader, so a test that looks at it asks for hidden elements.
const hidden = { includeHiddenElements: true };

const noHandlers: TrainScreenProps = {};
const allHandlers = () => ({
  onLogSession: jest.fn(),
  onCreateRoutine: jest.fn(),
  onSetGoal: jest.fn(),
});

describe("the Train screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", ["components/TrainScreen", "app"]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetTrainBackend();
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the first visit: no routine and no session, ever", () => {
    it("should show the title, the body map at rest and the Train with Ki-Lo card with its three lines", async () => {
      await renderTrain();

      expect(
        await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title }),
      ).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: TRAIN_HOME.title })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: TRAIN_FIRST_TIME.figureLabel })).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_FIRST_TIME.body)).toBeOnTheScreen();
      expect(screen.getAllByRole("listitem")).toHaveLength(TRAIN_FIRST_TIME.points.length);
      for (const point of TRAIN_FIRST_TIME.points) {
        expect(screen.getByRole("listitem", { name: point })).toBeOnTheScreen();
      }
    });

    it("should not show the no routine card", async () => {
      await renderTrain();
      await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });

      expect(screen.queryByRole("heading", { name: TRAIN_NO_ROUTINE.title })).not.toBeOnTheScreen();
    });

    it("should draw no button when no handler is given", async () => {
      await renderTrain(noHandlers);
      await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw Set your goal and Log a session when their handlers are given, and call them", async () => {
      const handlers = allHandlers();
      const user = userEvent.setup();
      await renderTrain(handlers);

      await user.press(await screen.findByRole("button", { name: TRAIN_FIRST_TIME.goalAction }));
      await user.press(screen.getByRole("button", { name: TRAIN_FIRST_TIME.logAction }));

      expect(handlers.onSetGoal).toHaveBeenCalledTimes(1);
      expect(handlers.onLogSession).toHaveBeenCalledTimes(1);
      expect(handlers.onCreateRoutine).not.toHaveBeenCalled();
    });

    it("should draw only the buttons whose handler is given", async () => {
      await renderTrain({ onSetGoal: jest.fn() });

      expect(
        await screen.findByRole("button", { name: TRAIN_FIRST_TIME.goalAction }),
      ).toBeOnTheScreen();
      expect(
        screen.queryByRole("button", { name: TRAIN_FIRST_TIME.logAction }),
      ).not.toBeOnTheScreen();
    });
  });

  describe("the first visit against the board", () => {
    it("should lay each of the three lines out as a row with 12 points between the tile and the words", async () => {
      await renderTrain();
      await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title });

      for (const line of screen.getAllByRole("listitem")) {
        expect(line).toHaveStyle({ flexDirection: "row", alignItems: "center", columnGap: 12 });
      }
    });
  });

  describe("sessions but no routine", () => {
    beforeEach(() => {
      trainBackend.sessions = [loggedSession];
    });

    it("should show the No routine yet card with its sentence, and not the first visit", async () => {
      await renderTrain();

      expect(
        await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title }),
      ).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_NO_ROUTINE.body)).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: TRAIN_FIRST_TIME.title })).not.toBeOnTheScreen();
    });

    it("should draw no button when no handler is given", async () => {
      await renderTrain(noHandlers);
      await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should draw Create routine and Log a session anyway when their handlers are given, and call them", async () => {
      const handlers = allHandlers();
      const user = userEvent.setup();
      await renderTrain(handlers);

      await user.press(await screen.findByRole("button", { name: TRAIN_NO_ROUTINE.createAction }));
      await user.press(screen.getByRole("button", { name: TRAIN_NO_ROUTINE.logAction }));

      expect(handlers.onCreateRoutine).toHaveBeenCalledTimes(1);
      expect(handlers.onLogSession).toHaveBeenCalledTimes(1);
      expect(handlers.onSetGoal).not.toHaveBeenCalled();
    });
  });

  describe("with a routine", () => {
    it("should show neither the first visit nor the no routine card", async () => {
      trainBackend.routine = activeRoutine;
      trainBackend.sessions = [loggedSession];
      await renderTrain(allHandlers());
      await waitFor(() => {
        expect(trainRequestsTo("routines")).toBe(1);
      });
      await waitFor(() => {
        expect(screen.queryByRole("status", { name: TRAIN_LOADING_NAME })).not.toBeOnTheScreen();
      });

      expect(screen.queryByRole("heading", { name: TRAIN_FIRST_TIME.title })).not.toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: TRAIN_NO_ROUTINE.title })).not.toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });
  });

  describe("with a routine, the sessions are not needed", () => {
    it("should not read the sessions, since a routine already says it is not a first visit", async () => {
      trainBackend.routine = activeRoutine;
      await renderTrain();
      await waitFor(() => {
        expect(screen.queryByRole("status", { name: TRAIN_LOADING_NAME })).not.toBeOnTheScreen();
      });

      expect(trainRequestsTo("workout_sessions")).toBe(0);
    });

    it("should not wait for, or fail on, a sessions read that never answers or fails", async () => {
      trainBackend.routine = activeRoutine;
      trainBackend.hungTables.add("workout_sessions");
      trainBackend.failingTables.add("workout_sessions");
      await renderTrain();

      await waitFor(() => {
        expect(screen.queryByRole("status", { name: TRAIN_LOADING_NAME })).not.toBeOnTheScreen();
      });
      expect(screen.queryByText(TRAIN_ERROR.title)).not.toBeOnTheScreen();
    });
  });

  describe("loading", () => {
    beforeEach(() => {
      trainBackend.hungTables.add("routines");
    });

    it("should keep the title and show the skeleton, named as loading, and no card", async () => {
      await renderTrain(allHandlers());

      expect(await screen.findByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
      expect(screen.getByTestId("skeleton-train-home", hidden)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: TRAIN_HOME.title })).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it("should start the skeleton clear, so a quick load never flickers", async () => {
      await renderTrain();
      await screen.findByRole("status", { name: TRAIN_LOADING_NAME });

      expect(screen.getByTestId("skeleton", hidden)).toHaveStyle({ opacity: 0 });
    });
  });

  describe("a failed load", () => {
    it("should show the error card in place of the content, with the title kept", async () => {
      trainBackend.failingTables.add("routines");
      await renderTrain(allHandlers());

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_ERROR.body)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: TRAIN_HOME.title })).toBeOnTheScreen();
      expect(screen.queryByRole("heading", { name: TRAIN_FIRST_TIME.title })).not.toBeOnTheScreen();
    });

    it("should read again when Try again is pressed, and show the content once it loads", async () => {
      trainBackend.failingTables.add("routines");
      const user = userEvent.setup();
      await renderTrain();
      await user.press(await screen.findByRole("button", { name: TRAIN_ERROR.action }));
      const readsAfterFirstFailure = trainRequestsTo("routines");
      trainBackend.failingTables.clear();

      await user.press(screen.getByRole("button", { name: TRAIN_ERROR.action }));

      expect(
        await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title }),
      ).toBeOnTheScreen();
      expect(trainRequestsTo("routines")).toBeGreaterThan(readsAfterFirstFailure);
    });

    it("should fail when the sessions read fails with no routine, since a first visit cannot be told from no routine", async () => {
      trainBackend.routine = null;
      trainBackend.failingTables.add("workout_sessions");
      await renderTrain();

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeOnTheScreen();
    });

    it("should fail when the time zone read fails", async () => {
      diaryBackend.timeZoneReadFails = true;
      await renderTrain();

      expect(await screen.findByText(TRAIN_ERROR.title)).toBeOnTheScreen();
    });
  });

  describe("offline", () => {
    // 17:52 in London on Thursday 15 October 2026, which is BST.
    const SAVED_AT = new Date("2026-10-15T16:52:00Z").getTime();

    function seedCache(updatedAt: { zone: number; routine: number; session: number }) {
      queryClient = createDiaryQueryClient();
      queryClient.setQueryData(keys.profiles.timeZone, "Europe/London", {
        updatedAt: updatedAt.zone,
      });
      queryClient.setQueryData(keys.training.activeRoutine, null, { updatedAt: updatedAt.routine });
      queryClient.setQueryData(keys.training.hasLoggedSession, false, {
        updatedAt: updatedAt.session,
      });
      queryClient.setQueryData(keys.training.weekSessions("2026-10-12"), [], {
        updatedAt: SAVED_AT,
      });
      queryClient.setQueryData(keys.training.activeSession, null, { updatedAt: SAVED_AT });
    }

    async function renderWithCache(props: TrainScreenProps = {}) {
      await render(
        <ThemeProvider fixedPreference="dark">
          <KeyLowProvider client={trainClient} queryClient={queryClient}>
            <TrainScreen {...props} />
          </KeyLowProvider>
        </ThemeProvider>,
      );
    }

    it("should keep the cached content and say when it was saved, without reading again", async () => {
      seedCache({ zone: SAVED_AT, routine: SAVED_AT, session: SAVED_AT });
      onlineManager.setOnline(false);
      await renderWithCache();

      expect(
        await screen.findByRole("heading", { name: TRAIN_FIRST_TIME.title }),
      ).toBeOnTheScreen();
      expect(
        screen.getByRole("status", {
          name: `${TRAIN_OFFLINE_TITLE} ${describeOfflineBanner("17:52")}`,
        }),
      ).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeOnTheScreen();
      expect(screen.getByText(describeOfflineBanner("17:52"))).toBeOnTheScreen();
      expect(trainRequestsTo("routines")).toBe(0);
    });

    it("should name the oldest of the reads, since the content is no fresher than that", async () => {
      seedCache({
        zone: SAVED_AT,
        routine: SAVED_AT - 2 * 60 * 1000,
        session: SAVED_AT - 60 * 1000,
      });
      onlineManager.setOnline(false);
      await renderWithCache();

      expect(await screen.findByText(describeOfflineBanner("17:50"))).toBeOnTheScreen();
    });

    it("should show the banner and keep the content when the phone goes offline after loading", async () => {
      trainBackend.sessions = [loggedSession];
      await renderTrain();
      await screen.findByRole("heading", { name: TRAIN_NO_ROUTINE.title });
      expect(screen.queryByText(TRAIN_OFFLINE_TITLE)).not.toBeOnTheScreen();

      await act(() => {
        onlineManager.setOnline(false);
      });

      expect(screen.getByText(TRAIN_OFFLINE_TITLE)).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: TRAIN_NO_ROUTINE.title })).toBeOnTheScreen();
    });

    it("should disable the buttons that start a session, and leave the others", async () => {
      seedCache({ zone: SAVED_AT, routine: SAVED_AT, session: SAVED_AT });
      onlineManager.setOnline(false);
      await renderWithCache(allHandlers());

      expect(
        await screen.findByRole("button", { name: TRAIN_FIRST_TIME.logAction }),
      ).toBeDisabled();
      expect(screen.getByRole("button", { name: TRAIN_FIRST_TIME.goalAction })).toBeEnabled();
    });

    it("should say nothing is saved yet, over the skeleton, when nothing is cached", async () => {
      onlineManager.setOnline(false);
      await renderTrain();

      expect(await screen.findByText(TRAIN_OFFLINE_TITLE)).toBeOnTheScreen();
      expect(screen.getByText(TRAIN_OFFLINE_NOTHING_SAVED)).toBeOnTheScreen();
      expect(await screen.findByRole("status", { name: TRAIN_LOADING_NAME })).toBeOnTheScreen();
    });
  });

  describe("the terms gate", () => {
    it("should make no training or profile read while the terms are not accepted", async () => {
      diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
      await renderTrain();
      await screen.findByRole("status", { name: TRAIN_LOADING_NAME });
      await act(async () => {
        await Promise.resolve();
      });

      expect(trainRequestsTo("routines")).toBe(0);
      expect(trainRequestsTo("workout_sessions")).toBe(0);
      expect(
        diaryBackend.requests.filter((request) => request.search.includes("timezone")),
      ).toHaveLength(0);
    });
  });
});
