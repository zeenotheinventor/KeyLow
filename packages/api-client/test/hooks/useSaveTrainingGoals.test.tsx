import { act, renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSaveTrainingGoals } from "../../src/hooks/useSaveTrainingGoals";
import { useTrainingGoals } from "../../src/hooks/useTrainingGoals";
import { keys } from "../../src/queryKeys";
import { seedTrainingQueries } from "../support/routines";
import {
  GOAL_ROW_ID,
  NEW_GOAL_ROW_ID,
  RECOGNISABLE_GOAL_TEXT,
  installTrainingGoalsFake,
  strengthAnswers,
  trainingGoalsRow,
  vTaperAnswers,
} from "../support/trainingGoals";
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

describe("useSaveTrainingGoals", () => {
  it("should resolve to the new row", async () => {
    installTrainingGoalsFake(server, { rows: [trainingGoalsRow(strengthAnswers)] });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveTrainingGoals(), { wrapper });

    const saved = await act(() => result.current.mutateAsync(vTaperAnswers));

    expect(saved).toMatchObject({ id: NEW_GOAL_ROW_ID, goal: "aesthetic", effective_to: null });
  });

  it("should put the new row in the cache of the current goal, so a screen reading it shows it at once", async () => {
    installTrainingGoalsFake(server, { rows: [trainingGoalsRow(strengthAnswers)] });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ goals: useTrainingGoals(), save: useSaveTrainingGoals() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.goals.data?.id).toBe(GOAL_ROW_ID);
    });

    await act(() => result.current.save.mutateAsync(vTaperAnswers));

    expect(queryClient.getQueryData(keys.training.goals)).toMatchObject({ id: NEW_GOAL_ROW_ID });
    await waitFor(() => {
      expect(result.current.goals.data).toMatchObject({ id: NEW_GOAL_ROW_ID, focus: ["v_taper"] });
    });
  });

  it("should mark the goal history and every training family stale, the ones that read priorities among them", async () => {
    installTrainingGoalsFake(server);
    const { queryClient, wrapper } = createWrapper();
    const seeded = seedTrainingQueries(queryClient);
    queryClient.setQueryData(keys.training.goalsHistory, []);
    const { result } = renderHook(() => useSaveTrainingGoals(), { wrapper });

    await act(() => result.current.mutateAsync(vTaperAnswers));

    expect(seeded.isStale(keys.training.goalsHistory)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.activeRoutine)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.sets)).toBe(true);
    expect(seeded.isStale(seeded.queryKeys.weekSessions)).toBe(true);
  });

  it("should send one request for a double press of Save with the same answers", async () => {
    const fake = installTrainingGoalsFake(server);
    const release = fake.holdSaves();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveTrainingGoals(), { wrapper });

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.mutateAsync(vTaperAnswers);
      second = result.current.mutateAsync(vTaperAnswers);
    });
    await waitFor(() => {
      expect(fake.saves).toHaveLength(1);
    });
    release();
    await act(() => Promise.all([first, second]));

    expect(fake.saves).toHaveLength(1);
  });

  it("should run different answers after the pending save settles, so the last save wins", async () => {
    const fake = installTrainingGoalsFake(server);
    const release = fake.holdSaves();
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSaveTrainingGoals(), { wrapper });

    let first: Promise<unknown> = Promise.resolve();
    let second: Promise<unknown> = Promise.resolve();
    act(() => {
      first = result.current.mutateAsync(vTaperAnswers);
      second = result.current.mutateAsync(strengthAnswers);
    });
    await waitFor(() => {
      expect(fake.saves).toHaveLength(1);
    });
    release();
    await act(() => Promise.all([first, second]));

    expect(fake.saves).toHaveLength(2);
    expect(fake.saves[1]).toMatchObject({ p_goals: { goal: "strength" } });
  });

  it("should fail with the action and the code only, and mark the goal stale for a fresh read", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failNextSaves("22023");
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.training.goals, trainingGoalsRow(strengthAnswers));
    const { result } = renderHook(() => useSaveTrainingGoals(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync(vTaperAnswers).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.error?.message).toBe("Could not save your training goals (22023)");
    });
    expect(JSON.stringify(result.current.error?.cause)).not.toContain(RECOGNISABLE_GOAL_TEXT);
    expect(queryClient.getQueryState(keys.training.goals)?.isInvalidated).toBe(true);
  });
});

describe("useSaveTrainingGoals, answers the questionnaire refuses", () => {
  it("should fail before any request and leave the cached goal fresh", async () => {
    const fake = installTrainingGoalsFake(server);
    const { queryClient, wrapper } = createWrapper();
    queryClient.setQueryData(keys.training.goals, trainingGoalsRow(strengthAnswers));
    const { result } = renderHook(() => useSaveTrainingGoals(), { wrapper });

    await act(async () => {
      await result.current
        .mutateAsync({ ...vTaperAnswers, days_per_week: 9 })
        .catch(() => undefined);
    });

    expect(fake.saves).toEqual([]);
    expect(queryClient.getQueryState(keys.training.goals)?.isInvalidated).toBe(false);
  });
});
