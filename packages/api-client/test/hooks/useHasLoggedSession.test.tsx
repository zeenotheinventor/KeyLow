import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useHasLoggedSession } from "../../src/hooks/useHasLoggedSession";
import { keys } from "../../src/queryKeys";
import { installTrainingFake, sessionRow } from "../support/training";
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

describe("useHasLoggedSession", () => {
  it("should be true when the user has a session, and keep the answer under its key", async () => {
    installTrainingFake(server, { sessions: [sessionRow()] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useHasLoggedSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(true);
    expect(queryClient.getQueryData(keys.training.hasLoggedSession)).toBe(true);
  });

  it("should be false when the user has no session", async () => {
    installTrainingFake(server, { sessions: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHasLoggedSession(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe(false);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installTrainingFake(server, { sessions: [sessionRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useHasLoggedSession({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });
});
