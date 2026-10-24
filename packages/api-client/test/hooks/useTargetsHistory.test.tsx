import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useTargetsHistory } from "../../src/hooks/useTargetsHistory";
import { keys } from "../../src/queryKeys";
import { installProgramFake, programRow, targetsRow } from "../support/program";
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

// 12:00 on Saturday 24 October in London, so today is the 24th.
const NOW = "2026-10-24T12:00:00Z";

describe("useTargetsHistory", () => {
  it("should load the rows that touch the last weeks, oldest first, and cache them under the key of the range", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      targets: [
        targetsRow({ effective_from: "2026-10-16", effective_to: null, calories_kcal: 2140 }),
        targetsRow({
          effective_from: "2026-08-15",
          effective_to: "2026-10-16",
          calories_kcal: 2170,
        }),
        targetsRow({
          effective_from: "2026-07-01",
          effective_to: "2026-08-15",
          calories_kcal: 2250,
        }),
      ],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useTargetsHistory({ weeks: 8, now: NOW }), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.map((row) => row.caloriesKcal)).toEqual([2170, 2140]);
    expect(result.current.data?.map((row) => row.isCurrent)).toEqual([false, true]);
    expect(queryClient.getQueryData(keys.program.targetsHistory(8))).toEqual(result.current.data);
  });

  it("should read from the number of weeks before today, in the profile zone", async () => {
    const { requestsTo } = installProgramFake(server, { timeZone: "Pacific/Auckland" });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useTargetsHistory({ weeks: 8, now: "2026-10-24T23:30:00Z" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(requestsTo("targets")[0]?.url.searchParams.get("or")).toBe(
      "(effective_to.is.null,effective_to.gt.2026-08-30)",
    );
  });

  it("should read in UTC for a profile with no time zone", async () => {
    const { requestsTo } = installProgramFake(server, { timeZone: null });
    const { wrapper } = createWrapper();

    const { result } = renderHook(
      () => useTargetsHistory({ weeks: 8, now: "2026-10-24T23:30:00Z" }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(requestsTo("targets")[0]?.url.searchParams.get("or")).toBe(
      "(effective_to.is.null,effective_to.gt.2026-08-29)",
    );
  });

  it("should keep two ranges apart, each in its own cache entry with its own request", async () => {
    const { requestsTo } = installProgramFake(server, {
      programs: [programRow()],
      targets: [targetsRow()],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(
      () => ({
        short: useTargetsHistory({ weeks: 4, now: NOW }),
        long: useTargetsHistory({ weeks: 26, now: NOW }),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.short.data).toBeDefined();
      expect(result.current.long.data).toBeDefined();
    });
    expect(requestsTo("targets").map((request) => request.url.searchParams.get("or"))).toEqual(
      expect.arrayContaining([
        "(effective_to.is.null,effective_to.gt.2026-09-26)",
        "(effective_to.is.null,effective_to.gt.2026-04-25)",
      ]),
    );
    expect(queryClient.getQueryData(keys.program.targetsHistory(4))).toBeDefined();
    expect(queryClient.getQueryData(keys.program.targetsHistory(26))).toBeDefined();
  });

  it("should keep the rows that held for no days when asked to, under a key of its own", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      targets: [
        targetsRow({
          effective_from: "2026-10-16",
          effective_to: "2026-10-23",
          calories_kcal: 2170,
        }),
        targetsRow({
          effective_from: "2026-10-23",
          effective_to: "2026-10-23",
          calories_kcal: 1999,
        }),
        targetsRow({ effective_from: "2026-10-23", effective_to: null, calories_kcal: 2140 }),
      ],
    });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(
      () => ({
        plain: useTargetsHistory({ weeks: 8, now: NOW }),
        whole: useTargetsHistory({ weeks: 8, now: NOW, keepZeroDayRows: true }),
      }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.plain.data).toBeDefined();
      expect(result.current.whole.data).toBeDefined();
    });
    expect(result.current.plain.data?.map((row) => row.caloriesKcal)).toEqual([2170, 2140]);
    expect(result.current.whole.data?.map((row) => row.caloriesKcal)).toEqual([2170, 1999, 2140]);
    expect(queryClient.getQueryData(keys.program.targetsHistoryWithZeroDayRows(8))).toEqual(
      result.current.whole.data,
    );
  });

  it("should make no request at all while enabled is false", async () => {
    const { requests } = installProgramFake(server, { targets: [targetsRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargetsHistory({ weeks: 4, now: NOW, enabled: false }), {
      wrapper,
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.isPending).toBe(true);
    expect(result.current.data).toBeUndefined();
    expect(requests).toEqual([]);
  });

  it("should expose the error, with the code only, when the read fails", async () => {
    const { failWith } = installProgramFake(server);
    failWith("targets", "XX000");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargetsHistory({ weeks: 4, now: NOW }), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty(
      "message",
      "Could not load your targets history (XX000)",
    );
  });
});
