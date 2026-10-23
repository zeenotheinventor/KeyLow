import { KeyLowProvider } from "@keylow/api-client";
import { HISTORY_ERROR, HISTORY_SESSION_LOADING_NAME } from "@keylow/core/copy";
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

import { SessionDetailScreen } from "../components/SessionDetailScreen";
import { ToastProvider } from "../components/ui";
import { ThemeProvider } from "../lib/theme";
import { createDiaryQueryClient } from "./support/diaryBackend";
import { compileKitStyles } from "./support/kitStyles";
import { expectAccessibleNamesInOrder } from "./support/namesInOrder";
import { registerAppStyles } from "./support/nativeWindStyles";
import {
  GOLDEN_PULL_ID,
  freeSession,
  goldenPull,
  pullSession,
  pullRoutine,
  resetSessionDetailBackend,
  sessionDetailBackend,
  sessionDetailClient,
} from "./support/sessionDetailBackend";
import { trainBackend } from "./support/trainBackend";

import type { SessionDetailScreenProps } from "../components/SessionDetailScreen";
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

setUpTests();

const UNKNOWN_ID = "00000004-0000-4000-8000-00000000dead";

let queryClient: QueryClient;

function screenElement(props: Partial<SessionDetailScreenProps> = {}) {
  return (
    <ThemeProvider fixedPreference="dark">
      <KeyLowProvider client={sessionDetailClient} queryClient={queryClient}>
        <ToastProvider>
          <SessionDetailScreen
            id={GOLDEN_PULL_ID}
            origin="history"
            onBack={() => undefined}
            onOpenHistory={() => undefined}
            {...props}
          />
        </ToastProvider>
      </KeyLowProvider>
    </ThemeProvider>
  );
}

async function renderDetail(props: Partial<SessionDetailScreenProps> = {}) {
  const user = userEvent.setup();
  await render(screenElement(props));
  return user;
}

function seedGoldenPull() {
  sessionDetailBackend.sessions = [goldenPull];
  trainBackend.routine = pullRoutine;
}

// A card is a region that holds its rows, so it is not an accessibility element itself (that would fold the
// rows into one): it is found by its name, and its role is checked on the element.
const exerciseCard = (name: string) => {
  const card = screen.getByLabelText(name);
  expect(card).toHaveProp("role", "region");

  return card;
};

