import { renderHook, waitFor } from "@testing-library/react";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useTermsAcceptance } from "../../src/hooks/useTermsAcceptance";
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

const accepted = { terms_accepted_at: "2026-10-15T09:30:00+00:00", terms_version: "2026-10-15" };

describe("useTermsAcceptance", () => {
  it("should load the terms acceptance", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [accepted])),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTermsAcceptance(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual(accepted);
  });

  it("should resolve to null when there is no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTermsAcceptance(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toBeNull();
  });

  it("should cache the acceptance under the terms acceptance key", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [accepted])),
    );
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useTermsAcceptance(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(queryClient.getQueryData(keys.profiles.termsAcceptance)).toEqual(accepted);
  });

  it("should expose the error when loading fails", async () => {
    server.use(
      http.get(`${REST_URL}/profiles`, () => postgrestError(500, "XX000", "database unavailable")),
    );
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useTermsAcceptance(), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("cause.message", "database unavailable");
  });
});
