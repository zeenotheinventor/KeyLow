import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useSaveSetup } from "../../src/hooks/useSaveSetup";
import { keys } from "../../src/queryKeys";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
import { installSetupSaveFake } from "../support/setupSave";
import { RECOGNISABLE_SETUP_WEIGHT } from "../support/setupState";
import { createWrapper } from "../support/wrapper";

import type { SetupSave } from "../../src/repos/setup";

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
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const save: SetupSave = {
  profile: {
    sex: "female",
    birth_date: "1987-03-09",
    height_cm: 183.4,
    activity: "moderate",
    onboarding_weight_kg: RECOGNISABLE_SETUP_WEIGHT,
    target_kcal: 2310,
    target_protein_g: 167,
    target_carbs_g: 240,
    target_fat_g: 64,
  },
  program: {
    goal: "lose",
    rate_pct_per_week: 0.5,
    protein_g_per_kg: 2,
    fat_fraction_of_remaining: 0.3,
    split_preset: "balanced",
    started_on: "2026-10-24",
  },
  weighIn: { weightKg: RECOGNISABLE_SETUP_WEIGHT, localDate: "2026-10-24" },
};

const input = { save, latestWeighInKg: null, timeZone: "Europe/London" };

async function renderSignedIn() {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  rendered.queryClient.setQueryData(keys.profiles.setupState, { isSetUp: false });
  rendered.queryClient.setQueryData(keys.profiles.targets, { kcal: null });
  rendered.queryClient.setQueryData(keys.weighIns.list, []);
  rendered.queryClient.setQueryData(keys.profiles.weightUnit, "kg");
  rendered.queryClient.setQueryData(keys.diary.day("2026-10-24"), { localDate: "2026-10-24" });
  rendered.queryClient.setQueryData(keys.diary.week("2026-10-19"), []);
  rendered.queryClient.setQueryData(keys.profiles.termsAcceptance, { terms_version: "x" });
  const hook = renderHook(() => useSaveSetup(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

const isInvalidated = (
  queryClient: ReturnType<typeof createWrapper>["queryClient"],
  key: readonly unknown[],
) => queryClient.getQueryState(key)?.isInvalidated;

describe("useSaveSetup", () => {
  it("should save the setup on the signed in user's own profile row", async () => {
    const fake = installSetupSaveFake(server);
    const { result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(input));

    expect(fake.order()).toEqual([
      "POST weigh_ins",
      "GET programs",
      "POST programs",
      "PATCH profiles",
    ]);
    expect(fake.searchOf("PATCH profiles")?.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
  });

  it("should invalidate the setup state, the targets and the weigh-ins, which the weight trend is worked out from, on success", async () => {
    installSetupSaveFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(input));

    expect(isInvalidated(queryClient, keys.profiles.setupState)).toBe(true);
    expect(isInvalidated(queryClient, keys.profiles.targets)).toBe(true);
    expect(isInvalidated(queryClient, keys.weighIns.list)).toBe(true);
  });

  it("should invalidate the weight unit, which a first save by someone who chose lb sets, on success", async () => {
    installSetupSaveFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(input));

    expect(isInvalidated(queryClient, keys.profiles.weightUnit)).toBe(true);
  });

  it("should invalidate the diary, so the progress bars read the new targets at once, on success", async () => {
    installSetupSaveFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(input));

    expect(isInvalidated(queryClient, keys.diary.day("2026-10-24"))).toBe(true);
    expect(isInvalidated(queryClient, keys.diary.week("2026-10-19"))).toBe(true);
  });

  it("should not touch the terms acceptance, which the gate reads", async () => {
    installSetupSaveFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(input));

    expect(isInvalidated(queryClient, keys.profiles.termsAcceptance)).toBe(false);
  });

  it.each([
    ["the weigh-in", "POST weigh_ins"],
    ["the program", "POST programs"],
    ["the profile", "PATCH profiles"],
  ] as const)("should invalidate nothing when %s fails", async (_name, requestKey) => {
    const fake = installSetupSaveFake(server);
    fake.failWith(requestKey, "42501");
    const { queryClient, result } = await renderSignedIn();

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toMatch(/^Could not save your setup \(/);
    expect(isInvalidated(queryClient, keys.profiles.setupState)).toBe(false);
    expect(isInvalidated(queryClient, keys.profiles.targets)).toBe(false);
    expect(isInvalidated(queryClient, keys.weighIns.list)).toBe(false);
    expect(isInvalidated(queryClient, keys.profiles.weightUnit)).toBe(false);
    expect(isInvalidated(queryClient, keys.diary.day("2026-10-24"))).toBe(false);
    expect(isInvalidated(queryClient, keys.diary.week("2026-10-19"))).toBe(false);
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
      await result.current.mutateAsync(input).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("You must be signed in to save your setup");
    expect(fake.calls).toEqual([]);
  });
});
