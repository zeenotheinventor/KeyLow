import { KeyLowProvider, keys } from "@keylow/api-client";
import { QueryClient, useQuery } from "@tanstack/react-query";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FIRST_ACTION_ID } from "../../../mobile/test/support/assistantCardFixtures";
import {
  resetUndoBackend,
  undoBackend,
  undoClient,
} from "../../../mobile/test/support/assistantUndoBackend";

import type { AssistantCard } from "@keylow/core";

import { AssistantProvider } from "@/components/assistant";
import { CardEntry } from "@/components/assistant/CardEntry";

const { push } = vi.hoisted(() => ({ push: vi.fn<(href: string) => void>() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/lib/foodLogActions", () => ({
  useFoodLogActions: () => ({ openAddFood: vi.fn(), viewedDate: "2026-10-25" }),
}));

const ROUTINE_ID = "00000000-0000-4000-8000-0000000000e2";
const SESSION_ID = "00000000-0000-4000-8000-0000000000e3";

const mondayName = "Monday · Push, 5 exercises · 15 sets · about 50 min";
const wednesdayName = "Wednesday · Pull, 5 exercises · 15 sets · about 50 min";

const routineCreatedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "routine_created",
  title: "Built routine Push Pull Legs, 3 days",
  sub: "From your goal: look better, intermediate",
  rows: [],
  days: [
    {
      name: "Monday · Push",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [
        { name: "Barbell bench press", detail: "3 sets · 6 to 10 reps · RIR 2" },
        { name: "Overhead press", detail: "3 sets · 6 to 10 reps · RIR 2" },
      ],
    },
    {
      name: "Wednesday · Pull",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [{ name: "Barbell row", detail: "3 sets · 6 to 10 reps · RIR 2" }],
    },
    {
      name: "Friday · Legs",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [{ name: "Barbell squat", detail: "3 sets · 6 to 10 reps · RIR 2" }],
    },
  ],
  totalText: "The week: 45 sets · 3 days",
  note: "This is not your active routine. Ask to make it active, or do it in Routines.",
  link: {
    label: "Open in routine editor",
    target: { screen: "routine_editor", routineId: ROUTINE_ID },
  },
  undo: "available",
  undoneSub: "Archived Push Pull Legs",
};

const setUpdatedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "set_updated",
  title: "Changed a set in Legs",
  sub: "Thursday 8 October",
  rows: [],
  totalText: null,
  note: null,
  link: { label: "Open the session", target: { screen: "session_detail", sessionId: SESSION_ID } },
  undo: "available",
  undoneSub: "Put the set back as it was",
};

const workoutDeletedCard: AssistantCard = {
  actionIds: [FIRST_ACTION_ID],
  kind: "workout_deleted",
  title: "Deleted workout Legs",
  sub: "Thursday 8 October · 16 sets",
  rows: [],
  totalText: null,
  note: null,
  link: null,
  undo: "available",
  undoneSub: "Put your Legs workout back",
};

let trainReads = 0;

// The Train page beside the panel: a read under the training keys, as its screens make.
function TrainBesidePanel() {
  const train = useQuery({
    queryKey: [...keys.training.all, "history", "probe"],
    queryFn: () => {
      trainReads += 1;
      return Promise.resolve(trainReads);
    },
  });
  return <p>{`Train read ${train.data ?? 0}`}</p>;
}

async function showCard(
  card: AssistantCard,
  { workoutInProgress = false, seedActiveSession = true } = {},
) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity }, mutations: { retry: false } },
  });
  // The read of the workout in progress answers from the cache, so a test sets it by seeding it.
  if (seedActiveSession) {
    queryClient.setQueryData(keys.training.activeSession, workoutInProgress ? { id: "s1" } : null);
  }
  const user = userEvent.setup();
  render(
    <KeyLowProvider client={undoClient} queryClient={queryClient}>
      <AssistantProvider>
        <TrainBesidePanel />
        <CardEntry entry={{ kind: "card", key: "card:1", card }} />
      </AssistantProvider>
    </KeyLowProvider>,
  );
  await screen.findByText("Train read 1");
  return { user, queryClient };
}

