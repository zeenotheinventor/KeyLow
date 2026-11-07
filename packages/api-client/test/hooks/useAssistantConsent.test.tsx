import { ASSISTANT_CONSENT_VERSION } from "@keylow/core";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useAssistantConsent } from "../../src/hooks/useAssistantConsent";
import { useSetAssistantConsent } from "../../src/hooks/useSetAssistantConsent";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  postgrestError,
  postgrestRows,
  signInAs,
} from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

type ConsentColumns = {
  assistant_consent_at: string | null;
  assistant_consent_version: string | null;
};

const notConsented: ConsentColumns = {
  assistant_consent_at: null,
  assistant_consent_version: null,
};

let stored: ConsentColumns = notConsented;
let patches: { url: string; body: unknown }[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  stored = notConsented;
  patches = [];
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
    http.get(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [stored])),
    http.patch<never, ConsentColumns>(`${REST_URL}/profiles`, async ({ request }) => {
      const body = await request.clone().json();
      patches.push({ url: request.url, body });
      stored = body;
      return postgrestRows(request, [{ id: SIGNED_IN_USER_ID }]);
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

async function renderSignedIn() {
  const client = createTestClient();
  await signInAs(client, SIGNED_IN_USER_ID);
  const { queryClient, wrapper } = createWrapper(client);
  return { queryClient, wrapper };
}

describe("useAssistantConsent", () => {
  it("should read the assistant as off for a profile that never consented", async () => {
    const { wrapper } = await renderSignedIn();

    const { result } = renderHook(() => useAssistantConsent(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ isOn: false, consentedAt: null, version: null });
  });

  it("should read the assistant as on, with when and which version, once consented", async () => {
    stored = {
      assistant_consent_at: "2026-11-08T09:00:00+00:00",
      assistant_consent_version: ASSISTANT_CONSENT_VERSION,
    };
    const { wrapper } = await renderSignedIn();

    const { result } = renderHook(() => useAssistantConsent(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      isOn: true,
      consentedAt: "2026-11-08T09:00:00+00:00",
      version: ASSISTANT_CONSENT_VERSION,
    });
  });

  it("should read the assistant as off, keeping the version, when it was turned on under older words", async () => {
    stored = {
      assistant_consent_at: "2026-11-03T09:00:00+00:00",
      assistant_consent_version: "2026-10-26",
    };
    const { wrapper } = await renderSignedIn();

    const { result } = renderHook(() => useAssistantConsent(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({
      isOn: false,
      consentedAt: "2026-11-03T09:00:00+00:00",
      version: "2026-10-26",
    });
  });

  it("should make no request while it is disabled, as under the terms gate", async () => {
    let reads = 0;
    server.use(
      http.get(`${REST_URL}/profiles`, ({ request }) => {
        reads += 1;
        return postgrestRows(request, [stored]);
      }),
    );
    const { wrapper } = await renderSignedIn();

    const { result } = renderHook(() => useAssistantConsent({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(result.current.fetchStatus).toBe("idle");
    expect(result.current.data).toBeUndefined();
    expect(reads).toBe(0);
  });

  it("should read the assistant as off when there is no profile row", async () => {
    server.use(http.get(`${REST_URL}/profiles`, () => HttpResponse.json([])));
    const { wrapper } = await renderSignedIn();

    const { result } = renderHook(() => useAssistantConsent(), { wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
    expect(result.current.data).toEqual({ isOn: false, consentedAt: null, version: null });
  });
});

describe("useSetAssistantConsent", () => {
  it("should write the time now and the current assistant consent version to the signed in user's own row when turning on", async () => {
    const before = Date.now();
    const { wrapper } = await renderSignedIn();
    const { result } = renderHook(() => useSetAssistantConsent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ on: true });
    });

    expect(patches).toHaveLength(1);
    expect(new URL(patches[0]?.url ?? "").searchParams.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
    expect(Object.keys(patches[0]?.body ?? {}).sort()).toEqual([
      "assistant_consent_at",
      "assistant_consent_version",
    ]);
    expect(stored.assistant_consent_version).toBe(ASSISTANT_CONSENT_VERSION);
    expect(Date.parse(stored.assistant_consent_at ?? "")).toBeGreaterThanOrEqual(before);
    expect(Date.parse(stored.assistant_consent_at ?? "")).toBeLessThanOrEqual(Date.now());
  });

  it("should clear both columns when turning off", async () => {
    stored = {
      assistant_consent_at: "2026-11-03T09:00:00+00:00",
      assistant_consent_version: "2026-10-26",
    };
    const { wrapper } = await renderSignedIn();
    const { result } = renderHook(() => useSetAssistantConsent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ on: false });
    });

    expect(patches.map((patch) => patch.body)).toEqual([notConsented]);
  });

  it("should have read the consent and the status again by the time the mutation resolves", async () => {
    const { queryClient, wrapper } = await renderSignedIn();
    queryClient.setQueryData(keys.assistant.status, { notice: { code: "consent_needed" } });
    const { result } = renderHook(
      () => ({ consent: useAssistantConsent(), set: useSetAssistantConsent() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.consent.isSuccess).toBe(true);
    });

    await act(async () => {
      await result.current.set.mutateAsync({ on: true });
    });

    expect(queryClient.getQueryData(keys.assistant.consent)).toMatchObject({ isOn: true });
    expect(queryClient.getQueryState(keys.assistant.status)?.isInvalidated).toBe(true);
  });

  it("should fail, and leave the cache alone, when no row was changed", async () => {
    server.use(http.patch(`${REST_URL}/profiles`, ({ request }) => postgrestRows(request, [])));
    const { queryClient, wrapper } = await renderSignedIn();
    queryClient.setQueryData(keys.assistant.consent, {
      isOn: false,
      consentedAt: null,
      version: null,
    });
    const { result } = renderHook(() => useSetAssistantConsent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ on: true }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(queryClient.getQueryState(keys.assistant.consent)?.isInvalidated).toBe(false);
  });

  it("should expose the database error when the write is refused", async () => {
    server.use(
      http.patch(`${REST_URL}/profiles`, () =>
        postgrestError(403, "42501", "permission denied for table profiles"),
      ),
    );
    const { wrapper } = await renderSignedIn();
    const { result } = renderHook(() => useSetAssistantConsent(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ on: true }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.error).toHaveProperty("cause.code", "42501");
    });
  });
});
