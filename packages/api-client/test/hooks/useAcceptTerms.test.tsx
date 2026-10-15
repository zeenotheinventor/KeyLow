import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, delay, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useAcceptTerms } from "../../src/hooks/useAcceptTerms";
import { useTermsAcceptance } from "../../src/hooks/useTermsAcceptance";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

let rpcBodies: unknown[] = [];
let storedAcceptance: { terms_accepted_at: string | null; terms_version: string | null } = {
  terms_accepted_at: null,
  terms_version: null,
};

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  rpcBodies = [];
  storedAcceptance = { terms_accepted_at: null, terms_version: null };
  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [storedAcceptance])),
    http.post(`${REST_URL}/rpc/accept_terms`, async ({ request }) => {
      rpcBodies.push(await request.json());
      storedAcceptance = {
        terms_accepted_at: "2026-10-15T09:30:00+00:00",
        terms_version: "2026-10-15",
      };
      return new Response(null, { status: 204 });
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("useAcceptTerms", () => {
  it("should send the version to the accept_terms RPC", async () => {
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptTerms(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync("2026-10-15");
    });

    expect(rpcBodies).toEqual([{ p_version: "2026-10-15" }]);
  });

  it("should have refreshed the terms acceptance by the time the mutation resolves", async () => {
    // A slow refetch, so a mutation that did not wait for it would resolve first.
    server.use(
      http.get(`${REST_URL}/profiles`, async ({ request }) => {
        await delay(80);
        return postgrestRows(request, [storedAcceptance]);
      }),
    );
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ acceptance: useTermsAcceptance(), accept: useAcceptTerms() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.acceptance.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.accept.mutateAsync("2026-10-15");
    });

    expect(queryClient.getQueryData(keys.profiles.termsAcceptance)).toEqual({
      terms_accepted_at: "2026-10-15T09:30:00+00:00",
      terms_version: "2026-10-15",
    });
  });

  it("should leave the cached acceptance alone and expose the error when the RPC refuses", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/accept_terms`, () =>
        HttpResponse.json(
          { code: "P0002", message: "no profile", details: null, hint: null },
          { status: 404 },
        ),
      ),
    );
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(() => useAcceptTerms(), { wrapper });
    queryClient.setQueryData(keys.profiles.termsAcceptance, storedAcceptance);

    await act(async () => {
      await result.current.mutateAsync("2026-10-15").catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("cause.code", "P0002");
    expect(queryClient.getQueryState(keys.profiles.termsAcceptance)?.isInvalidated).toBe(false);
  });
});
