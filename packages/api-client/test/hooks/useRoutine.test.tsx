import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRoutine } from "../../src/hooks/useRoutine";
import { keys } from "../../src/queryKeys";
import {
  RECOGNISABLE_ROUTINE_EXERCISE_NAME,
  ROUTINE_ID,
  installRoutinesFake,
  routineDetailRow,
} from "../support/routines";
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

describe("useRoutine", () => {
  it("should load the routine with its days and exercises and keep the rows under its key", async () => {
    installRoutinesFake(server, { routines: [routineDetailRow()] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutine(ROUTINE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.days[0]?.exercises[0]?.exercise.name).toBe(
      RECOGNISABLE_ROUTINE_EXERCISE_NAME,
    );
    expect(queryClient.getQueryData(keys.training.routine(ROUTINE_ID))).toEqual(
      result.current.data,
    );
  });

  it("should give null for a routine that is not visible, which is not an error", async () => {
    installRoutinesFake(server, { routines: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutine(ROUTINE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("should ask for nothing while the id is undefined or the hook is disabled", () => {
    const fake = installRoutinesFake(server, { routines: [routineDetailRow()] });
    const { wrapper } = createWrapper();

    const missing = renderHook(() => useRoutine(undefined), { wrapper });
    const disabled = renderHook(() => useRoutine(ROUTINE_ID, { enabled: false }), { wrapper });

    expect(missing.result.current.fetchStatus).toBe("idle");
    expect(disabled.result.current.fetchStatus).toBe("idle");
    expect(fake.requestCount).toBe(0);
  });

  it("should report an error that names the action and the code only", async () => {
    const fake = installRoutinesFake(server);
    fake.failWith("57014");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useRoutine(ROUTINE_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your routine (57014)");
  });
});
