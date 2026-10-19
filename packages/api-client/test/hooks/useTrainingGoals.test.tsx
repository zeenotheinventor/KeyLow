import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useTrainingGoals } from "../../src/hooks/useTrainingGoals";
import { useTrainingGoalsHistory } from "../../src/hooks/useTrainingGoalsHistory";
import { keys } from "../../src/queryKeys";
import {
  GOAL_ROW_ID,
  OTHER_GOAL_ROW_ID,
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

describe("useTrainingGoals", () => {
  it("should load the current goal under its key, as the row", async () => {
    installTrainingGoalsFake(server, { rows: [trainingGoalsRow(vTaperAnswers)] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainingGoals(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual(trainingGoalsRow(vTaperAnswers));
    expect(queryClient.getQueryData(keys.training.goals)).toEqual(trainingGoalsRow(vTaperAnswers));
  });

  it("should give null when the user has no goal", async () => {
    installTrainingGoalsFake(server, { rows: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainingGoals(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeNull();
    });
  });

  it("should make no request when it is not enabled", async () => {
    const fake = installTrainingGoalsFake(server, { rows: [trainingGoalsRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainingGoals({ enabled: false }), { wrapper });

    await Promise.resolve();
    expect(result.current.data).toBeUndefined();
    expect(fake.reads).toEqual([]);
  });

  it("should report an error that names the action and the code only", async () => {
    const fake = installTrainingGoalsFake(server);
    fake.failReadsWith("42501");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainingGoals(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your training goals (42501)");
    expect(JSON.stringify(result.current.error?.cause)).not.toContain(RECOGNISABLE_GOAL_TEXT);
  });
});

describe("useTrainingGoalsHistory", () => {
  it("should load every goal, newest first, under a key outside the persisted goal key", async () => {
    installTrainingGoalsFake(server, {
      rows: [
        trainingGoalsRow(vTaperAnswers),
        trainingGoalsRow(strengthAnswers, {
          id: OTHER_GOAL_ROW_ID,
          effective_from: "2026-10-01T09:00:00+00:00",
          effective_to: "2026-10-10T09:00:00+00:00",
        }),
      ],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useTrainingGoalsHistory(), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.map(({ id }) => id)).toEqual([GOAL_ROW_ID, OTHER_GOAL_ROW_ID]);
    expect(queryClient.getQueryData(keys.training.goalsHistory)).toHaveLength(2);
    expect(keys.training.goalsHistory.slice(0, 2)).not.toEqual(keys.training.goals);
  });

  it("should make no request when it is not enabled", async () => {
    const fake = installTrainingGoalsFake(server, { rows: [trainingGoalsRow()] });
    const { wrapper } = createWrapper();

    renderHook(() => useTrainingGoalsHistory({ enabled: false }), { wrapper });

    await Promise.resolve();
    expect(fake.reads).toEqual([]);
  });
});
