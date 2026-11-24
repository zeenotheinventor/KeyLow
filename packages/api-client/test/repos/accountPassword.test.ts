import { AUTH_FIELD_PROBLEMS, PASSWORD_PROBLEMS, describeAuthError } from "@keylow/core/copy";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { requestPasswordReset, updatePassword } from "../../src/repos/accountPassword";
import { createTestClient } from "../createTestClient";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";

const AUTH_URL = "http://127.0.0.1:54321/auth/v1";
const REDIRECT_TO = "keylow://auth/callback";
// Built at runtime so no password literal sits in the repository.
const newPassword = () => `pw-${crypto.randomUUID()}`;

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

const authFailure = (status: number, errorCode: string) =>
  HttpResponse.json(
    { code: status, error_code: errorCode, msg: "server wording that must never surface" },
    { status },
  );

describe("requestPasswordReset", () => {
  it.each(["", "   ", "not-an-address", "a@b"])(
    "should return invalidEmail and send no request for %j",
    async (email) => {
      let requests = 0;
      server.use(
        http.post(`${AUTH_URL}/recover`, () => {
          requests += 1;
          return HttpResponse.json({});
        }),
      );

      const outcome = await requestPasswordReset(createTestClient(), {
        email,
        redirectTo: REDIRECT_TO,
      });

      expect(outcome.kind).toBe("invalidEmail");
      expect(requests).toBe(0);
    },
  );

  it("should give core's sentence for an empty address", async () => {
    const outcome = await requestPasswordReset(createTestClient(), {
      email: "",
      redirectTo: REDIRECT_TO,
    });

    expect(outcome).toEqual({ kind: "invalidEmail", message: AUTH_FIELD_PROBLEMS.emailRequired });
  });

  it("should trim the address and pass redirect_to through unchanged", async () => {
    let body: unknown;
    let redirectTo: string | null = null;
    server.use(
      http.post(`${AUTH_URL}/recover`, async ({ request }) => {
        body = await request.json();
        redirectTo = new URL(request.url).searchParams.get("redirect_to");
        return HttpResponse.json({});
      }),
    );

    await requestPasswordReset(createTestClient(), {
      email: "  someone@keylow.test  ",
      redirectTo: REDIRECT_TO,
    });

    expect(body).toMatchObject({ email: "someone@keylow.test" });
    expect(redirectTo).toBe(REDIRECT_TO);
  });

  it("should return sent with no extra fields when the server answers 200", async () => {
    server.use(http.post(`${AUTH_URL}/recover`, () => HttpResponse.json({})));

    expect(
      await requestPasswordReset(createTestClient(), {
        email: "someone@keylow.test",
        redirectTo: REDIRECT_TO,
      }),
    ).toEqual({ kind: "sent" });
  });

  it.each([
    ["user_not_found", 404],
    ["over_email_send_rate_limit", 429],
    ["email_address_not_authorized", 400],
  ])("should return sent when the server answers %s", async (errorCode, status) => {
    server.use(http.post(`${AUTH_URL}/recover`, () => authFailure(status, errorCode)));

    const outcome = await requestPasswordReset(createTestClient(), {
      email: "someone@keylow.test",
      redirectTo: REDIRECT_TO,
    });

    expect(outcome.kind).toBe("sent");
    expect(JSON.stringify(outcome)).not.toContain("server wording");
  });

  // auth-js raises every 500 as a retryable fetch error, like a dead connection. Only status 0 is network.
  it("should return sent with the code unknown for a 500 that carries no code", async () => {
    server.use(
      http.post(`${AUTH_URL}/recover`, () =>
        HttpResponse.json({ msg: "server wording that must never surface" }, { status: 500 }),
      ),
    );

    expect(
      await requestPasswordReset(createTestClient(), {
        email: "someone@keylow.test",
        redirectTo: REDIRECT_TO,
      }),
    ).toEqual({ kind: "sent", unexpectedCode: "unknown" });
  });

  it("should return failed with core's sentence for over_request_rate_limit", async () => {
    server.use(http.post(`${AUTH_URL}/recover`, () => authFailure(429, "over_request_rate_limit")));

    expect(
      await requestPasswordReset(createTestClient(), {
        email: "someone@keylow.test",
        redirectTo: REDIRECT_TO,
      }),
    ).toEqual({ kind: "failed", message: describeAuthError("over_request_rate_limit") });
  });

  it.each([502, 503, 504, 522])(
    "should return sent with the code unknown for a retryable %i, as it says nothing about the address",
    async (status) => {
      server.use(http.post(`${AUTH_URL}/recover`, () => new Response(null, { status })));

      expect(
        await requestPasswordReset(createTestClient(), {
          email: "someone@keylow.test",
          redirectTo: REDIRECT_TO,
        }),
      ).toEqual({ kind: "sent", unexpectedCode: "unknown" });
    },
  );

  it("should return failed with core's network sentence when the request cannot be made", async () => {
    server.use(http.post(`${AUTH_URL}/recover`, () => HttpResponse.error()));

    expect(
      await requestPasswordReset(createTestClient(), {
        email: "someone@keylow.test",
        redirectTo: REDIRECT_TO,
      }),
    ).toEqual({ kind: "failed", message: describeAuthError("network") });
  });

  it("should not throw when the client throws", async () => {
    const client = createTestClient();
    client.auth.resetPasswordForEmail = () => Promise.reject(new Error("boom"));

    expect(
      await requestPasswordReset(client, { email: "someone@keylow.test", redirectTo: REDIRECT_TO }),
    ).toEqual({ kind: "sent", unexpectedCode: "unknown" });
  });
});

