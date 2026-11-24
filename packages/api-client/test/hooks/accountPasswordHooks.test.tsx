import { PASSWORD_PROBLEMS } from "@keylow/core/copy";
import { act, renderHook } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useRequestPasswordReset } from "../../src/hooks/useRequestPasswordReset";
import { useUpdatePassword } from "../../src/hooks/useUpdatePassword";
import { createTestClient } from "../createTestClient";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const AUTH_URL = "http://127.0.0.1:54321/auth/v1";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  // The user lookup that vouches for the unsigned test session.
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

describe("useRequestPasswordReset", () => {
  it("should resolve with the outcome", async () => {
    server.use(http.post(`${AUTH_URL}/recover`, () => HttpResponse.json({})));
    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useRequestPasswordReset(), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        email: "someone@keylow.test",
        redirectTo: "keylow://auth/callback",
      });
    });

    expect(outcome).toEqual({ kind: "sent" });
  });
});

describe("useUpdatePassword", () => {
  it("should resolve with the failure as a value and not reject", async () => {
    server.use(
      http.put(`${AUTH_URL}/user`, () =>
        HttpResponse.json({ code: 422, error_code: "same_password", msg: "x" }, { status: 422 }),
      ),
    );
    const client = createTestClient();
    await signInAs(client, SIGNED_IN_USER_ID);
    const { wrapper } = createWrapper(client);
    const { result } = renderHook(() => useUpdatePassword(), { wrapper });

    let outcome: unknown;
    await act(async () => {
      outcome = await result.current.mutateAsync({
        newPassword: `pw-${crypto.randomUUID()}`,
        context: "change",
      });
    });

    expect(outcome).toEqual({
      kind: "failed",
      reason: "samePassword",
      message: PASSWORD_PROBLEMS.samePassword,
    });
  });
});
