import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { TargetsValidationError, useUpdateTargets } from "../../src/hooks/useUpdateTargets";
import { keys } from "../../src/queryKeys";
import { activeProgram, programsRead } from "../support/liveTargetsFake";
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

let updates: unknown[] = [];
let updatedIds: (string | null)[] = [];

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  updates = [];
  updatedIds = [];
  server.use(
    // Most cases are about the profile write, so by default the user has no program to end.
    programsRead([]),
    http.get(AUTH_USER_URL, () =>
      HttpResponse.json({ id: SIGNED_IN_USER_ID, aud: "authenticated", role: "authenticated" }),
    ),
    http.patch(`${REST_URL}/profiles`, async ({ request }) => {
      updates.push(await request.json());
      updatedIds.push(new URL(request.url).searchParams.get("id"));
      return postgrestRows(request, [
        { target_kcal: 2200, target_protein_g: 160, target_carbs_g: 220, target_fat_g: 70 },
      ]);
    }),
  );
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const valid = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };

async function renderSignedIn() {
  const rendered = createWrapper();
  await signInAs(rendered.client, SIGNED_IN_USER_ID);
  const hook = renderHook(() => useUpdateTargets(), { wrapper: rendered.wrapper });
  return { ...rendered, ...hook };
}

describe("useUpdateTargets", () => {
  it("should save the targets on the signed in user's own profile row", async () => {
    const { result } = await renderSignedIn();

    await act(async () => {
      await result.current.mutateAsync(valid);
    });

    expect(updatedIds).toEqual([`eq.${SIGNED_IN_USER_ID}`]);
    expect(updates[0]).toMatchObject({ target_kcal: 2200, target_protein_g: 160 });
  });

  it("should resolve to the saved targets and put them in the targets cache", async () => {
    const { queryClient, result } = await renderSignedIn();

    let saved: unknown;
    await act(async () => {
      saved = await result.current.mutateAsync(valid);
    });

    expect(saved).toEqual({ ...valid, source: "manual" });
    expect(queryClient.getQueryData(keys.profiles.targets)).toEqual({ ...valid, source: "manual" });
  });

  it("should invalidate the targets, so they are read again from where they now come from", async () => {
    const { queryClient, result } = await renderSignedIn();

    await act(async () => {
      await result.current.mutateAsync(valid);
    });

    expect(queryClient.getQueryState(keys.profiles.targets)?.isInvalidated).toBe(true);
  });

  it("should invalidate the program reads, so the program screen stops showing a program that has ended", async () => {
    const { queryClient, result } = await renderSignedIn();
    queryClient.setQueryData(keys.program.summary, { isActive: true });
    queryClient.setQueryData(keys.program.targetsHistory(12), []);

    await act(async () => {
      await result.current.mutateAsync(valid);
    });

    expect(queryClient.getQueryState(keys.program.summary)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keys.program.targetsHistory(12))?.isInvalidated).toBe(true);
  });

  describe("while a program is active", () => {
    let programWrites: unknown[] = [];

    beforeEach(() => {
      programWrites = [];
      server.use(
        programsRead([activeProgram]),
        http.get(`${REST_URL}/profiles`, ({ request }) =>
          postgrestRows(request, [{ timezone: "Europe/London" }]),
        ),
        http.patch(`${REST_URL}/programs`, async ({ request }) => {
          programWrites.push(await request.json());
          return postgrestRows(request, [activeProgram]);
        }),
      );
    });

    it("should end the program with ended_on and updated_at only, and then save the profile", async () => {
      const { result } = await renderSignedIn();

      await act(async () => {
        await result.current.mutateAsync(valid);
      });

      expect(programWrites).toHaveLength(1);
      // Exactly these two keys, and nothing else: a strict schema refuses any other.
      expect(() =>
        z
          .strictObject({ ended_on: z.iso.date(), updated_at: z.iso.datetime() })
          .parse(programWrites[0]),
      ).not.toThrow();
      expect(updates).toHaveLength(1);
    });

    it("should save nothing and leave the caches alone when ending the program fails", async () => {
      server.use(
        http.patch(`${REST_URL}/programs`, () => postgrestError(500, "XX000", "unavailable")),
      );
      const { queryClient, result } = await renderSignedIn();
      queryClient.setQueryData(keys.diary.day("2026-10-15"), { localDate: "2026-10-15" });

      await act(async () => {
        await result.current.mutateAsync(valid).catch(() => undefined);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(result.current.error).toHaveProperty("cause.code", "XX000");
      expect(updates).toEqual([]);
      expect(queryClient.getQueryData(keys.profiles.targets)).toBeUndefined();
      expect(queryClient.getQueryState(keys.diary.day("2026-10-15"))?.isInvalidated).toBe(false);
    });
  });

  it("should invalidate the diary, so the progress bars read the new targets with the day", async () => {
    const { queryClient, result } = await renderSignedIn();
    queryClient.setQueryData(keys.diary.day("2026-10-15"), { localDate: "2026-10-15" });
    queryClient.setQueryData(keys.diary.week("2026-10-12"), []);

    await act(async () => {
      await result.current.mutateAsync(valid);
    });

    expect(queryClient.getQueryState(keys.diary.day("2026-10-15"))?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(keys.diary.week("2026-10-12"))?.isInvalidated).toBe(true);
  });

  it("should not touch the terms acceptance, which the gate reads", async () => {
    const { queryClient, result } = await renderSignedIn();
    queryClient.setQueryData(keys.profiles.termsAcceptance, { terms_version: "2026-10-15" });

    await act(async () => {
      await result.current.mutateAsync(valid);
    });

    expect(queryClient.getQueryState(keys.profiles.termsAcceptance)?.isInvalidated).toBe(false);
  });

  it.each([
    ["no calories", { ...valid, kcal: null }, "required"],
    ["calories below 800", { ...valid, kcal: 799 }, "out_of_range"],
    ["calories above 6,000", { ...valid, kcal: 6001 }, "out_of_range"],
  ])(
    "should refuse %s before any request is made, naming the field and not the value",
    async (_name, input, problem) => {
      const { result } = await renderSignedIn();

      await act(async () => {
        await result.current.mutateAsync(input).catch(() => undefined);
      });

      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });
      expect(updates).toEqual([]);
      expect(result.current.error).toBeInstanceOf(TargetsValidationError);
      expect(result.current.error).toHaveProperty("problems", { kcal: problem });
      expect(result.current.error).toHaveProperty("message", "Invalid targets: kcal");
    },
  );

  it("should refuse a negative macro", async () => {
    const { result } = await renderSignedIn();

    await act(async () => {
      await result.current.mutateAsync({ ...valid, fat_g: -1 }).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(updates).toEqual([]);
    expect(result.current.error).toHaveProperty("problems", { fat_g: "negative" });
  });

  it("should accept the lowest and highest calories and blank macros", async () => {
    const { result } = await renderSignedIn();

    await act(async () => {
      await result.current.mutateAsync({ kcal: 800, protein_g: null, carbs_g: null, fat_g: null });
      await result.current.mutateAsync({ kcal: 6000, protein_g: 0, carbs_g: 0, fat_g: 0 });
    });

    expect(updates).toHaveLength(2);
  });

  it("should resolve without waiting for the diary to read again", async () => {
    const { queryClient, result } = await renderSignedIn();
    // A read that never finishes, as a slow connection gives.
    const invalidate = vi
      .spyOn(queryClient, "invalidateQueries")
      .mockReturnValue(new Promise(() => undefined));

    let saved: unknown;
    await act(async () => {
      saved = await result.current.mutateAsync(valid);
    });

    expect(saved).toEqual({ ...valid, source: "manual" });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: keys.diary.all });
  });

  it("should leave the diary, the program reads and the cached targets alone and expose the error when the save fails", async () => {
    server.use(
      http.patch(`${REST_URL}/profiles`, () =>
        postgrestError(500, "XX000", "database unavailable"),
      ),
    );
    const { queryClient, result } = await renderSignedIn();
    queryClient.setQueryData(keys.diary.day("2026-10-15"), { localDate: "2026-10-15" });
    queryClient.setQueryData(keys.program.summary, { isActive: true });

    await act(async () => {
      await result.current.mutateAsync(valid).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toHaveProperty("cause.code", "XX000");
    expect(queryClient.getQueryState(keys.program.summary)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryData(keys.profiles.targets)).toBeUndefined();
    expect(queryClient.getQueryState(keys.diary.day("2026-10-15"))?.isInvalidated).toBe(false);
  });

  it("should fail with a sentence and no request when nobody is signed in", async () => {
    server.use(
      http.get(AUTH_USER_URL, () =>
        HttpResponse.json({ message: "no session", code: 401 }, { status: 401 }),
      ),
    );
    const rendered = createWrapper();
    const { result } = renderHook(() => useUpdateTargets(), { wrapper: rendered.wrapper });

    await act(async () => {
      await result.current.mutateAsync(valid).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(updates).toEqual([]);
    expect(result.current.error).toHaveProperty("message", "You must be signed in to save targets");
  });
});
