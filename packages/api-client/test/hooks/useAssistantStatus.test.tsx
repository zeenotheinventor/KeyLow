import { renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useAssistantStatus } from "../../src/hooks/useAssistantStatus";
import { getAssistantStatus } from "../../src/repos/assistant";
import { createTestClient } from "../createTestClient";
import { FUNCTIONS_URL } from "../support/assistantStream";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { AssistantNotice } from "@keylow/core";

const server = setupServer();

let statusRequests: Request[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  statusRequests = [];
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

function answerStatus(notice: AssistantNotice | null) {
  server.use(
    http.get(`${FUNCTIONS_URL}/assistant/status`, ({ request }) => {
      statusRequests.push(request);
      return HttpResponse.json({ notice });
    }),
  );
}

async function renderStatus(signedIn = true) {
  const client = createTestClient();
  if (signedIn) {
    await signInAs(client, SIGNED_IN_USER_ID);
  }
  const { wrapper } = createWrapper(client, { functionsUrl: FUNCTIONS_URL });
  return renderHook(() => useAssistantStatus(), { wrapper });
}

describe("useAssistantStatus", () => {
  it.each<[string, AssistantNotice | null]>([
    ["open", null],
    ["consent_needed", { code: "consent_needed" }],
    ["day_limit", { code: "day_limit", resetsAt: "2026-11-04T00:00:00Z" }],
    ["plus", { code: "plus" }],
    ["resting", { code: "resting", resumesOn: "2026-12-01" }],
    ["switched_off", { code: "switched_off" }],
    ["turn_failed", { code: "turn_failed" }],
  ])("should map a %s status response to its notice", async (_name, notice) => {
    answerStatus(notice);

    const { result } = await renderStatus();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ notice });
  });

  it("should ask the status route with the session's access token", async () => {
    answerStatus(null);

    const { result } = await renderStatus();

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(statusRequests).toHaveLength(1);
    expect(statusRequests[0]?.headers.get("authorization")).toMatch(/^Bearer .+\..+\..+$/);
  });

  it("should fail, with no notice, when the answer is not a status", async () => {
    server.use(
      http.get(`${FUNCTIONS_URL}/assistant/status`, () =>
        HttpResponse.json({ notice: { code: "unheard_of" } }),
      ),
    );

    const { result } = await renderStatus();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });

  it("should fail, with no notice, when the route refuses the sign-in", async () => {
    server.use(
      http.get(`${FUNCTIONS_URL}/assistant/status`, () =>
        HttpResponse.json(
          { error: { code: "unauthorised", message: "Sign in." } },
          { status: 401 },
        ),
      ),
    );

    const { result } = await renderStatus();

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.data).toBeUndefined();
  });

  it("should fail without asking the route when nobody is signed in", async () => {
    answerStatus(null);

    const { result } = await renderStatus(false);

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(statusRequests).toHaveLength(0);
  });
});

describe("getAssistantStatus", () => {
  it("should not ask the route once the signal is aborted", async () => {
    answerStatus(null);
    const client = createTestClient();
    await signInAs(client, SIGNED_IN_USER_ID);
    const controller = new AbortController();
    controller.abort();

    await expect(getAssistantStatus(client, FUNCTIONS_URL, controller.signal)).rejects.toThrow();

    expect(statusRequests).toHaveLength(0);
  });
});
