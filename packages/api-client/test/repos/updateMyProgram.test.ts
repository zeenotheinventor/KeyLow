import { FunctionsHttpError } from "@supabase/supabase-js";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { EdgeFunctionError } from "../../src/errors";
import { recomputeMyTargets, updateMyProgram } from "../../src/repos/program";
import { createTestClient } from "../createTestClient";
import { SIGNED_IN_USER_ID } from "../support/postgrest";
import {
  RECOMPUTED_TARGETS_ID,
  RUN_CHECKIN_URL,
  installProgramEditFake,
} from "../support/programEdit";

import type { ProgramChanges } from "../../src/repos/program";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-24T09:30:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

const NOW = "2026-10-24T09:30:00.000Z";
const TODAY = "2026-10-24";

const changes: ProgramChanges = {
  goal: "maintain",
  ratePctPerWeek: 0,
  proteinGPerKg: 2,
  fatFraction: 0.28,
  splitPreset: "low_fat",
};

const run = (overrides: Partial<ProgramChanges> = {}, today = TODAY) =>
  updateMyProgram(createTestClient(), SIGNED_IN_USER_ID, { ...changes, ...overrides }, { today });

const thrownBy = (action: () => Promise<unknown>) =>
  action().then(
    () => null,
    (thrown: unknown) => thrown,
  );

