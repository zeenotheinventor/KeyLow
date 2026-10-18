import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useWeightUnit } from "../../src/hooks/useWeightUnit";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestRows } from "../support/postgrest";
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

const profileUnit = (weight_unit: string | null) => {
  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [{ weight_unit }])),
  );
};

describe("useWeightUnit", () => {
  it("should load the profile's unit and keep it under its key", async () => {
    profileUnit("lb");
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightUnit(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe("lb");
    expect(queryClient.getQueryData(keys.profiles.weightUnit)).toBe("lb");
  });

  it("should read stone as kg, since training does not use it", async () => {
    profileUnit("st");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightUnit(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe("kg");
  });

  it("should make no request while enabled is false", async () => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, [{ weight_unit: "kg" }]);
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useWeightUnit({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toBe(0);
  });
});
