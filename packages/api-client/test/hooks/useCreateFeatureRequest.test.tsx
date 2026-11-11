import { act, renderHook } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useCreateFeatureRequest } from "../../src/hooks/useCreateFeatureRequest";
import { REST_URL, postgrestError, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const REQUEST_ID = "77777777-7777-4777-8777-777777777777";

const server = setupServer();

let insertBodies: unknown[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  insertBodies = [];
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("useCreateFeatureRequest", () => {
  it("should file a more_menu request and resolve to its id", async () => {
    server.use(
      http.post(`${REST_URL}/feature_requests`, async ({ request }) => {
        insertBodies.push(await request.clone().json());
        return postgrestRows(request, [{ id: REQUEST_ID }], 201);
      }),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateFeatureRequest(), { wrapper });

    let created: { id: string } | undefined;
    await act(async () => {
      created = await result.current.mutateAsync({
        source: "more_menu",
        request: "  stub request  ",
      });
    });

    expect(created).toEqual({ id: REQUEST_ID });
    expect(insertBodies).toEqual([{ source: "more_menu", request: "stub request", context: null }]);
  });

  it("should fail with the code rate_limited when the daily cap is reached", async () => {
    server.use(
      http.post(`${REST_URL}/feature_requests`, () =>
        postgrestError(400, "54000", "feature_requests_daily_cap"),
      ),
    );
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateFeatureRequest(), { wrapper });

    const failure = await act(async () =>
      result.current
        .mutateAsync({ source: "more_menu", request: "stub request" })
        .catch((error: unknown) => error),
    );

    expect(failure).toHaveProperty("cause", { code: "rate_limited" });
  });
});