describe("updatePassword", () => {
  const signedInClient = async () => {
    const client = createTestClient();
    await signInAs(client, SIGNED_IN_USER_ID);
    return client;
  };

  it("should update the user then sign out the other sessions and report saved", async () => {
    const calls: string[] = [];
    let body: unknown;
    let scope: string | null = null;
    const password = newPassword();
    server.use(
      http.put(`${AUTH_URL}/user`, async ({ request }) => {
        calls.push("PUT /user");
        body = await request.json();
        return HttpResponse.json({ id: SIGNED_IN_USER_ID });
      }),
      http.post(`${AUTH_URL}/logout`, ({ request }) => {
        calls.push("POST /logout");
        scope = new URL(request.url).searchParams.get("scope");
        return new Response(null, { status: 204 });
      }),
    );

    const outcome = await updatePassword(await signedInClient(), {
      newPassword: password,
      context: "change",
    });

    expect(outcome).toEqual({ kind: "saved", otherDevicesSignedOut: true });
    expect(calls).toEqual(["PUT /user", "POST /logout"]);
    expect(body).toMatchObject({ password });
    expect(scope).toBe("others");
  });

  it("should keep the local session after signing out the others", async () => {
    server.use(
      http.put(`${AUTH_URL}/user`, () => HttpResponse.json({ id: SIGNED_IN_USER_ID })),
      http.post(`${AUTH_URL}/logout`, () => new Response(null, { status: 204 })),
    );
    const client = await signedInClient();

    await updatePassword(client, { newPassword: newPassword(), context: "change" });

    const { data } = await client.auth.getSession();
    expect(data.session?.user.id).toBe(SIGNED_IN_USER_ID);
  });

  it("should still report saved, with the other devices not signed out, when the logout fails", async () => {
    server.use(
      http.put(`${AUTH_URL}/user`, () => HttpResponse.json({ id: SIGNED_IN_USER_ID })),
      http.post(`${AUTH_URL}/logout`, () => authFailure(500, "unexpected_failure")),
    );

    expect(
      await updatePassword(await signedInClient(), {
        newPassword: newPassword(),
        context: "recovery",
      }),
    ).toEqual({ kind: "saved", otherDevicesSignedOut: false });
  });

  it("should still report saved when the logout throws", async () => {
    server.use(http.put(`${AUTH_URL}/user`, () => HttpResponse.json({ id: SIGNED_IN_USER_ID })));
    const client = await signedInClient();
    client.auth.signOut = () => Promise.reject(new Error("boom"));

    expect(await updatePassword(client, { newPassword: newPassword(), context: "change" })).toEqual(
      {
        kind: "saved",
        otherDevicesSignedOut: false,
      },
    );
  });

  describe.each(["recovery", "change"] as const)("in the %s context", (context) => {
    let logoutCalls = 0;

    beforeEach(() => {
      logoutCalls = 0;
      server.use(
        http.post(`${AUTH_URL}/logout`, () => {
          logoutCalls += 1;
          return new Response(null, { status: 204 });
        }),
      );
    });

    it("should map same_password to samePassword", async () => {
      server.use(http.put(`${AUTH_URL}/user`, () => authFailure(422, "same_password")));

      expect(
        await updatePassword(await signedInClient(), { newPassword: newPassword(), context }),
      ).toEqual({
        kind: "failed",
        reason: "samePassword",
        message: PASSWORD_PROBLEMS.samePassword,
      });
      expect(logoutCalls).toBe(0);
    });

    it("should map weak_password to weakPassword", async () => {
      server.use(
        http.put(`${AUTH_URL}/user`, () =>
          HttpResponse.json(
            {
              code: 422,
              error_code: "weak_password",
              msg: "server wording that must never surface",
              weak_password: { reasons: ["length"] },
            },
            { status: 422 },
          ),
        ),
      );

      expect(
        await updatePassword(await signedInClient(), { newPassword: newPassword(), context }),
      ).toEqual({
        kind: "failed",
        reason: "weakPassword",
        message: PASSWORD_PROBLEMS.weakPassword,
      });
      expect(logoutCalls).toBe(0);
    });

    it("should map a missing session to sessionEnded with the sentence for the context", async () => {
      const outcome = await updatePassword(createTestClient(), {
        newPassword: newPassword(),
        context,
      });

      expect(outcome).toEqual({
        kind: "failed",
        reason: "sessionEnded",
        message:
          context === "recovery"
            ? PASSWORD_PROBLEMS.resetTimedOut
            : PASSWORD_PROBLEMS.changeSessionEnded,
      });
      expect(logoutCalls).toBe(0);
    });

    it("should map a network failure to core's network sentence", async () => {
      server.use(http.put(`${AUTH_URL}/user`, () => HttpResponse.error()));

      expect(
        await updatePassword(await signedInClient(), { newPassword: newPassword(), context }),
      ).toEqual({ kind: "failed", reason: "other", message: describeAuthError("network") });
    });
  });

  it("should return a failure and not throw when the client throws", async () => {
    const client = await signedInClient();
    client.auth.updateUser = () => Promise.reject(new Error("boom"));

    const outcome = await updatePassword(client, { newPassword: newPassword(), context: "change" });

    expect(outcome).toMatchObject({ kind: "failed", reason: "other" });
    expect(JSON.stringify(outcome)).not.toContain("boom");
  });

  it("should never put the server's message in a failure", async () => {
    server.use(http.put(`${AUTH_URL}/user`, () => authFailure(500, "unexpected_failure")));

    const outcome = await updatePassword(await signedInClient(), {
      newPassword: newPassword(),
      context: "change",
    });

    expect(outcome).toMatchObject({ kind: "failed", reason: "other" });
    expect(JSON.stringify(outcome)).not.toContain("server wording");
  });
});