describe("the session detail screen", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles("", [
      "components/SessionDetailScreen",
      "components/SetRow",
      "components/ExerciseCard",
      "components/MusclesTrainedCard",
    ]);
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
    resetSessionDetailBackend();
    queryClient = createDiaryQueryClient();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  describe("the golden Tuesday Pull", () => {
    beforeEach(seedGoldenPull);

    it("should be headed with the routine day's name, with Back to History", async () => {
      const onBack = jest.fn();
      const user = await renderDetail({ onBack });

      expect(await screen.findByRole("heading", { name: "Pull" })).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Back to History" }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("should say when it was, in the person's zone", async () => {
      await renderDetail();

      expect(await screen.findByText("Tuesday 13 October · 18:00 to 18:51")).toBeOnTheScreen();
    });

    it("should draw the three cards: 51 min, 17 sets and 1 warm-up, and +2 sets over the plan", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      expect(screen.getByText("Time")).toBeOnTheScreen();
      expect(screen.getByText("51 min")).toBeOnTheScreen();
      expect(screen.getByText("Sets")).toBeOnTheScreen();
      expect(screen.getByText("17")).toBeOnTheScreen();
      expect(screen.getByText("and 1 warm-up")).toBeOnTheScreen();
      expect(screen.getByText("Plan")).toBeOnTheScreen();
      expect(screen.getByText("+2")).toBeOnTheScreen();
      expect(screen.getByText("sets over")).toBeOnTheScreen();
    });

    it("should draw the Muscles trained card under the three cards and over the exercises", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      const card = screen.getByLabelText("Muscles trained");
      expect(card).toHaveProp("role", "region");
      expect(within(card).getByText("Effective sets")).toBeOnTheScreen();
      expect(screen.getAllByRole("heading")[1]).toHaveAccessibleName("Muscles trained");
      expect(screen.getByRole("img", { name: "This session's heat, front" })).toBeOnTheScreen();
      expect(screen.getByRole("img", { name: "This session's heat, back" })).toBeOnTheScreen();
    });

    it("should list the muscles the session trained, most sets first, with the heat at its end", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      expectAccessibleNamesInOrder(screen.getAllByRole("listitem"), [
        "Lats, 16 sets, Peak",
        "Biceps, 9.6 sets, Peak",
      ]);
    });

    it("should read the heat of a session with no end at its latest set, wherever the sets are listed", async () => {
      // The sets are listed by position but were performed in the opposite order, so the last listed is the earliest.
      sessionDetailBackend.sessions = [pullSession({ endedAt: null, isReversed: true })];
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      expectAccessibleNamesInOrder(screen.getAllByRole("listitem"), [
        "Lats, 16 sets, Peak",
        "Biceps, 9.6 sets, Peak",
      ]);
    });

    it("should give a session with no end its start alone, and In progress on the Time card", async () => {
      sessionDetailBackend.sessions = [pullSession({ endedAt: null })];
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      expect(screen.getByText("Tuesday 13 October · 18:00")).toBeOnTheScreen();
      expect(screen.getByText("Time")).toBeOnTheScreen();
      expect(screen.getByText("In progress")).toBeOnTheScreen();
      expect(screen.queryByText(/ min$/)).toBeNull();
    });

    it("should list the exercises in the order they were first logged", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      const names = [
        "Pull",
        "Muscles trained",
        "Pullups",
        "Bent Over Barbell Row",
        "Wide-Grip Lat Pulldown",
        "Face Pull",
        "Seated Cable Row",
      ];
      const headings = screen.getAllByRole("heading");
      expect(headings).toHaveLength(names.length);
      names.forEach((name, index) => {
        expect(headings[index]).toHaveAccessibleName(name);
      });
    });

    it("should note Bodyweight on the pullups and give each set its reps and RIR", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      const pullups = within(exerciseCard("Pullups"));
      expect(pullups.getByText("Bodyweight")).toBeOnTheScreen();
      expect(
        pullups.getByRole("button", { name: "Set 1, 10 reps, RIR 2, edit" }),
      ).toBeOnTheScreen();
      expect(pullups.getByRole("button", { name: "Set 2, 8 reps, RIR 2, edit" })).toBeOnTheScreen();
      expect(pullups.getByRole("button", { name: "Set 3, 7 reps, RIR 2, edit" })).toBeOnTheScreen();
    });

    it("should mark the warm-up W with no RIR and number the working sets after it from 1", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      const row = within(exerciseCard("Bent Over Barbell Row"));
      expect(
        row.getByRole("button", { name: "Warm-up set, 40 kg by 10, no RIR, edit" }),
      ).toBeOnTheScreen();
      expect(row.getByText("W")).toBeOnTheScreen();
      expect(row.getByText("40 kg × 10")).toBeOnTheScreen();
      expect(row.getByText("No RIR")).toBeOnTheScreen();
      expect(
        row.getByRole("button", { name: "Set 1, 70 kg by 10, RIR 2, edit" }),
      ).toBeOnTheScreen();
      expect(row.getByRole("button", { name: "Set 3, 70 kg by 8, RIR 2, edit" })).toBeOnTheScreen();
      expect(row.queryByText("Bodyweight")).toBeNull();
    });

    it("should say the lat pulldown has 2 more than planned and name only sets 4 and 5 as not in the plan", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      const pulldown = within(exerciseCard("Wide-Grip Lat Pulldown"));
      expect(pulldown.getByText("2 more than planned")).toBeOnTheScreen();
      expect(pulldown.getAllByRole("button", { name: /^Set \d, / })).toHaveLength(5);
      expect(pulldown.getAllByRole("button", { name: /not in the plan, edit$/ })).toHaveLength(2);
      expect(
        pulldown.getByRole("button", { name: "Set 3, 60 kg by 10, RIR 1, edit" }),
      ).toBeOnTheScreen();
      expect(
        pulldown.getByRole("button", { name: "Set 4, 60 kg by 10, RIR 1, not in the plan, edit" }),
      ).toBeOnTheScreen();
      expect(
        pulldown.getByRole("button", { name: "Set 5, 60 kg by 9, RIR 1, not in the plan, edit" }),
      ).toBeOnTheScreen();
    });

    it("should note nothing on an exercise done as planned", async () => {
      await renderDetail();

      await screen.findByRole("heading", { name: "Pull" });
      expect(within(exerciseCard("Face Pull")).queryByText(/planned|Bodyweight/)).toBeNull();
    });

    it("should show the loads in the unit the person trains in", async () => {
      trainBackend.weightUnit = "lb";
      await renderDetail();

      expect(await screen.findAllByText(/^44(\.\d)? lb × 20$/)).not.toHaveLength(0);
      expect(screen.queryByText(/kg/)).toBeNull();
    });
  });

  describe("Back, named for the screen the session was opened from", () => {
    it("should be Back to History for a session opened from the history list", async () => {
      seedGoldenPull();
      await renderDetail({ origin: "history" });

      expect(await screen.findByRole("button", { name: "Back to History" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back to Train" })).toBeNull();
    });

    it("should be Back to Train for a session opened from the Train home", async () => {
      seedGoldenPull();
      await renderDetail({ origin: "train" });

      expect(await screen.findByRole("button", { name: "Back to Train" })).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: "Back to History" })).toBeNull();
    });

    it("should name Back for the Train home while the session is not found", async () => {
      await renderDetail({ id: UNKNOWN_ID, origin: "train" });

      expect(await screen.findByRole("button", { name: "Back to Train" })).toBeOnTheScreen();
    });

    it("should name Back for the Train home while the session loads", async () => {
      seedGoldenPull();
      sessionDetailBackend.hung = true;
      await renderDetail({ origin: "train" });

      expect(screen.getByRole("button", { name: "Back to Train" })).toBeOnTheScreen();
    });

    it("should name Back for the Train home when the session did not load", async () => {
      seedGoldenPull();
      sessionDetailBackend.failing = true;
      await renderDetail({ origin: "train" });

      await screen.findByRole("alert");
      expect(screen.getByRole("button", { name: "Back to Train" })).toBeOnTheScreen();
    });
  });

  describe("a session that follows no routine day", () => {
    it("should be called Session, with the time and sets cards and no plan card", async () => {
      sessionDetailBackend.sessions = [freeSession(GOLDEN_PULL_ID)];
      await renderDetail();

      expect(await screen.findByRole("heading", { name: "Session" })).toBeOnTheScreen();
      expect(screen.getByText("Time")).toBeOnTheScreen();
      expect(screen.getByText("Sets")).toBeOnTheScreen();
      expect(screen.queryByText("Plan")).toBeNull();
    });
  });

  describe("a session whose routine day is no longer in the active routine", () => {
    it("should draw the session with no plan card, and not wait for the plan", async () => {
      sessionDetailBackend.sessions = [goldenPull];
      trainBackend.routine = null;
      await renderDetail();

      expect(await screen.findByRole("heading", { name: "Pull" })).toBeOnTheScreen();
      expect(screen.queryByText("Plan")).toBeNull();
      expect(screen.queryByText(/more than planned/)).toBeNull();
    });
  });

  describe("a session that is not found", () => {
    it("should say so, with the history as the way back, for an id nothing holds", async () => {
      const onOpenHistory = jest.fn();
      const onBack = jest.fn();
      const user = await renderDetail({ id: UNKNOWN_ID, onBack, onOpenHistory });

      expect(await screen.findByText("Session not found")).toBeOnTheScreen();
      expect(screen.getByText("This session is not in your history.")).toBeOnTheScreen();
      await user.press(screen.getByRole("button", { name: "Open history" }));

      expect(onOpenHistory).toHaveBeenCalledTimes(1);
      expect(onBack).not.toHaveBeenCalled();
    });

    it("should not be an error: no alert, no Try again, and one request only", async () => {
      await renderDetail({ id: UNKNOWN_ID });

      await screen.findByText("Session not found");
      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("button", { name: HISTORY_ERROR.action })).toBeNull();
      expect(sessionDetailBackend.requestedIds).toEqual([UNKNOWN_ID]);
    });

    it("should read an id that is not a UUID the same way, and ask for nothing", async () => {
      await renderDetail({ id: "not-a-uuid" });

      expect(await screen.findByText("Session not found")).toBeOnTheScreen();
      expect(sessionDetailBackend.requestedIds).toEqual([]);
    });

    it("should read a missing id the same way", async () => {
      await renderDetail({ id: undefined });

      expect(await screen.findByText("Session not found")).toBeOnTheScreen();
    });

    it("should still have Back to History in the header", async () => {
      const onBack = jest.fn();
      const user = await renderDetail({ id: UNKNOWN_ID, onBack });

      await user.press(await screen.findByRole("button", { name: "Back to History" }));

      expect(onBack).toHaveBeenCalledTimes(1);
    });
  });

  describe("while it loads", () => {
    it("should say the session is loading and draw no session", async () => {
      seedGoldenPull();
      sessionDetailBackend.hung = true;
      await renderDetail();

      expect(
        await screen.findByRole("status", { name: HISTORY_SESSION_LOADING_NAME }),
      ).toBeOnTheScreen();
      expect(screen.queryByText("Session not found")).toBeNull();
      expect(screen.queryByRole("heading", { name: "Pull" })).toBeNull();
    });
  });

  describe("when the session did not load", () => {
    beforeEach(() => {
      seedGoldenPull();
      sessionDetailBackend.failing = true;
    });

    it("should say so in an alert, not that the session is not found, and read again on Try again", async () => {
      const user = await renderDetail();

      expect(await screen.findByRole("alert")).toBeOnTheScreen();
      expect(screen.getByText(HISTORY_ERROR.title)).toBeOnTheScreen();
      expect(screen.queryByText("Session not found")).toBeNull();

      sessionDetailBackend.failing = false;
      await user.press(screen.getByRole("button", { name: HISTORY_ERROR.action }));

      expect(await screen.findByRole("heading", { name: "Pull" })).toBeOnTheScreen();
    });

    it("should name no exercise, load or muscle in the error", async () => {
      await renderDetail();

      await screen.findByRole("alert");
      expect(screen.queryByText(/Pullups|Pulldown|kg|lats/i)).toBeNull();
    });
  });

  describe("offline", () => {
    it("should open a session the phone has saved, and ask for nothing", async () => {
      seedGoldenPull();
      await renderDetail();
      await screen.findByRole("heading", { name: "Pull" });
      await cleanup();
      sessionDetailBackend.requestedIds = [];
      sessionDetailBackend.sessions = [];

      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderDetail();

      expect(await screen.findByRole("heading", { name: "Pull" })).toBeOnTheScreen();
      expect(screen.getByText("51 min")).toBeOnTheScreen();
      expect(sessionDetailBackend.requestedIds).toEqual([]);
    });

    it("should say the session did not load, and offer no Try again, when nothing was saved", async () => {
      seedGoldenPull();
      await act(() => {
        onlineManager.setOnline(false);
      });
      await renderDetail();

      expect(await screen.findByRole("alert")).toBeOnTheScreen();
      expect(screen.queryByRole("button", { name: HISTORY_ERROR.action })).toBeNull();

      await act(() => {
        onlineManager.setOnline(true);
      });
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Pull" })).toBeOnTheScreen();
      });
    });
  });
});