describe("the training cards in the assistant thread", () => {
  beforeEach(() => {
    resetUndoBackend();
    push.mockReset();
    trainReads = 0;
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(min-width: 1024px)",
      media: query,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    }));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  describe("the days of a routine", () => {
    it("should draw every day closed, each as a button named by its day and summary", async () => {
      await showCard(routineCreatedCard);

      for (const name of [mondayName, wednesdayName]) {
        expect(screen.getByRole("button", { name }).getAttribute("aria-expanded")).toBe("false");
      }
      expect(
        screen.getByRole("button", {
          name: "Friday · Legs, 5 exercises · 15 sets · about 50 min",
        }),
      ).toBeTruthy();
      expect(screen.queryByText("Barbell bench press")).toBeNull();
      expect(screen.getByText("The week: 45 sets · 3 days")).toBeTruthy();
    });

    it("should open a day to its exercises and close it again", async () => {
      const { user } = await showCard(routineCreatedCard);

      await user.click(screen.getByRole("button", { name: mondayName }));

      expect(screen.getByRole("button", { name: mondayName }).getAttribute("aria-expanded")).toBe(
        "true",
      );
      expect(screen.getByText("Barbell bench press")).toBeTruthy();
      expect(screen.getAllByText("3 sets · 6 to 10 reps · RIR 2").length).toBeGreaterThan(0);

      await user.click(screen.getByRole("button", { name: mondayName }));

      expect(screen.getByRole("button", { name: mondayName }).getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(screen.queryByText("Barbell bench press")).toBeNull();
    });

    it("should keep one day open at a time", async () => {
      const { user } = await showCard(routineCreatedCard);

      await user.click(screen.getByRole("button", { name: mondayName }));
      await user.click(screen.getByRole("button", { name: wednesdayName }));

      expect(screen.getByRole("button", { name: mondayName }).getAttribute("aria-expanded")).toBe(
        "false",
      );
      expect(
        screen.getByRole("button", { name: wednesdayName }).getAttribute("aria-expanded"),
      ).toBe("true");
      expect(screen.queryByText("Barbell bench press")).toBeNull();
      expect(screen.getByText("Barbell row")).toBeTruthy();
    });

    it("should open a day from the keyboard", async () => {
      const { user } = await showCard(routineCreatedCard);

      screen.getByRole("button", { name: mondayName }).focus();
      await user.keyboard("{Enter}");

      expect(screen.getByText("Barbell bench press")).toBeTruthy();
    });

    it("should point the open day's button at the exercises it shows", async () => {
      const { user } = await showCard(routineCreatedCard);
      const monday = screen.getByRole("button", { name: mondayName });
      expect(monday.getAttribute("aria-controls")).toBeNull();

      await user.click(monday);

      const exercisesId = monday.getAttribute("aria-controls");
      expect(exercisesId).toBeTruthy();
      expect(document.getElementById(exercisesId ?? "")?.textContent).toContain(
        "Barbell bench press",
      );
    });

    it("should draw a card with no days as it did before", async () => {
      await showCard(setUpdatedCard);

      expect(screen.queryByRole("button", { name: /exercises/ })).toBeNull();
    });
  });

  describe("the links", () => {
    it("should open the routine editor from a routine card", async () => {
      const { user } = await showCard(routineCreatedCard);

      await user.click(screen.getByRole("button", { name: "Open in routine editor" }));

      expect(push).toHaveBeenCalledWith(`/train/routines/${ROUTINE_ID}`);
    });

    it("should open the session from a set card", async () => {
      const { user } = await showCard(setUpdatedCard);

      await user.click(screen.getByRole("button", { name: "Open the session" }));

      expect(push).toHaveBeenCalledWith(`/train/history/${SESSION_ID}`);
    });

    it("should draw a workout deleted card with no link", async () => {
      await showCard(workoutDeletedCard);

      expect(screen.getByRole("group", { name: "Deleted workout Legs" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: /^Open/ })).toBeNull();
    });
  });

  describe("Undo", () => {
    it("should put a routine back and read the Train page beside the panel again", async () => {
      const { user } = await showCard(routineCreatedCard);

      await user.click(screen.getByRole("button", { name: "Undo" }));

      await screen.findByText("Undone");
      await screen.findByText("Train read 2");
      expect(undoBackend.bodies).toEqual([{ actionIds: [FIRST_ACTION_ID] }]);
      expect(screen.queryByRole("button", { name: mondayName })).toBeNull();
    });

    it("should say Can't undo yet and hold Undo while a workout is in progress", async () => {
      await showCard(setUpdatedCard, { workoutInProgress: true });

      const card = screen.getByRole("group", { name: "Changed a set in Legs" });
      expect(within(card).getByText("Can't undo yet")).toBeTruthy();
      expect(
        within(card).getByText(
          "Your workout is in progress, so Undo waits until it ends. Finish it, then press Undo.",
        ),
      ).toBeTruthy();
      expect(within(card).queryByRole("button", { name: "Undo" })).toBeNull();
    });

    it("should hold Undo on a routine card during a workout and keep its days", async () => {
      await showCard(routineCreatedCard, { workoutInProgress: true });

      expect(screen.getByText("Can't undo yet")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Undo" })).toBeNull();
      expect(screen.getByRole("button", { name: mondayName })).toBeTruthy();
    });

    it("should not read the workout in progress for a card that is not training", async () => {
      const { queryClient } = await showCard(
        { ...setUpdatedCard, kind: "logged" },
        { seedActiveSession: false },
      );

      expect(queryClient.getQueryState(keys.training.activeSession)).toMatchObject({
        fetchStatus: "idle",
        dataUpdateCount: 0,
        errorUpdateCount: 0,
      });
    });

    it("should leave a card that is not training with its Undo during a workout", async () => {
      await showCard({ ...setUpdatedCard, kind: "logged" }, { workoutInProgress: true });

      expect(screen.getByRole("button", { name: "Undo" })).toBeTruthy();
    });
  });
});