const spyOnConsole = () =>
  (["log", "info", "warn", "error", "debug"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );

const sortedKeys = (body: unknown) =>
  typeof body === "object" && body !== null ? Object.keys(body).sort() : [];

describe("updateMyProgram", () => {
  describe("the writes", () => {
    it("should read the birth date, update the active program, then recompute, in that order", async () => {
      const fake = installProgramEditFake(server);

      await run();

      expect(fake.order()).toEqual(["GET profiles", "PATCH programs", "POST run-checkin"]);
    });

    it("should update exactly the six columns of Amendment 12's recalculation, and nothing else", async () => {
      const fake = installProgramEditFake(server);

      await run();

      expect(sortedKeys(fake.bodyOf("PATCH programs"))).toEqual([
        "fat_fraction_of_remaining",
        "goal",
        "protein_g_per_kg",
        "rate_pct_per_week",
        "split_preset",
        "updated_at",
      ]);
      expect(fake.bodyOf("PATCH programs")).toEqual({
        goal: "maintain",
        rate_pct_per_week: 0,
        protein_g_per_kg: 2,
        fat_fraction_of_remaining: 0.28,
        split_preset: "low_fat",
        updated_at: NOW,
      });
    });

    it("should never write started_on, the offsets, the goal weight, the schedule or the end, even if the changes carry them", async () => {
      const fake = installProgramEditFake(server);
      const greedy = {
        ...changes,
        started_on: "2020-01-01",
        dow_offsets_kcal: [1, 2, 3, 4, 5, 6, 7],
        goal_weight_kg: 70,
        next_checkin_date: "2026-11-01",
        ended_on: "2026-10-30",
      };

      await updateMyProgram(createTestClient(), SIGNED_IN_USER_ID, greedy, { today: TODAY });

      expect(sortedKeys(fake.bodyOf("PATCH programs"))).toEqual([
        "fat_fraction_of_remaining",
        "goal",
        "protein_g_per_kg",
        "rate_pct_per_week",
        "split_preset",
        "updated_at",
      ]);
    });

    it("should update the active program of the signed in user only, and read that user's birth date", async () => {
      const fake = installProgramEditFake(server);

      await run();

      expect(fake.searchOf("PATCH programs")?.get("user_id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
      expect(fake.searchOf("PATCH programs")?.get("ended_on")).toBe("is.null");
      expect(fake.searchOf("GET profiles")?.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
      expect(fake.searchOf("GET profiles")?.get("select")).toBe("birth_date");
    });

    it("should post the recompute mode and answer with the new targets id", async () => {
      const fake = installProgramEditFake(server);

      const answer = await run();

      expect(fake.bodyOf("POST run-checkin")).toEqual({ mode: "recompute" });
      expect(answer).toEqual({ targetsId: RECOMPUTED_TARGETS_ID });
    });

    it.each([
      ["lose", 0.75, "balanced", 0.4, 1.6],
      ["gain", 0.1, "low_carb", 0.6, 2.2],
      ["maintain", 0, "balanced", 0.4, 2],
    ] as const)(
      "should accept the %s goal with preset values",
      async (goal, ratePctPerWeek, splitPreset, fatFraction, proteinGPerKg) => {
        const fake = installProgramEditFake(server);

        await run({ goal, ratePctPerWeek, splitPreset, fatFraction, proteinGPerKg });

        expect(fake.order()).toContain("PATCH programs");
      },
    );
  });

  describe("the age rule", () => {
    it("should refuse a lose goal for someone under 18 before any write, with a RangeError that names the rule and not the age", async () => {
      const fake = installProgramEditFake(server, { birthDate: "2010-06-15" });
      const consoleSpies = spyOnConsole();

      const failure = await thrownBy(() => run({ goal: "lose", ratePctPerWeek: 0.5 }));

      expect(failure).toBeInstanceOf(RangeError);
      expect(failure).toHaveProperty("message", "The lose goal is not allowed under 18");
      expect(fake.order()).toEqual(["GET profiles"]);
      expect(failure instanceof Error ? failure.message : "").not.toMatch(/2010|16/);
      for (const spy of consoleSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it("should refuse a lose goal on the day before the 18th birthday", async () => {
      const fake = installProgramEditFake(server, { birthDate: "2008-10-25" });

      await expect(run({ goal: "lose", ratePctPerWeek: 0.5 })).rejects.toBeInstanceOf(RangeError);

      expect(fake.order()).toEqual(["GET profiles"]);
    });

    it("should work the age out from the today it is given and not from the clock", async () => {
      const fake = installProgramEditFake(server, { birthDate: "2008-10-25" });
      vi.setSystemTime(new Date("2030-01-01T09:30:00Z"));

      await expect(run({ goal: "lose", ratePctPerWeek: 0.5 }, "2026-10-24")).rejects.toBeInstanceOf(
        RangeError,
      );
      expect(fake.order()).toEqual(["GET profiles"]);

      vi.setSystemTime(new Date("2026-10-24T09:30:00Z"));
      await run({ goal: "lose", ratePctPerWeek: 0.5 }, "2026-10-25");

      expect(fake.order()).toContain("PATCH programs");
    });

    it("should allow a lose goal on the 18th birthday", async () => {
      const fake = installProgramEditFake(server, { birthDate: "2008-10-24" });

      await run({ goal: "lose", ratePctPerWeek: 0.5 });

      expect(fake.order()).toContain("PATCH programs");
    });

    it.each(["maintain", "gain"] as const)(
      "should allow the %s goal for someone under 18",
      async (goal) => {
        const fake = installProgramEditFake(server, { birthDate: "2010-06-15" });

        await run({
          goal,
          ratePctPerWeek: goal === "gain" ? 0.25 : 0,
        });

        expect(fake.order()).toEqual(["GET profiles", "PATCH programs", "POST run-checkin"]);
      },
    );

    it("should not accept a lose goal when the profile has no birth date, because adulthood cannot be shown", async () => {
      const fake = installProgramEditFake(server, { birthDate: null });

      await expect(run({ goal: "lose", ratePctPerWeek: 0.5 })).rejects.toBeInstanceOf(RangeError);

      expect(fake.order()).toEqual(["GET profiles"]);
    });

    it("should still allow a goal that every age may choose when the profile has no birth date", async () => {
      const fake = installProgramEditFake(server, { birthDate: null });

      await run({ goal: "maintain", ratePctPerWeek: 0 });

      expect(fake.order()).toEqual(["GET profiles", "PATCH programs", "POST run-checkin"]);
    });
  });

  describe("changes that are not the wizard's presets", () => {
    it.each([
      ["a goal that does not exist", { goal: "bulk" }, "goal"],
      ["a rate that is not one of the goal's presets", { ratePctPerWeek: 0.6 }, "ratePctPerWeek"],
      [
        "a lose rate on a maintain goal",
        { goal: "maintain", ratePctPerWeek: 0.5 },
        "ratePctPerWeek",
      ],
      ["a protein that is not a preset", { proteinGPerKg: 3.1 }, "proteinGPerKg"],
      ["a diet style that does not exist", { splitPreset: "keto" }, "splitPreset"],
      ["a fat fraction that is not the diet style's", { fatFraction: 0.5 }, "fatFraction"],
    ] satisfies [string, Record<string, unknown>, string][])(
      "should refuse %s before any request, naming the field and no value",
      async (_name, bad, field) => {
        const fake = installProgramEditFake(server);

        const failure = await thrownBy(() =>
          updateMyProgram(createTestClient(), SIGNED_IN_USER_ID, Object.assign({}, changes, bad), {
            today: TODAY,
          }),
        );

        expect(failure).toBeInstanceOf(RangeError);
        expect(failure).toHaveProperty("message", `Invalid program changes: ${field}`);
        expect(fake.calls).toEqual([]);
      },
    );

    it("should refuse a today that is not a calendar day, without a value in the message", async () => {
      const fake = installProgramEditFake(server);

      const failure = await thrownBy(() => run({}, "24/10/2026"));

      expect(failure).toBeInstanceOf(RangeError);
      expect(failure).toHaveProperty("message", "Today must be a calendar date written YYYY-MM-DD");
      expect(fake.calls).toEqual([]);
    });
  });

  describe("a failure", () => {
    it.each([
      ["GET profiles", "42501", ["GET profiles"], "Could not update your program (42501)"],
      [
        "PATCH programs",
        "42501",
        ["GET profiles", "PATCH programs"],
        "Could not update your program (42501)",
      ],
    ] as const)(
      "should stop at %s with the code only and no recompute",
      async (requestName, code, expectedCalls, message) => {
        const fake = installProgramEditFake(server);
        fake.failWith(requestName, code);
        const consoleSpies = spyOnConsole();

        const failure = await thrownBy(() => run({ goal: "lose", ratePctPerWeek: 0.5 }));

        expect(failure).toBeInstanceOf(Error);
        expect(failure).toHaveProperty("message", message);
        expect(failure).toHaveProperty("cause", { code });
        expect(fake.order()).toEqual(expectedCalls);
        expect(
          JSON.stringify(failure instanceof Error ? [failure.message, failure.cause] : null),
        ).not.toContain("83.4");
        for (const spy of consoleSpies) {
          expect(spy).not.toHaveBeenCalled();
        }
      },
    );

    it("should fail with the code PGRST116 when there is no active program to update, and not recompute", async () => {
      const fake = installProgramEditFake(server, {
        programs: [{ id: "88888888-8888-4888-8888-888888888801", ended_on: "2026-10-01" }],
      });

      const failure = await thrownBy(() => run({ goal: "maintain", ratePctPerWeek: 0 }));

      expect(failure).toHaveProperty("message", "Could not update your program (PGRST116)");
      expect(fake.order()).toEqual(["GET profiles", "PATCH programs"]);
    });

    it.each([
      [409, "no_program"],
      [409, "missing_stats"],
      [500, "internal_error"],
    ] as const)(
      "should throw the typed edge error with no value when the recompute answers %s %s, and leave the program written",
      async (status, code) => {
        const fake = installProgramEditFake(server);
        fake.recomputeRefusedWith(status, code);

        const failure = await thrownBy(() => run());

        expect(failure).toBeInstanceOf(EdgeFunctionError);
        expect(failure).toMatchObject({ code, status });
        expect(fake.programs[0]).toMatchObject({ goal: "maintain", split_preset: "low_fat" });
      },
    );

    it("should carry the 409 as the cause so a caller can read the status", async () => {
      const fake = installProgramEditFake(server);
      fake.recomputeRefusedWith(409, "no_program");

      const failure = await thrownBy(() => run());

      expect(failure).toHaveProperty("cause");
      expect(failure instanceof Error && failure.cause instanceof FunctionsHttpError).toBe(true);
    });
  });
});

describe("recomputeMyTargets", () => {
  it("should post the recompute mode to run-checkin and give back the targets id", async () => {
    const fake = installProgramEditFake(server);

    const answer = await recomputeMyTargets(createTestClient());

    expect(fake.order()).toEqual(["POST run-checkin"]);
    expect(fake.bodyOf("POST run-checkin")).toEqual({ mode: "recompute" });
    expect(answer).toEqual({ targetsId: RECOMPUTED_TARGETS_ID });
  });

  it("should reject an answer that is not a targets id", async () => {
    server.use(http.post(RUN_CHECKIN_URL, () => HttpResponse.json({ targetsId: "not-a-uuid" })));

    await expect(recomputeMyTargets(createTestClient())).rejects.toBeInstanceOf(Error);
  });
});
