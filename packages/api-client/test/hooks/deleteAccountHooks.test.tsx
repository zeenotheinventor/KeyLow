import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useDeleteMyAccount } from "../../src/hooks/useDeleteMyAccount";
import { AccountDeletionError } from "../../src/repos/deleteAccount";
import { signInAs } from "../support/postgrest";
import { edgeErrorResponse } from "../support/search";
import { createWrapper } from "../support/wrapper";

const FUNCTION_URL = "http://127.0.0.1:54321/functions/v1/delete-account";
const USER_URL = "http://127.0.0.1:54321/auth/v1/user";
const USER_ID = "11111111-1111-4111-8111-111111111111";

const server = setupServer();
let functionRequests = 0;

async function signedInWrapper() {
  const rendered = createWrapper();
  server.use(
    http.get(USER_URL, () =>
      HttpResponse.json({
        id: USER_ID,
        aud: "authenticated",
        app_metadata: {},
        user_metadata: {},
      }),
    ),
  );
  await signInAs(rendered.client, USER_ID);
  return rendered;
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  functionRequests = 0;
});
afterEach(() => {
  onlineManager.setOnline(true);
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("useDeleteMyAccount", () => {
  it("should resolve with the result of the deletion", async () => {
    const { wrapper } = await signedInWrapper();
    server.use(http.post(FUNCTION_URL, () => HttpResponse.json({ deleted: true })));
    const { result } = renderHook(() => useDeleteMyAccount(), { wrapper });

    let resolved: unknown;
    await act(async () => {
      resolved = await result.current.mutateAsync();
    });

    expect(resolved).toEqual({ deleted: true, confirmedBy: "response" });
  });

  it("should call the function at once while offline, instead of waiting for a connection", async () => {
    const { wrapper } = await signedInWrapper();
    server.use(
      http.post(FUNCTION_URL, () => {
        functionRequests += 1;
        return edgeErrorResponse(500, "internal_error", "no detail");
      }),
    );
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useDeleteMyAccount(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(functionRequests).toBe(1);
    expect(result.current.error).toBeInstanceOf(AccountDeletionError);
  });

  it("should not retry a failed deletion", async () => {
    const { wrapper, queryClient } = await signedInWrapper();
    queryClient.setDefaultOptions({ mutations: { retry: 3, retryDelay: 0 } });
    server.use(
      http.post(FUNCTION_URL, () => {
        functionRequests += 1;
        return edgeErrorResponse(500, "internal_error", "no detail");
      }),
    );
    const { result } = renderHook(() => useDeleteMyAccount(), { wrapper });

    act(() => {
      result.current.mutate();
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(functionRequests).toBe(1);
  });
});
