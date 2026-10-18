import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useLastPerformance } from "../../src/hooks/useLastPerformance";
import { keys } from "../../src/queryKeys";
import { EXERCISE_ID, installTrainingFake, previousSetRow } from "../support/training";
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

const OPEN_SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("useLastPerformance", () => {
  it("should load the sets of the earlier sessions and keep them under the exercise's key", async () => {
    installTrainingFake(server, { sets: [previousSetRow()] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useLastPerformance(EXERCISE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.[0]?.local_date).toBe("2026-10-11");
    expect(queryClient.getQueryData(keys.training.lastPerformance(EXERCISE_ID))).toEqual(
      result.current.data,
    );
  });

  it("should leave out the session being logged, and key the read by it", async () => {
    const fake = installTrainingFake(server, { sets: [previousSetRow()] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(
      () => useLastPerformance(EXERCISE_ID, { excludeSessionId: OPEN_SESSION_ID }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(fake.requestsTo("workout_sets")[0]?.url.searchParams.get("session_id")).toBe(
      `neq.${OPEN_SESSION_ID}`,
    );
    expect(
      queryClient.getQueryData(keys.training.lastPerformance(EXERCISE_ID, OPEN_SESSION_ID)),
    ).toEqual(result.current.data);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installTrainingFake(server, { sets: [previousSetRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLastPerformance(EXERCISE_ID, { enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });

  it("should make no request without an exercise", async () => {
    const fake = installTrainingFake(server, { sets: [previousSetRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useLastPerformance(undefined), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });
});
