import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useReauthenticateWithPassword } from "../../src/hooks/useReauthenticateWithPassword";
import { signInAs } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const AUTH_URL = "http://127.0.0.1:54321/auth/v1";
const USER_ID = "11111111-1111-4111-8111-111111111111";
// Built at runtime so no password literal sits in the repository.
const newPassword = () => `pw-${crypto.randomUUID()}`;

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  onlineManager.setOnline(true);
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const unsignedToken = (marker: string) =>
  ["header", "payload", marker].map((part) => btoa(part).replaceAll("=", "")).join(".");

/** A wrapper whose client is signed in as a user with an email, and the answer of the password grant. */
async function signedInWrapper(answer: () => Response) {
  const rendered = createWrapper();
  server.use(
    http.get(`${AUTH_URL}/user`, () =>
      HttpResponse.json({
        id: USER_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "someone@keylow.test",
      }),
    ),
  );
  await signInAs(rendered.client, USER_ID);
  server.use(http.post(`${AUTH_URL}/token`, answer));
  return rendered;
}

const accepted = () =>
  HttpResponse.json({
    access_token: unsignedToken("fresh"),
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "new-refresh-token",
    user: { id: USER_ID, aud: "authenticated", email: "someone@keylow.test" },
  });

describe("useReauthenticateWithPassword", () => {
  it("should resolve with the outcome", async () => {
    const { wrapper } = await signedInWrapper(accepted);
    const { result } = renderHook(() => useReauthenticateWithPassword(), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ password: newPassword() });
    });

    expect(outcome).toEqual({ kind: "confirmed" });
  });

  it("should resolve with a wrong password as a value and not reject", async () => {
    const { wrapper } = await signedInWrapper(() =>
      HttpResponse.json(
        { code: 400, error_code: "invalid_credentials", msg: "x" },
        { status: 400 },
      ),
    );
    const { result } = renderHook(() => useReauthenticateWithPassword(), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({ password: newPassword() });
    });

    expect(outcome).toEqual({ kind: "wrongPassword" });
  });

  it("should send at once while offline, instead of pausing", async () => {
    let grants = 0;
    const { wrapper } = await signedInWrapper(() => {
      grants += 1;
      return accepted();
    });
    onlineManager.setOnline(false);
    const { result } = renderHook(() => useReauthenticateWithPassword(), { wrapper });

    act(() => {
      result.current.mutate({ password: newPassword() });
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(grants).toBe(1);
  });

  it("should not retry a failed sign in", async () => {
    let grants = 0;
    const { wrapper, queryClient } = await signedInWrapper(() => {
      grants += 1;
      return HttpResponse.json({ code: 500, error_code: "unexpected_failure" }, { status: 500 });
    });
    queryClient.setDefaultOptions({ mutations: { retry: 3, retryDelay: 0 } });
    const { result } = renderHook(() => useReauthenticateWithPassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ password: newPassword() });
    });

    expect(grants).toBe(1);
  });

  it("should leave no mutation holding the password in the cache once it has settled and unmounted", async () => {
    const password = newPassword();
    const { wrapper, queryClient } = await signedInWrapper(accepted);
    const { result, unmount } = renderHook(() => useReauthenticateWithPassword(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ password });
    });
    unmount();

    await waitFor(() => {
      expect(queryClient.getMutationCache().getAll()).toHaveLength(0);
    });
    expect(JSON.stringify(queryClient.getMutationCache().getAll())).not.toContain(password);
  });
});
