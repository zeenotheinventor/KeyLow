import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useExercise } from "../../src/hooks/useExercise";
import { keys } from "../../src/queryKeys";
import {
  OWN_EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  exerciseRow,
  installExercisesFake,
} from "../support/exercises";
import { REST_URL, postgrestError } from "../support/postgrest";
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

describe("useExercise", () => {
  it("should be loading, then ready with the exercise and its full muscle map", async () => {
    installExercisesFake(server, { rows: [exerciseRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExercise(OWN_EXERCISE_ID), { wrapper });

    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    if (result.current.status !== "ready") {
      return;
    }
    expect(result.current.exercise.name).toBe(RECOGNISABLE_EXERCISE_NAME);
    expect(result.current.exercise.muscles.map((muscle) => muscle.muscle_id)).toEqual([
      "delt_side",
      "traps_upper",
    ]);
  });

  it("should cache the exercise under the exercise key", async () => {
    installExercisesFake(server, { rows: [exerciseRow()] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useExercise(OWN_EXERCISE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
    expect(queryClient.getQueryData(keys.training.exercise(OWN_EXERCISE_ID))).toMatchObject({
      id: OWN_EXERCISE_ID,
    });
  });

  it("should be not found, and not an error, for an exercise that is not visible or archived", async () => {
    installExercisesFake(server, { rows: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExercise(OWN_EXERCISE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current).toEqual({ status: "notFound" });
    });
  });

  it("should make no request while enabled is false or the id is missing", async () => {
    const fake = installExercisesFake(server);
    const { wrapper } = createWrapper();

    const disabled = renderHook(() => useExercise(OWN_EXERCISE_ID, { enabled: false }), {
      wrapper,
    });
    const missing = renderHook(() => useExercise(undefined), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(fake.requestCount).toBe(0);
    expect(disabled.result.current).toEqual({ status: "loading" });
    expect(missing.result.current).toEqual({ status: "loading" });
  });

  it("should give an error that names the action and the code only", async () => {
    server.use(
      http.get(`${REST_URL}/exercises`, () =>
        postgrestError(500, "XX000", `unavailable ${RECOGNISABLE_EXERCISE_NAME}`),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useExercise(OWN_EXERCISE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
    expect(result.current).toEqual({
      status: "error",
      debugMessage: "Could not load the exercise (XX000)",
    });
  });
});
