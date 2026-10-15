import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useTargets } from "../../src/hooks/useTargets";
import { keys } from "../../src/queryKeys";
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
  it("should load the targets", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [profileRow])),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTargets(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 });
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
