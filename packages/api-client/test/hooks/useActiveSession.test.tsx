import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useActiveSession } from "../../src/hooks/useActiveSession";
import { keys } from "../../src/queryKeys";
import { RECOGNISABLE_DAY_NAME, installTrainingFake, openSessionRow } from "../support/training";
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

describe("useActiveSession", () => {
  it("should load the session in progress and keep the rows under its key", async () => {
    installTrainingFake(server, { sessions: [openSessionRow()] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toMatchObject({
      ended_at: null,
      routine_day_name: RECOGNISABLE_DAY_NAME,
    });
    expect(queryClient.getQueryData(keys.training.activeSession)).toEqual(result.current.data);
  });

  it("should give null when there is no session in progress", async () => {
    installTrainingFake(server, { sessions: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("should make no request while enabled is false", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useActiveSession({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });
});
