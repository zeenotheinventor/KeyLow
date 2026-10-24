import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useTargets } from "../../src/hooks/useTargets";
import { keys } from "../../src/queryKeys";
import {
  activeProgram,
  engineRow,
  profileTargetsRead,
  programsRead,
  targetsRead,
} from "../support/liveTargetsFake";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
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

const profileRow = {
  target_kcal: 2200,
  target_protein_g: 160,
  target_carbs_g: 220,
  target_fat_g: 70,
};

describe("useTargets", () => {
  // Most cases are about the profile's manual targets, so by default the user has no program and no row.
  beforeEach(() => {
    server.use(programsRead([]), targetsRead([]));
  });

  it("should load the targets", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [profileRow])),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargets(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      kcal: 2200,
      protein_g: 160,
      carbs_g: 220,
      fat_g: 70,
      source: "manual",
    });
  });

  it("should cache the targets under the targets key", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [profileRow])),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useTargets(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.profiles.targets)).toEqual(result.current.data);
  });

  it("should make no request while enabled is false", async () => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, [profileRow]);
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargets({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toBe(0);
  });

  it("should expose the error when loading fails", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargets(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("cause.code", "XX000");
  });
});

describe("useTargets for an active program", () => {
  beforeEach(() => {
    server.use(programsRead([activeProgram]), targetsRead([engineRow]));
  });

  it("should load the current row's figures, the week's calories with no date", async () => {
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargets(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      kcal: 2140,
      protein_g: 126,
      carbs_g: 245,
      fat_g: 73,
      dowCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 1900, 2100],
      source: "engine",
    });
  });

  it.each([
    ["a Monday", "2026-10-26", 2200],
    ["a Saturday", "2026-10-24", 1900],
    ["a Sunday", "2026-10-25", 2100],
  ])(
    "should give the calories of %s when it is given that date",
    async (_name, localDate, kcal) => {
      const { wrapper } = createWrapper();

      const { result } = renderHook(() => useTargets({ localDate }), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
      expect(result.current.data).toMatchObject({ kcal, protein_g: 126, carbs_g: 245, fat_g: 73 });
    },
  );

  it("should serve every day from one request and keep the week's figure in the cache", async () => {
    let targetsRequests = 0;
    server.use(
      http.get(`${REST_URL}/targets`, ({ request }) => {
        targetsRequests += 1;
        return postgrestRows(request, [engineRow]);
      }),
    );
    const { queryClient, wrapper } = createWrapper();

    const saturday = renderHook(() => useTargets({ localDate: "2026-10-24" }), { wrapper });
    const monday = renderHook(() => useTargets({ localDate: "2026-10-26" }), { wrapper });

    await waitFor(() => {
      expect(saturday.result.current.isSuccess).toBe(true);
      expect(monday.result.current.isSuccess).toBe(true);
    });
    expect(saturday.result.current.data?.kcal).toBe(1900);
    expect(monday.result.current.data?.kcal).toBe(2200);
    expect(targetsRequests).toBe(1);
    expect(queryClient.getQueryData(keys.profiles.targets)).toMatchObject({ kcal: 2140 });
  });

  it("should read the calories of a date the cache was filled for before a date was asked", async () => {
    const { wrapper } = createWrapper();
    const week = renderHook(() => useTargets(), { wrapper });
    await waitFor(() => {
      expect(week.result.current.isSuccess).toBe(true);
    });

    const day = renderHook(() => useTargets({ localDate: "2026-10-24" }), { wrapper });

    expect(day.result.current.data?.kcal).toBe(1900);
    expect(week.result.current.data?.kcal).toBe(2140);
  });
});

describe("useTargets with a date for manual targets", () => {
  beforeEach(() => {
    server.use(programsRead([]), targetsRead([]), profileTargetsRead);
  });

  it("should give the same calories on every day", async () => {
    const { wrapper } = createWrapper();

    const saturday = renderHook(() => useTargets({ localDate: "2026-10-24" }), { wrapper });
    const monday = renderHook(() => useTargets({ localDate: "2026-10-26" }), { wrapper });

    await waitFor(() => {
      expect(saturday.result.current.isSuccess).toBe(true);
      expect(monday.result.current.isSuccess).toBe(true);
    });
    expect(saturday.result.current.data?.kcal).toBe(2200);
    expect(monday.result.current.data?.kcal).toBe(2200);
  });

  it("should keep a missing calorie target missing, so the diary shows its no-target state", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [
          { target_kcal: null, target_protein_g: null, target_carbs_g: null, target_fat_g: null },
        ]),
      ),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargets({ localDate: "2026-10-24" }), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data?.kcal).toBeNull();
  });
});
