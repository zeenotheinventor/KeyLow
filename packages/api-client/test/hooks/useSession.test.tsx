import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useSession } from "../../src/hooks/useSession";
import { keys } from "../../src/queryKeys";
import {
  RECOGNISABLE_DAY_NAME,
  RECOGNISABLE_EXERCISE_NAME,
  installTrainingFake,
  openSessionRow,
} from "../support/training";
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

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("useSession", () => {
  it("should load the session with its sets and keep the rows under its key", async () => {
    installTrainingFake(server, { sessions: [openSessionRow({ id: SESSION_ID })] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useSession(SESSION_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toMatchObject({
      id: SESSION_ID,
      routine_day_name: RECOGNISABLE_DAY_NAME,
    });
    expect(result.current.data?.sets).toHaveLength(1);
    expect(queryClient.getQueryData(keys.training.session(SESSION_ID))).toEqual(
      result.current.data,
    );
  });

  it("should give null for a session that is not visible, which is not an error", async () => {
    installTrainingFake(server, { sessions: [] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSession(SESSION_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
    expect(result.current.isError).toBe(false);
  });

  it("should make no request while enabled is false", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSession(SESSION_ID, { enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });

  it("should make no request without an id", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSession(undefined), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(fake.requests).toEqual([]);
  });

  it("should fail with the action and the code only, holding no exercise name", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    fake.failWith("57014");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useSession(SESSION_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your session (57014)");
    expect(JSON.stringify(result.current.error?.cause)).not.toContain(RECOGNISABLE_EXERCISE_NAME);
  });

  it("should not retry an id that is not a UUID, since asking again cannot change the answer", async () => {
    const fake = installTrainingFake(server, { sessions: [] });
    const { wrapper } = createWrapper(undefined, { retryDelayMs: 20 });

    const { result } = renderHook(() => useSession("not-a-uuid"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(result.current.failureCount).toBe(1);
    expect(fake.requests).toEqual([]);
  });

  it("should retry a failed request, as the connection may come back", async () => {
    const fake = installTrainingFake(server, { sessions: [openSessionRow()] });
    fake.failWith("57014");
    const { wrapper } = createWrapper(undefined, { retryDelayMs: 20 });

    const { result } = renderHook(() => useSession(SESSION_ID), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.failureCount).toBe(4);
  });
});
