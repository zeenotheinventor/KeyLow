import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useProfileTimeZone } from "../../src/hooks/useProfileTimeZone";
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

describe("useProfileTimeZone", () => {
  it("should load the profile's time zone and cache it under its key", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) =>
        postgrestRows(request, [{ timezone: "Europe/London" }]),
      ),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useProfileTimeZone(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBe("Europe/London");
    expect(queryClient.getQueryData(keys.profiles.timeZone)).toBe("Europe/London");
  });

  it("should make no request while enabled is false", async () => {
    let requests = 0;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        requests += 1;
        return postgrestRows(request, [{ timezone: "Europe/London" }]);
      }),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useProfileTimeZone({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(requests).toBe(0);
  });
});
