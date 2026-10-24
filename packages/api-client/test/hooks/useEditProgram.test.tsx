import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { useEditProgram } from "../../src/hooks/useEditProgram";
import { keys } from "../../src/queryKeys";
import { AUTH_USER_URL, SIGNED_IN_USER_ID, signInAs } from "../support/postgrest";
import { RECOMPUTED_TARGETS_ID, installProgramEditFake } from "../support/programEdit";
import { createWrapper } from "../support/wrapper";

import type { ProgramChanges } from "../../src/repos/program";

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

const changes: ProgramChanges = {
  goal: "maintain",
  ratePctPerWeek: 0,
  proteinGPerKg: 2,
  fatFraction: 0.28,
  splitPreset: "low_fat",
};

const input = { changes, today: "2026-10-24" };

async function renderSignedIn() {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  rendered.queryClient.setQueryData(keys.profiles.targets, { kcal: 2000 });
  rendered.queryClient.setQueryData(keys.program.summary, { program: null });
  rendered.queryClient.setQueryData(keys.program.expenditureHistory(12), []);
  rendered.queryClient.setQueryData(keys.program.targetsHistory(12), []);
  rendered.queryClient.setQueryData(keys.profiles.termsAcceptance, { terms_version: "x" });
  const hook = renderHook(() => useEditProgram(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

const isInvalidated = (
  queryClient: ReturnType<typeof createWrapper>["queryClient"],
  key: readonly unknown[],
) => queryClient.getQueryState(key)?.isInvalidated;

describe("useEditProgram", () => {
  it("should update the program and recompute for the signed in user, and resolve with the new targets id", async () => {
    const fake = installProgramEditFake(server);
    const { result } = await renderSignedIn();

    const answer = await act(() => result.current.mutateAsync(input));

    expect(fake.order()).toEqual(["GET profiles", "PATCH programs", "POST run-checkin"]);
    expect(fake.searchOf("GET profiles")?.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
    expect(answer).toEqual({ targetsId: RECOMPUTED_TARGETS_ID });
  });

  it.each([
    ["the targets", keys.profiles.targets],
    ["the program summary", keys.program.summary],
    ["the expenditure history", keys.program.expenditureHistory(12)],
    ["the targets history", keys.program.targetsHistory(12)],
  ] as const)("should invalidate %s on success", async (_name, key) => {
    installProgramEditFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(input));

    expect(isInvalidated(queryClient, key)).toBe(true);
  });

  it("should send its requests and settle while the connection manager says offline", async () => {
    const fake = installProgramEditFake(server);
    const { result } = await renderSignedIn();
    onlineManager.setOnline(false);

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(fake.order()).toEqual(["GET profiles", "PATCH programs", "POST run-checkin"]);
  });

  it("should not touch the terms acceptance, which the gate reads", async () => {
    installProgramEditFake(server);
    const { queryClient, result } = await renderSignedIn();

    await act(() => result.current.mutateAsync(input));

    expect(isInvalidated(queryClient, keys.profiles.termsAcceptance)).toBe(false);
  });

  it("should reject an under-18 lose goal before any write", async () => {
    const fake = installProgramEditFake(server, { birthDate: "2010-06-15" });
    const { result } = await renderSignedIn();

    await act(async () => {
      await result.current
        .mutateAsync({
          changes: { ...changes, goal: "lose", ratePctPerWeek: 0.5 },
          today: "2026-10-24",
        })
        .catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(RangeError);
    expect(fake.order()).toEqual(["GET profiles"]);
  });

  it("should reject with the typed edge error when the recompute is refused", async () => {
    const fake = installProgramEditFake(server);
    fake.recomputeRefusedWith(409, "missing_stats");
    const { result } = await renderSignedIn();

    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toMatchObject({ code: "missing_stats", status: 409 });
  });

  it.each([
    ["the targets", keys.profiles.targets],
    ["the program summary", keys.program.summary],
    ["the expenditure history", keys.program.expenditureHistory(12)],
    ["the targets history", keys.program.targetsHistory(12)],
  ] as const)(
    "should invalidate %s when the recompute is refused, because the program row changed",
    async (_name, key) => {
      const fake = installProgramEditFake(server);
      fake.recomputeRefusedWith(409, "missing_stats");
      const { queryClient, result } = await renderSignedIn();

      await act(async () => {
        await result.current.mutateAsync(input).catch(() => undefined);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(isInvalidated(queryClient, key)).toBe(true);
    },
  );

  it("should refuse before any request when nobody is signed in", async () => {
    const fake = installProgramEditFake(server);
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
    expect(result.current.error?.message).toBe("You must be signed in to edit your program");
    expect(fake.calls).toEqual([]);
  });
});
