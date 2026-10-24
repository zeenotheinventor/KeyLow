import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useRunDueCheckins } from "../../src/hooks/useRunDueCheckins";
import { keys } from "../../src/queryKeys";
import { createWrapper } from "../support/wrapper";

import type { QueryClient } from "@tanstack/react-query";

const RUN_CHECKIN_URL = "http://127.0.0.1:54321/functions/v1/run-checkin";

const server = setupServer();

let requestBodies: unknown[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  requestBodies = [];
});
afterEach(() => {
  onlineManager.setOnline(true);
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const answerWith = (status: number, body: Record<string, unknown>) => {
  server.use(
    http.post(RUN_CHECKIN_URL, async ({ request }) => {
      requestBodies.push(await request.json());
      return HttpResponse.json(body, { status });
    }),
  );
};

const refreshedKeys = [
  ["targets", keys.profiles.targets],
  ["program summary", keys.program.summary],
  ["expenditure history", keys.program.expenditureHistory(12)],
  ["targets history", keys.program.targetsHistory(12)],
] as const;

const seedEveryKey = (queryClient: QueryClient) => {
  refreshedKeys.forEach(([, key]) => {
    queryClient.setQueryData(key, "cached");
  });
};

const isInvalidated = (queryClient: QueryClient, key: readonly unknown[]) =>
  queryClient.getQueryState(key)?.isInvalidated;

describe("useRunDueCheckins", () => {
  it("should post the due mode", async () => {
    answerWith(200, { ran: 0, nextCheckinDate: "2026-11-06" });
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRunDueCheckins(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(requestBodies).toEqual([{ mode: "due" }]);
  });

  it.each(refreshedKeys)("should invalidate the %s when check-ins ran", async (_name, key) => {
    answerWith(200, { ran: 1, nextCheckinDate: "2026-11-13" });
    const { queryClient, wrapper } = createWrapper();
    seedEveryKey(queryClient);
    const { result } = renderHook(() => useRunDueCheckins(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(isInvalidated(queryClient, key)).toBe(true);
  });

  it("should invalidate nothing when no check-in ran", async () => {
    answerWith(200, { ran: 0, nextCheckinDate: "2026-11-13" });
    const { queryClient, wrapper } = createWrapper();
    seedEveryKey(queryClient);
    const { result } = renderHook(() => useRunDueCheckins(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    refreshedKeys.forEach(([, key]) => {
      expect(isInvalidated(queryClient, key)).toBe(false);
    });
  });

  it("should invalidate nothing when the user has no program to check in", async () => {
    answerWith(409, { error: { code: "no_program", message: "No active program" } });
    const { queryClient, wrapper } = createWrapper();
    seedEveryKey(queryClient);
    const { result } = renderHook(() => useRunDueCheckins(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    refreshedKeys.forEach(([, key]) => {
      expect(isInvalidated(queryClient, key)).toBe(false);
    });
  });

  it("should invalidate nothing and reject when the function fails", async () => {
    answerWith(500, { error: { code: "internal_error", message: "Broke" } });
    const { queryClient, wrapper } = createWrapper();
    seedEveryKey(queryClient);
    const { result } = renderHook(() => useRunDueCheckins(), { wrapper });

    await act(async () => {
      await expect(result.current.mutateAsync()).rejects.toThrow();
    });

    refreshedKeys.forEach(([, key]) => {
      expect(isInvalidated(queryClient, key)).toBe(false);
    });
  });

  it("should send its request and settle while the connection manager says offline", async () => {
    answerWith(200, { ran: 1, nextCheckinDate: "2026-11-13" });
    onlineManager.setOnline(false);
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRunDueCheckins(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(requestBodies).toEqual([{ mode: "due" }]);
  });

  it("should send one request when it is called again while a run is pending", async () => {
    server.use(
      http.post(RUN_CHECKIN_URL, async ({ request }) => {
        requestBodies.push(await request.json());
        await delay(30);
        return HttpResponse.json({ ran: 1, nextCheckinDate: "2026-11-13" });
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRunDueCheckins(), { wrapper });

    await act(async () => {
      const first = result.current.mutateAsync();
      const second = result.current.mutateAsync();
      await Promise.all([first, second]);
    });

    await waitFor(() => {
      expect(requestBodies).toHaveLength(1);
    });
  });
});
