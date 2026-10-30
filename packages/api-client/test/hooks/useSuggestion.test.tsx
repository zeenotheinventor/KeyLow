import {
  SUGGEST_PARAMS_V2,
  TRAINING_PARAMS_V2,
  muscleState,
  suggestSession,
} from "@keylow/core/training";
import { dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSuggestion } from "../../src/hooks/useSuggestion";
import { KeyLowProvider } from "../../src/KeyLowProvider";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import { FULL_GYM, goldenIdOf, goldenLibraryRows } from "../support/goldenLibraryRows";
import { goldenWeekData } from "../support/goldenWeekRows";
import { createQueryClient } from "../support/queryClients";
import {
  RECOGNISABLE_LIBRARY_NAME,
  installLibraryFake,
  libraryRow,
} from "../support/suggestionLibrary";
import { installTrainingFake } from "../support/training";
import { trainingGoalsRow, vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

import type { ActiveRoutine, TrainingSet } from "../../src";
import type { TrainingGoalsRow } from "@keylow/core/schemas";
import type { ReactNode } from "react";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

// Wednesday 14 October 2026, 12:00 in London (BST): the moment the golden suggestions are worked out at.
const WEDNESDAY_NOON = "2026-10-14T12:00:00+01:00";
const THURSDAY_EVENING = "2026-10-15T18:00:00+01:00";
const THURSDAY = "2026-10-15";
const FRIDAY = "2026-10-16";
const WEDNESDAY_START_DAY = "2026-09-29";

const fullGymGoal = (overrides: Record<string, unknown> = {}) =>
  trainingGoalsRow({ ...vTaperAnswers, equipment: FULL_GYM }, overrides);

const everyPriorityZero = Object.fromEntries(
  Object.keys(fullGymGoal().muscle_priority).map((muscle) => [muscle, 0]),
);

const roundedTo = (value: number, decimals: number): number =>
  Math.round(value * 10 ** decimals) / 10 ** decimals;

/** Serves the golden week, the golden library and a goal. */
const serve = ({
  goal = fullGymGoal(),
  routine = goldenWeekData.routine,
  library = goldenLibraryRows,
}: { goal?: unknown; routine?: unknown; library?: readonly { equipment: unknown }[] } = {}) => ({
  training: installTrainingFake(server, { ...goldenWeekData, routine, goal }),
  libraryFake: installLibraryFake(server, library),
});

describe("useSuggestion", () => {
  describe("the golden week, the V-taper goal and Wednesday 12:00", () => {
    it("should give the agreed plan-adjusted suggestion for Thursday: the Legs kept and 3 sets of incline dumbbell press added", async () => {
      serve();
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      const read = result.current.data;
      expect(read?.unavailable).toBeNull();
      expect(read?.kind).toBe("plan_adjusted");
      const suggestion = read?.suggestion;
      if (suggestion?.kind !== "plan_adjusted") {
        throw new Error("Expected a plan adjusted suggestion");
      }
      expect(suggestion.exercises.slice(0, 5).map((each) => each.origin)).toEqual([
        "plan",
        "plan",
        "plan",
        "plan",
        "plan",
      ]);
      expect(suggestion.exercises).toHaveLength(6);
      expect(suggestion.added).toBe(1);
      expect(suggestion.exercises[5]).toMatchObject({
        origin: "added",
        exercise_id: goldenIdOf("Incline Dumbbell Press"),
        sets: 3,
        rep_min: 8,
        rep_max: 10,
        target_rir: 2,
      });
      expect(suggestion.sets).toBe(19);
      expect(suggestion.minutes).toBe(60);
      expect(suggestion.planned).toStrictEqual({ sets: 16, minutes: 50 });
      const added = suggestion.exercises[5];
      if (added?.origin !== "added") {
        throw new Error("Expected the added exercise");
      }
      expect(added.reasons).toHaveLength(1);
      expect(added.reasons[0]).toMatchObject({
        muscle_id: "chest_upper",
        priority: 3,
        mav_low: 10,
      });
      expect(roundedTo(added.reasons[0]?.weekly_sets ?? 0, 2)).toBe(4.8);
      expect(roundedTo(added.reasons[0]?.heat ?? 0, 4)).toBe(0.13);
      expect(roundedTo(added.reasons[0]?.score ?? 0, 2)).toBe(13.57);
      expect(
        suggestion.skipped.map((each) => ({ ...each, heat: roundedTo(each.heat, 4) })),
      ).toStrictEqual([{ muscle_id: "biceps", heat: 0.5118 }]);
    });

    it("should give what core gives for the same rows, goal and library", async () => {
      serve();
      const { queryClient, wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      const rows = queryClient.getQueryData<TrainingSet[]>(keys.training.sets(WEDNESDAY_START_DAY));
      const routine = queryClient.getQueryData<ActiveRoutine | null>(keys.training.activeRoutine);
      const goal = queryClient.getQueryData<TrainingGoalsRow | null>(keys.training.goals);
      const library = queryClient.getQueryData(
        keys.training.suggestionLibrary([...FULL_GYM].sort().join(",")),
      );
      const legs = routine?.days.find((day) => day.weekday === 3);
      if (!rows || !goal || !Array.isArray(library) || !legs) {
        throw new Error(
          "Expected the rows, the goal, the library and Thursday's Legs in the cache",
        );
      }
      expect(result.current.data?.suggestion).toEqual(
        suggestSession(
          muscleState(rows, WEDNESDAY_NOON, TRAINING_PARAMS_V2),
          goal,
          library,
          { plannedDay: legs },
          SUGGEST_PARAMS_V2,
        ),
      );
    });

    it("should give a fresh session for a day the routine has nothing on", async () => {
      serve();
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: FRIDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.kind).toBe("session");
      expect(result.current.data?.suggestion?.kind).toBe("session");
      expect(result.current.data?.unavailable).toBeNull();
    });

    it("should give a fresh session when the user has no active routine", async () => {
      serve({ routine: null });
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.kind).toBe("session");
    });

    it("should give a fresh session for a day before the routine was made active", async () => {
      serve({ routine: { ...goldenWeekData.routine, activated_at: "2026-10-14T09:00:00Z" } });
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useSuggestion({ day: "2026-10-08", now: WEDNESDAY_NOON }),
        {
          wrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.kind).toBe("session");
    });

    it("should give nothing when the week covers the priorities", async () => {
      serve({ goal: fullGymGoal({ muscle_priority: everyPriorityZero }) });
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data?.kind).toBe("nothing");
      expect(result.current.data?.suggestion).toMatchObject({
        kind: "nothing",
        why: "priorities_covered",
      });
      expect(result.current.data?.unavailable).toBeNull();
    });
  });

  describe("with no goal", () => {
    it("should say no_goal, give no suggestion, and never read the library", async () => {
      const { libraryFake } = serve({ goal: null });
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data).toEqual({ kind: null, suggestion: null, unavailable: "no_goal" });
      expect(libraryFake.reads).toEqual([]);
    });
  });

  describe("equipment", () => {
    const mixedLibrary = [
      libraryRow({
        name: "Dumbbell fly",
        equipment: "dumbbell",
        mechanic: "isolation",
        exercise_muscles: [{ muscle_id: "chest_upper", role: "primary", weight: 1 }],
      }),
      libraryRow({
        name: "Barbell bench",
        equipment: "barbell",
        mechanic: "compound",
        exercise_muscles: [{ muscle_id: "chest_upper", role: "primary", weight: 1 }],
      }),
    ];
    const dumbbellGoal = () => trainingGoalsRow({ ...vTaperAnswers, equipment: ["dumbbell"] });

    it("should ask for the library of the user's equipment only, and never give a barbell exercise", async () => {
      const { libraryFake } = serve({ goal: dumbbellGoal(), routine: null, library: mixedLibrary });
      const { queryClient, wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(libraryFake.reads[0]?.searchParams.get("equipment")).toBe("in.(dumbbell)");
      const suggested = JSON.stringify(result.current.data?.suggestion);
      expect(suggested).toContain(mixedLibrary[0]?.id);
      expect(suggested).not.toContain(mixedLibrary[1]?.id);
      expect(queryClient.getQueryData(keys.training.suggestionLibrary("dumbbell"))).toHaveLength(1);
    });

    it("should read the library once for the same equipment however it is ordered in the goal", async () => {
      const { libraryFake } = serve({
        goal: trainingGoalsRow({ ...vTaperAnswers, equipment: ["dumbbell", "barbell"] }),
        routine: null,
        library: mixedLibrary,
      });
      const { queryClient, wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      const readLibraries = queryClient
        .getQueryCache()
        .findAll({ queryKey: keys.training.suggestionLibraryAll })
        .filter((query) => query.state.data !== undefined);
      expect(readLibraries.map((query) => query.queryKey)).toEqual([
        keys.training.suggestionLibrary("barbell,dumbbell"),
      ]);
      expect(libraryFake.reads).toHaveLength(1);
    });
  });

  describe("while it waits", () => {
    it("should be pending, with no suggestion, until the library is read", async () => {
      const { libraryFake } = serve();
      libraryFake.hold();
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(libraryFake.reads).toHaveLength(1);
      });
      expect(result.current).toMatchObject({ data: undefined, isPending: true, isError: false });
      libraryFake.release();
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
    });

    it("should make no request at all when it is not enabled", async () => {
      const { training, libraryFake } = serve();
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON, enabled: false }),
        { wrapper },
      );

      await new Promise((resolve) => setTimeout(resolve, 50));
      expect(result.current.data).toBeUndefined();
      expect(training.requests).toEqual([]);
      expect(libraryFake.reads).toEqual([]);
    });
  });

  describe("when the library cannot be read", () => {
    it("should report an error that names the action and the code only", async () => {
      const { libraryFake } = serve();
      libraryFake.failReadsWith("42501");
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.data).toBeUndefined();
      expect(result.current.error?.message).toBe("Could not load the exercise library (42501)");
      expect(JSON.stringify([result.current.error, result.current.error?.cause])).not.toContain(
        RECOGNISABLE_LIBRARY_NAME,
      );
    });

    it("should read it again, and only it, on refetch", async () => {
      const { training, libraryFake } = serve();
      libraryFake.failReadsWith("42501");
      const { wrapper } = createWrapper();
      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      const trainingRequests = training.requests.length;
      libraryFake.failReadsWith(null);

      await result.current.refetch();

      await waitFor(() => {
        expect(result.current.data?.kind).toBe("plan_adjusted");
      });
      expect(libraryFake.reads).toHaveLength(2);
      expect(training.requests).toHaveLength(trainingRequests);
    });
  });

  describe("for a day that is not a calendar day", () => {
    it("should fail with a RangeError that does not quote the day", async () => {
      serve();
      const { wrapper } = createWrapper();

      const { result } = renderHook(
        () => useSuggestion({ day: "thursday-ish", now: WEDNESDAY_NOON }),
        {
          wrapper,
        },
      );

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error).toBeInstanceOf(RangeError);
      expect(result.current.error?.message).not.toContain("thursday-ish");
    });
  });

  describe("at a later now", () => {
    it("should work the suggestion out again at the new now without reading the library again", async () => {
      const { libraryFake } = serve();
      const { wrapper } = createWrapper();
      const { result, rerender } = renderHook(({ now }) => useSuggestion({ day: THURSDAY, now }), {
        wrapper,
        initialProps: { now: WEDNESDAY_NOON },
      });
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      const earlier = result.current.data;

      rerender({ now: THURSDAY_EVENING });

      await waitFor(() => {
        expect(result.current.data).not.toEqual(earlier);
      });
      expect(result.current.data?.kind).toBe("plan_adjusted");
      expect(libraryFake.reads).toHaveLength(1);
    });
  });

  describe("in a cache restored on a phone with no connection", () => {
    // What a persister does to a cache: it goes to storage as text and comes back as the same plain data.
    const throughStorage = <Value,>(value: Value): Value =>
      // A cache holds plain JSON data only, which the text form keeps exactly.
      JSON.parse(JSON.stringify(value)) as Value;

    const LIBRARY_KEY = keys.training.suggestionLibrary([...FULL_GYM].sort().join(","));

    /** Opens the app online once and returns what a persister keeps (the library never among it). */
    const openOnline = async () => {
      const fakes = serve();
      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      return {
        ...fakes,
        earlier: result.current.data,
        library: queryClient.getQueryData(LIBRARY_KEY),
        rows: queryClient.getQueryData<TrainingSet[]>(keys.training.sets(WEDNESDAY_START_DAY)),
        routine: queryClient.getQueryData<ActiveRoutine | null>(keys.training.activeRoutine),
        goal: queryClient.getQueryData<TrainingGoalsRow | null>(keys.training.goals),
        stored: throughStorage(
          dehydrate(queryClient, {
            shouldDehydrateQuery: (query) =>
              query.state.status === "success" &&
              query.queryKey[1] !== keys.training.suggestionLibraryAll[1],
          }),
        ),
      };
    };

    /** A new session of the app: a new query client restored from storage, and no connection. */
    const restoreOffline = (
      opened: Awaited<ReturnType<typeof openOnline>>,
      { libraryInClient }: { libraryInClient: boolean },
    ) => {
      const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
      hydrate(restored, opened.stored);
      if (libraryInClient) {
        restored.setQueryData(LIBRARY_KEY, opened.library);
      }
      opened.training.goOffline();
      opened.libraryFake.goOffline();
      onlineManager.setOnline(false);
      const wrapper = ({ children }: { children: ReactNode }) => (
        <KeyLowProvider client={createTestClient()} queryClient={restored}>
          {children}
        </KeyLowProvider>
      );
      return wrapper;
    };

    it("should not keep the library in what the persister stores", async () => {
      const opened = await openOnline();

      expect(opened.library).toBeDefined();
      expect(opened.stored.queries.map(({ queryKey }) => queryKey[1])).not.toContain(
        keys.training.suggestionLibraryAll[1],
      );
    });

    it("should work the suggestion out again at the later now from the restored rows, with the library already in the client", async () => {
      const opened = await openOnline();
      const wrapper = restoreOffline(opened, { libraryInClient: true });
      const requestsBefore = opened.training.requests.length + opened.libraryFake.reads.length;

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: THURSDAY_EVENING }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      const legs = opened.routine?.days.find((day) => day.weekday === 3);
      if (!opened.rows || !opened.goal || !Array.isArray(opened.library) || !legs) {
        throw new Error("Expected the rows, the goal, the library and Thursday's Legs");
      }
      // Core, called directly on the rows that were stored (read back from storage), at the later moment.
      const expected = suggestSession(
        muscleState(throughStorage(opened.rows), THURSDAY_EVENING, TRAINING_PARAMS_V2),
        throughStorage(opened.goal),
        throughStorage(opened.library),
        { plannedDay: throughStorage(legs) },
        SUGGEST_PARAMS_V2,
      );
      expect(result.current.data?.suggestion).toEqual(expected);
      expect(result.current.data?.suggestion).not.toEqual(opened.earlier?.suggestion);
      expect(opened.training.requests.length + opened.libraryFake.reads.length).toBe(
        requestsBefore,
      );
    });

    it("should say no_library, and give no card, when the library has not been read in the session", async () => {
      const opened = await openOnline();
      const wrapper = restoreOffline(opened, { libraryInClient: false });

      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: THURSDAY_EVENING }), {
        wrapper,
      });

      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });
      expect(result.current.data).toEqual({
        kind: null,
        suggestion: null,
        unavailable: "no_library",
      });
    });
  });

  describe("what the cache holds", () => {
    it("should keep no exercise name, priority, heat or time in any key", async () => {
      serve();
      const { queryClient, wrapper } = createWrapper();
      const { result } = renderHook(() => useSuggestion({ day: THURSDAY, now: WEDNESDAY_NOON }), {
        wrapper,
      });
      await waitFor(() => {
        expect(result.current.data).toBeDefined();
      });

      const queryKeys = queryClient
        .getQueryCache()
        .getAll()
        .map((query) => query.queryKey);

      expect(queryKeys).toContainEqual(
        keys.training.suggestionLibrary([...FULL_GYM].sort().join(",")),
      );
      const text = JSON.stringify(queryKeys);
      for (const exercise of goldenLibraryRows) {
        expect(text).not.toContain(exercise.name);
      }
      expect(text).not.toContain(WEDNESDAY_NOON);
      expect(text).not.toContain("heat");
      expect(text).not.toContain("priority");
    });
  });
});
