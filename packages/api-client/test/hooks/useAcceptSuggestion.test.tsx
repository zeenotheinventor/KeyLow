import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAcceptSuggestion } from "../../src/hooks/useAcceptSuggestion";
import { useUndoAcceptedSuggestion } from "../../src/hooks/useUndoAcceptedSuggestion";
import { keys } from "../../src/queryKeys";
import {
  INCLINE_DUMBBELL_PRESS_ID,
  LEGS_DAY_ID,
  RECOGNISABLE_SUGGESTION_TEXT,
  THURSDAY,
  acceptedRow,
  goldenSuggestion,
  installAcceptedSuggestionsFake,
} from "../support/acceptedSuggestions";
import { goldenLibraryRows } from "../support/goldenLibraryRows";
import { seedTrainingQueries } from "../support/routines";
import { installLibraryFake } from "../support/suggestionLibrary";
import { installTrainingFake } from "../support/training";
import { trainingGoalsRow, vTaperAnswers } from "../support/trainingGoals";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const WEEK_START = "2026-10-12";

const accept = { suggestion: goldenSuggestion, localDate: THURSDAY, routineDayId: LEGS_DAY_ID };

/** The goal and the library the suggestion was made from, which the hook reads to freeze the muscle map. */
const installReads = () => {
  installTrainingFake(server, { goal: trainingGoalsRow(vTaperAnswers) });
  installLibraryFake(server, goldenLibraryRows);
};

describe("useAcceptSuggestion", () => {
  it("should store the suggestion for the day and resolve to the row as stored", async () => {
    installReads();
    const fake = installAcceptedSuggestionsFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptSuggestion(), { wrapper });

    const stored = await act(() => result.current.mutateAsync(accept));

    expect(fake.inserts).toHaveLength(1);
    expect(fake.inserts[0]?.["exercises"]).toEqual([
      expect.objectContaining({ exercise_id: INCLINE_DUMBBELL_PRESS_ID, target_sets: 3 }),
    ]);
    expect(stored).toMatchObject({
      id: fake.liveRows()[0]?.["id"],
      local_date: THURSDAY,
      routine_day_id: LEGS_DAY_ID,
    });
  });

  it("should mark the accepted suggestions, the week and the heat stale, so the projection is worked out again", async () => {
    installReads();
    installAcceptedSuggestionsFake(server);
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    queryClient.setQueryData(keys.training.acceptedSuggestions(WEEK_START), {
      suggestions: [],
      skipped: [],
    });
    const { result } = renderHook(() => useAcceptSuggestion(), { wrapper });

    await act(() => result.current.mutateAsync(accept));

    expect(seeded.isStale(keys.training.acceptedSuggestions(WEEK_START))).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(false);
  });

  it("should send one request for a double press with the same suggestion, the second joining the first", async () => {
    installReads();
    const fake = installAcceptedSuggestionsFake(server);
    const release = fake.hold();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptSuggestion(), { wrapper });

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.mutateAsync(accept);
      second = result.current.mutateAsync(accept);
    });
    await waitFor(() => {
      expect(fake.updates).toHaveLength(1);
    });
    release();
    const [one, other] = await act(() => Promise.all([first, second]));

    expect(fake.inserts).toHaveLength(1);
    expect(fake.liveRows()).toHaveLength(1);
    expect(other).toEqual(one);
  });

  it("should replace the day's suggestion when a different one is accepted for it, leaving one live row", async () => {
    installReads();
    const fake = installAcceptedSuggestionsFake(server, { rows: [acceptedRow()] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptSuggestion(), { wrapper });

    const stored = await act(() => result.current.mutateAsync(accept));

    expect(fake.liveRows().map((row) => row["id"])).toEqual([stored.id]);
    expect(fake.rows).toHaveLength(2);
  });

  it("should fail with the action and the code only, and still mark the week stale for a fresh read", async () => {
    installReads();
    const fake = installAcceptedSuggestionsFake(server);
    fake.failNextInserts("42501");
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    queryClient.setQueryData(keys.training.acceptedSuggestions(WEEK_START), {
      suggestions: [],
      skipped: [],
    });
    const { result } = renderHook(() => useAcceptSuggestion(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(accept)).rejects.toThrow(
        "Could not accept the suggestion (42501)",
      );
    });

    expect(JSON.stringify(result.current.error)).not.toContain(RECOGNISABLE_SUGGESTION_TEXT);
    expect(seeded.isStale(keys.training.acceptedSuggestions(WEEK_START))).toBe(true);
  });

  it("should refuse a suggestion with nothing to add, before any request to the table", async () => {
    installReads();
    const fake = installAcceptedSuggestionsFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptSuggestion(), { wrapper });

    await act(async () => {
      await expect(
        result.current.mutateAsync({
          ...accept,
          suggestion: { kind: "nothing", why: "priorities_covered", skipped: [], no_room: null },
        }),
      ).rejects.toBeInstanceOf(RangeError);
    });

    expect(fake.inserts).toEqual([]);
    expect(fake.updates).toEqual([]);
  });

  it("should fail with a RangeError that quotes nothing when the user has no goal to read the library for", async () => {
    installTrainingFake(server, { goal: null });
    const fake = installAcceptedSuggestionsFake(server);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptSuggestion(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(accept)).rejects.toBeInstanceOf(RangeError);
    });

    expect(fake.inserts).toEqual([]);
  });
});

