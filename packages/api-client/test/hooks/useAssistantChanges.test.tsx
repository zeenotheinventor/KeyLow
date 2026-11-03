import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useAssistantChanges } from "../../src/hooks/useAssistantChanges";
import { keys } from "../../src/queryKeys";
import {
  FIRST_ACTION_ID,
  SECOND_ACTION_ID,
  actionRow,
  createAssistantFakeState,
  installAssistantFake,
} from "../support/assistantFake";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-10-27T14:00:00Z") });
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const THIRD_ACTION_ID = "00000000-0000-4000-8000-0000000000d3";

describe("useAssistantChanges", () => {
  it("should give the days newest first, one row per turn and tool, with a count", async () => {
    const state = createAssistantFakeState({
      actions: [
        actionRow({ id: FIRST_ACTION_ID, turn_seq: 1, created_at: "2026-10-27T08:11:00Z" }),
        actionRow({ id: SECOND_ACTION_ID, turn_seq: 2, created_at: "2026-10-27T08:11:01Z" }),
        actionRow({
          id: THIRD_ACTION_ID,
          turn_id: "00000000-0000-4000-8000-0000000000a9",
          tool: "archive_recipe",
          target_table: "recipes",
          created_at: "2026-10-26T19:05:00Z",
        }),
      ],
    });
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantChanges(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      count: 2,
      days: [
        {
          label: "Today",
          rows: [
            {
              key: FIRST_ACTION_ID,
              actionIds: [FIRST_ACTION_ID, SECOND_ACTION_ID],
              title: "Logged 2 entries",
              sub: "08:11",
              state: "undo",
            },
          ],
        },
        {
          label: "Yesterday",
          rows: [
            {
              key: THIRD_ACTION_ID,
              actionIds: [THIRD_ACTION_ID],
              title: "Archived a recipe",
              sub: "19:05",
              state: "undo",
            },
          ],
        },
      ],
    });
  });

  it("should word the times in the time zone of the person's profile", async () => {
    const state = createAssistantFakeState({
      timeZone: "Pacific/Auckland",
      actions: [actionRow({ created_at: "2026-10-26T23:30:00Z" })],
    });
    installAssistantFake(server, state);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantChanges(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.days[0]).toMatchObject({ rows: [{ sub: "12:30" }] });
  });

  it("should read in UTC when the profile has no time zone", async () => {
    installAssistantFake(
      server,
      createAssistantFakeState({
        timeZone: null,
        actions: [actionRow({ created_at: "2026-10-27T08:11:00Z" })],
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantChanges(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.days[0]).toMatchObject({ rows: [{ sub: "08:11" }] });
  });

  it("should be empty with a count of 0 when the assistant changed nothing", async () => {
    installAssistantFake(server, createAssistantFakeState({ actions: [] }));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantChanges(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ days: [], count: 0 });
  });

  it("should cache the read under the changes key", async () => {
    installAssistantFake(server, createAssistantFakeState());
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useAssistantChanges(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryState(keys.assistant.changes)?.status).toBe("success");
  });
});
