import {
  BODY_MAP,
  SUGGESTION_ACCEPTED,
  SUGGESTION_FAILED,
  SUGGESTION_NO_GOAL,
  TRAIN_OFFLINE_TITLE,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import {
  act,
  cleanup,
  fireEvent,
  renderHook,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installGoldenSuggestionBackend, suggestionBackend } from "./suggestionBackend";
import {
  LEGS_DAY_ID,
  THURSDAY_1755,
  WEDNESDAY_1200,
  renderWithTrain,
  resetTrainBackend,
  trainBackend,
} from "./support";
import { acceptedRow } from "../../../../packages/api-client/test/support/acceptedSuggestions";
import {
  strengthAnswers,
  trainingGoalsRow,
  vTaperAnswers,
} from "../../../../packages/api-client/test/support/trainingGoals";

import { TrainRoute, TrainScreen } from "@/components/train";
import { useSuggestionNotices } from "@/components/train/SuggestionCard";
import { ToastProvider } from "@/components/ui/Toast";
import { SUGGESTION_DISMISSED_KEY } from "@/lib/suggestionDismissed";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const renderRoute = () =>
  renderWithTrain(
    <ToastProvider>
      <TrainRoute />
    </ToastProvider>,
  );

const suggestionRegion = () => screen.findByRole("region", { name: "Suggestion for Thursday" });
const acceptedRegion = () => screen.findByRole("region", { name: "Thursday" });
const addButton = () => screen.findByRole("button", { name: "Add to Thursday" });

/** Waits for the card's reads to be answered and the page to have drawn, for a test that expects no card. */
async function afterTheCardWouldHaveShown() {
  await screen.findByRole("region", { name: "Today" });
  await waitFor(() => {
    expect(suggestionBackend.reads).toContain("library");
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
  });
}

describe("the suggestion card on the Train page, on the golden Wednesday at 12:00", () => {
  beforeEach(() => {
    resetTrainBackend();
    installGoldenSuggestionBackend();
    router.push.mockReset();
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WEDNESDAY_1200);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("the offer", () => {
    it("should offer Thursday's Legs with the incline dumbbell press added, and the reasons why", async () => {
      renderRoute();

      const card = await suggestionRegion();

      expect(within(card).getByText("Suggested for Thursday")).toBeTruthy();
      expect(
        within(card).getByText(
          "Add 3 sets of incline dumbbell press to the end of Thursday's Legs.",
        ),
      ).toBeTruthy();
      const reasons = within(card).getByRole("list", {
        name: "Why Ki-Lo suggests this for Thursday",
      });
      expect(within(reasons).getAllByRole("listitem")).toHaveLength(3);
      expect(within(card).getByRole("button", { name: "Add to Thursday" })).toBeTruthy();
      expect(
        within(card).getByRole("button", { name: "Not now for Thursday's suggestion" }),
      ).toBeTruthy();
    });

    it("should sit under the Today card and above This week and the body map, as the board composes the page", async () => {
      renderRoute();

      const card = await suggestionRegion();
      const today = screen.getByRole("region", { name: "Today" });
      const week = screen.getByRole("region", { name: "This week" });
      const bodyMap = screen.getByRole("region", { name: BODY_MAP.title });

      expect(today.compareDocumentPosition(card) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(card.compareDocumentPosition(week) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(card.compareDocumentPosition(bodyMap) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should draw no link to the detail, since the card is not pressable yet", async () => {
      renderRoute();

      const card = await suggestionRegion();

      expect(within(card).queryByRole("link")).toBeNull();
    });
  });

  describe("Add", () => {
    it("should store the suggestion for Thursday's Legs and show the accepted card", async () => {
      renderRoute();

      await userEvent.click(await addButton());

      const accepted = await acceptedRegion();
      expect(
        within(accepted).getByText(
          "Now with 3 sets of incline dumbbell press. They count as planned.",
        ),
      ).toBeTruthy();
      expect(suggestionBackend.inserted).toHaveLength(1);
      expect(suggestionBackend.inserted[0]).toMatchObject({
        local_date: "2026-10-15",
        routine_day_id: LEGS_DAY_ID,
      });
      expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
    });

    it("should show the toast with Undo", async () => {
      renderRoute();

      await userEvent.click(await addButton());

      expect(
        await screen.findByRole("button", { name: SUGGESTION_ACCEPTED.undoAction }),
      ).toBeTruthy();
      expect(screen.getByText(/^Added to Thursday/)).toBeTruthy();
    });

    it("should send one row for a double press of Add", async () => {
      renderRoute();
      const add = await addButton();

      fireEvent.click(add);
      fireEvent.click(add);

      await acceptedRegion();
      expect(suggestionBackend.inserted).toHaveLength(1);
    });

    it("should keep the offer and say it was not saved, with core's words, when the write fails", async () => {
      suggestionBackend.failingWrites = true;
      renderRoute();

      await userEvent.click(await addButton());

      const message = await screen.findByText(SUGGESTION_FAILED.acceptFailed);
      // The toast's tone colours its icon only, so the danger tone is read off the icon's class.
      const icon = message.closest('[role="status"]')?.querySelector("svg");
      expect(icon?.getAttribute("class")).toContain("stroke-danger");
      expect(await addButton()).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Thursday" })).toBeNull();
    });
  });

  describe("a page given no notices", () => {
    it("should make no suggestion reads and draw no card, since Add could not tell anyone", async () => {
      renderWithTrain(<TrainScreen />);

      await screen.findByRole("region", { name: "Today" });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(suggestionBackend.reads).not.toContain("library");
      expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
    });
  });

  describe("Undo", () => {
    it("should take the suggestion off Thursday and offer it again", async () => {
      renderRoute();
      await userEvent.click(await addButton());

      await userEvent.click(
        await screen.findByRole("button", { name: SUGGESTION_ACCEPTED.undoAction }),
      );

      expect(await addButton()).toBeTruthy();
      expect(suggestionBackend.accepted.filter((row) => row["deleted_at"] === null)).toHaveLength(
        0,
      );
    });

    it("should say it could not undo, with core's words, when the write fails", async () => {
      renderRoute();
      await userEvent.click(await addButton());
      suggestionBackend.failingWrites = true;

      await userEvent.click(
        await screen.findByRole("button", { name: SUGGESTION_ACCEPTED.undoAction }),
      );

      expect(await screen.findByText(SUGGESTION_FAILED.undoFailed)).toBeTruthy();
      expect(await acceptedRegion()).toBeTruthy();
    });
  });

  describe("from the keyboard, where the Add button goes when the card changes", () => {
    it("should take focus to Undo, and give it back to the Add button when Undo is pressed", async () => {
      renderRoute();
      const add = await addButton();
      add.focus();

      await userEvent.keyboard("{Enter}");
      const undo = await screen.findByRole("button", { name: SUGGESTION_ACCEPTED.undoAction });
      await waitFor(() => {
        expect(document.activeElement).toBe(undo);
      });
      await userEvent.keyboard("{Enter}");

      const addAgain = await addButton();
      await waitFor(() => {
        expect(document.activeElement).toBe(addAgain);
      });
    });

    it("should leave focus on the accepted card, not the page, when the toast is dismissed", async () => {
      renderRoute();
      const add = await addButton();
      add.focus();

      await userEvent.keyboard("{Enter}");
      await screen.findByRole("button", { name: SUGGESTION_ACCEPTED.undoAction });
      await userEvent.keyboard("{Escape}");

      const accepted = await acceptedRegion();
      await waitFor(() => {
        expect(document.activeElement).toBe(accepted);
      });
    });

    it("should leave focus where it was for a press with the pointer", async () => {
      renderRoute();

      await userEvent.click(await addButton());
      await screen.findByRole("button", { name: SUGGESTION_ACCEPTED.undoAction });

      expect(document.activeElement).not.toBe(
        screen.getByRole("button", { name: SUGGESTION_ACCEPTED.undoAction }),
      );
    });

    it("should move focus on from Not now to the next control before the card goes", async () => {
      renderRoute();
      const dismiss = await screen.findByRole("button", {
        name: "Not now for Thursday's suggestion",
      });
      dismiss.focus();

      await userEvent.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      });
      expect(document.activeElement).not.toBe(document.body);
    });
  });

  describe("Not now", () => {
    it("should hide the card for the day and keep it hidden on the next visit to the page", async () => {
      renderRoute();

      await userEvent.click(
        await screen.findByRole("button", { name: "Not now for Thursday's suggestion" }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      });
      cleanup();
      renderRoute();
      await afterTheCardWouldHaveShown();
      expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
    });

    it("should show the card again on another day", async () => {
      window.localStorage.setItem(SUGGESTION_DISMISSED_KEY, "2026-10-14");
      renderRoute();

      expect(await suggestionRegion()).toBeTruthy();
    });

    it("should show the card when what is stored is not a list of days", async () => {
      window.localStorage.setItem(SUGGESTION_DISMISSED_KEY, "not a day");
      renderRoute();

      expect(await suggestionRegion()).toBeTruthy();
    });

    it("should show nothing for a day that was put off in an earlier visit", async () => {
      window.localStorage.setItem(SUGGESTION_DISMISSED_KEY, "2026-10-15");
      renderRoute();

      await afterTheCardWouldHaveShown();
      expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
    });
  });

  describe("the accepted card", () => {
    it("should show at once when Thursday already holds an accepted suggestion, worded from the stored row", async () => {
      suggestionBackend.goal = trainingGoalsRow(strengthAnswers);
      suggestionBackend.accepted = [acceptedRow()];
      renderRoute();

      const accepted = await acceptedRegion();

      expect(within(accepted).getByText("Thursday's Legs: 19 sets")).toBeTruthy();
      expect(
        within(accepted).getByText(
          "Now with 3 sets of incline dumbbell press. They count as planned.",
        ),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Add to Thursday" })).toBeNull();
    });

    it("should show nothing while the accepted suggestions are being read, so Add cannot be pressed on a day that holds one", async () => {
      suggestionBackend.accepted = [acceptedRow()];
      suggestionBackend.hangingAcceptedReads = true;
      renderRoute();

      await afterTheCardWouldHaveShown();

      expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Add to Thursday" })).toBeNull();
    });

    it("should show nothing when the accepted suggestions could not be read", async () => {
      suggestionBackend.failingAcceptedReads = true;
      renderRoute();

      await afterTheCardWouldHaveShown();

      expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Add to Thursday" })).toBeNull();
    });
  });

  describe("offline", () => {
    it("should show nothing, since adding needs a connection", async () => {
      act(() => {
        onlineManager.setOnline(false);
      });
      renderRoute();

      await screen.findByText(TRAIN_OFFLINE_TITLE);
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      expect(screen.queryByRole("button", { name: "Add to Thursday" })).toBeNull();
    });

    it("should take the offer away when the connection goes", async () => {
      renderRoute();
      await suggestionRegion();

      act(() => {
        onlineManager.setOnline(false);
      });

      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      });
    });
  });

  describe("with a week that is already covered", () => {
    it("should say there is nothing to add for Thursday", async () => {
      suggestionBackend.goal = trainingGoalsRow(vTaperAnswers, {
        muscle_priority: Object.fromEntries(
          Object.keys(trainingGoalsRow(vTaperAnswers).muscle_priority).map((muscle) => [muscle, 0]),
        ),
      });
      renderRoute();

      const card = await suggestionRegion();

      expect(within(card).getByText("Nothing to add for Thursday")).toBeTruthy();
      expect(within(card).queryByRole("button")).toBeNull();
    });
  });

  describe("with no goal", () => {
    it("should offer the questionnaire, and Set your goal opens its first question", async () => {
      suggestionBackend.goal = null;
      renderRoute();

      const card = await screen.findByRole("region", { name: SUGGESTION_NO_GOAL.sectionName });
      await userEvent.click(within(card).getByRole("button", { name: SUGGESTION_NO_GOAL.action }));

      expect(router.push).toHaveBeenCalledWith("/goal/1");
    });
  });
});

describe("the suggestion card on the Train page, on Thursday before Legs", () => {
  beforeEach(() => {
    resetTrainBackend();
    installGoldenSuggestionBackend();
    // Thursday's session is the one still to come.
    trainBackend.weekSessions = trainBackend.weekSessions.filter(
      (session) => session["local_date"] !== "2026-10-15",
    );
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1755);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should offer the suggestion for today with no Add to press, since Start is another ticket's", async () => {
    renderRoute();

    const card = await screen.findByRole("region", { name: "Suggestion for today" });

    expect(within(card).getByText("Suggested for today")).toBeTruthy();
    expect(within(card).queryByRole("button", { name: /^Add to/ })).toBeNull();
    expect(within(card).queryByRole("button", { name: /^Start/ })).toBeNull();
    expect(within(card).getByRole("button", { name: /^Not now/ })).toBeTruthy();
  });
});

describe("the suggestion card's notices", () => {
  it("should start a suggestion for today through the page's own Start, not a second one", () => {
    const start = vi.fn();
    const { result } = renderHook(() => useSuggestionNotices(start), {
      wrapper: ToastProvider,
    });

    result.current.notices.onStart({ routineDayId: LEGS_DAY_ID, timeZone: "Europe/London" });

    expect(start).toHaveBeenCalledExactlyOnceWith({
      routineDayId: LEGS_DAY_ID,
      timeZone: "Europe/London",
    });
  });
});
