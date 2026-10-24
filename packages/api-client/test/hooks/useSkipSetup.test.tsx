import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useSkipSetup } from "../../src/hooks/useSkipSetup";
import { keys } from "../../src/queryKeys";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
import { installSetupSaveFake } from "../support/setupSave";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  server.use(
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
  );
});
afterEach(() => {
  onlineManager.setOnline(true);
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

async function renderSignedIn() {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  rendered.queryClient.setQueryData(keys.profiles.setupState, { isSetUp: false });
  rendered.queryClient.setQueryData(keys.profiles.targets, { kcal: null });
  rendered.queryClient.setQueryData(keys.profiles.termsAcceptance, { terms_version: "x" });
  const hook = renderHook(() => useSkipSetup(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

const isInvalidated = (
  queryClient: ReturnType<typeof createWrapper>["queryClient"],
  key: readonly unknown[],
) => queryClient.getQueryState(key)?.isInvalidated;

describe("useSkipSetup", () => {
  it("should mark the signed in user's own profile row set up, with that column only", async () => {
    const fake = installSetupSaveFake(server);
    const { result } = await renderSignedIn();

    await act(() => result.current.mutateAsync());

    expect(fake.order()).toEqual(["PATCH profiles"]);
    expect(fake.searchOf("PATCH profiles")?.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
    expect(Object.keys(fake.bodyOf("PATCH profiles") ?? {})).toEqual(["onboarding_completed_at"]);
  });

  it("should invalidate the setup state on success, so the first run gate reads set up", async () => {
    installSetupSaveFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync());

    expect(isInvalidated(queryClient, keys.profiles.setupState)).toBe(true);
  });

  it("should not touch the targets or the terms acceptance, which are not changed", async () => {
    installSetupSaveFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync());

    expect(isInvalidated(queryClient, keys.profiles.targets)).toBe(false);
    expect(isInvalidated(queryClient, keys.profiles.termsAcceptance)).toBe(false);
  });

  it("should invalidate nothing when the update fails, and name the code only", async () => {
    const fake = installSetupSaveFake(server);
    fake.failWith("PATCH profiles", "42501");
    const { queryClient, result } = await renderSignedIn();

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not mark your setup done (42501)");
    expect(isInvalidated(queryClient, keys.profiles.setupState)).toBe(false);
  });

  it("should refuse before any request when nobody is signed in", async () => {
    const fake = installSetupSaveFake(server);
    const { result } = await renderSignedIn();
    server.use(
      http.get(AUTH_USER_URL, () =>
        HttpResponse.json({ code: 401, msg: "bad jwt" }, { status: 401 }),
      ),
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("You must be signed in to skip your setup");
    expect(fake.calls).toEqual([]);
  });

  it("should send its request and settle while the connection manager says offline", async () => {
    const fake = installSetupSaveFake(server);
    const { result } = await renderSignedIn();
    onlineManager.setOnline(false);

    await act(() => result.current.mutateAsync());

    expect(fake.order()).toEqual(["PATCH profiles"]);
  });
});