describe("useUndoAcceptedSuggestion", () => {
  it("should soft delete the row and mark the accepted suggestions, the week and the heat stale", async () => {
    const accepted = acceptedRow();
    const fake = installAcceptedSuggestionsFake(server, { rows: [accepted] });
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    queryClient.setQueryData(keys.training.acceptedSuggestions(WEEK_START), {
      suggestions: [],
      skipped: [],
    });
    const { result } = renderHook(() => useUndoAcceptedSuggestion(), { wrapper });

    await act(() => result.current.mutateAsync(String(accepted["id"])));

    expect(fake.liveRows()).toEqual([]);
    expect(seeded.isStale(keys.training.acceptedSuggestions(WEEK_START))).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
  });

  it("should wait for an accept in flight, so an Undo tapped meanwhile runs after it", async () => {
    installReads();
    const earlier = acceptedRow({ local_date: "2026-10-17", routine_day_id: null });
    const fake = installAcceptedSuggestionsFake(server, { rows: [earlier] });
    const release = fake.hold();
    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ accept: useAcceptSuggestion(), undo: useUndoAcceptedSuggestion() }),
      { wrapper },
    );

    let accepting: Promise<unknown> = Promise.resolve();
    let undoing: Promise<unknown> = Promise.resolve();
    act(() => {
      accepting = result.current.accept.mutateAsync(accept);
    });
    await waitFor(() => {
      expect(fake.updates).toHaveLength(1);
    });
    act(() => {
      undoing = result.current.undo.mutateAsync(String(earlier["id"]));
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(fake.updates).toHaveLength(1);
    release();
    await act(() => Promise.all([accepting, undoing]));

    expect(fake.updates).toHaveLength(2);
    expect(fake.updates[1]?.url.searchParams.get("id")).toBe(`eq.${String(earlier["id"])}`);
    expect(earlier["deleted_at"]).not.toBeNull();
  });

  it("should send one request for a double press of Undo", async () => {
    const accepted = acceptedRow();
    const fake = installAcceptedSuggestionsFake(server, { rows: [accepted] });
    const release = fake.hold();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUndoAcceptedSuggestion(), { wrapper });

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.mutateAsync(String(accepted["id"]));
      second = result.current.mutateAsync(String(accepted["id"]));
    });
    await waitFor(() => {
      expect(fake.updates).toHaveLength(1);
    });
    release();
    await act(() => Promise.all([first, second]));

    expect(fake.updates).toHaveLength(1);
  });

  it("should fail with the action and the code only", async () => {
    const accepted = acceptedRow();
    const fake = installAcceptedSuggestionsFake(server, { rows: [accepted] });
    fake.failUpdatesWith("42501");
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUndoAcceptedSuggestion(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync(String(accepted["id"]))).rejects.toThrow(
        "Could not undo adding the suggestion (42501)",
      );
    });

    expect(JSON.stringify(result.current.error)).not.toContain(RECOGNISABLE_SUGGESTION_TEXT);
  });
});
