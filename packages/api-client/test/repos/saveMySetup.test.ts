import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { saveMySetup } from "../../src/repos/setup";
import { createTestClient } from "../createTestClient";
import { SIGNED_IN_USER_ID } from "../support/postgrest";
import { installSetupSaveFake } from "../support/setupSave";
import { RECOGNISABLE_SETUP_WEIGHT, programRow } from "../support/setupState";

import type { SaveSetupOptions, SetupSave } from "../../src/repos/setup";

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

const options: SaveSetupOptions = { latestWeighInKg: null, timeZone: "Europe/London" };

const run = (overrides: Partial<SaveSetupOptions> = {}, planned = save) =>
  saveMySetup(createTestClient(), SIGNED_IN_USER_ID, planned, { ...options, ...overrides });

const spyOnConsole = () =>
  (["log", "info", "warn", "error", "debug"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );

const sortedKeys = (body: unknown) =>
  typeof body === "object" && body !== null ? Object.keys(body).sort() : [];

describe("saveMySetup", () => {
  describe("the order of the writes", () => {
    it("should write the weigh-in, then the program, then the profile last", async () => {
      const fake = installSetupSaveFake(server);

      await run();

      expect(fake.order()).toEqual([
        "POST weigh_ins",
        "GET programs",
        "POST programs",
        "PATCH profiles",
      ]);
    });

    it("should update the active program in place and still write the profile last", async () => {
      const fake = installSetupSaveFake(server, { programs: [programRow()] });

      await run();

      expect(fake.order()).toEqual([
        "POST weigh_ins",
        "GET programs",
        "PATCH programs",
        "PATCH profiles",
      ]);
    });
  });

  describe("the weigh-in", () => {
    it("should write a manual weigh-in for today with the weight entered", async () => {
      const fake = installSetupSaveFake(server);

      await run();

      expect(fake.bodyOf("POST weigh_ins")).toEqual({
        weight_kg: 83.417,
        measured_at: NOW,
        local_date: "2026-10-24",
        tz: "Europe/London",
        source: "manual",
        external_id: null,
        note: null,
      });
    });

    it("should date the weigh-in in the time zone it is given", async () => {
      const fake = installSetupSaveFake(server);
      vi.setSystemTime(new Date("2026-10-24T23:30:00Z"));

      await run({ timeZone: "Pacific/Auckland" });

      expect(fake.bodyOf("POST weigh_ins")).toMatchObject({
        local_date: "2026-10-25",
        tz: "Pacific/Auckland",
      });
    });

    it("should write one when there is no latest weigh-in", async () => {
      const fake = installSetupSaveFake(server);

      await run({ latestWeighInKg: null });

      expect(fake.order()).toContain("POST weigh_ins");
    });

    it("should write one when the latest weigh-in has a different weight", async () => {
      const fake = installSetupSaveFake(server);

      await run({ latestWeighInKg: 90.2 });

      expect(fake.order()).toContain("POST weigh_ins");
    });

    it("should skip the weigh-in when the weight equals the latest weigh-in, on any date, and still save the rest", async () => {
      const fake = installSetupSaveFake(server);

      await run({ latestWeighInKg: 83.417 });

      expect(fake.order()).toEqual(["GET programs", "POST programs", "PATCH profiles"]);
    });

    it.each([
      ["0.017 kg below the weight entered", 83.4],
      ["0.05 kg below it, the edge", 83.367],
      ["0.05 kg above it, the edge", 83.467],
    ])(
      "should skip the weigh-in when the latest weigh-in is %s",
      async (_name, latestWeighInKg) => {
        const fake = installSetupSaveFake(server);

        await run({ latestWeighInKg });

        expect(fake.order()).not.toContain("POST weigh_ins");
      },
    );

    it("should skip the weigh-in at the edge when floating point makes the difference a hair over 0.05", async () => {
      const fake = installSetupSaveFake(server);

      await run(
        { latestWeighInKg: 60.051 },
        { ...save, weighIn: { weightKg: 60.001, localDate: "2026-10-24" } },
      );

      expect(fake.order()).not.toContain("POST weigh_ins");
    });

    it.each([
      ["0.051 kg below the weight entered", 83.366],
      ["0.051 kg above it", 83.468],
    ])(
      "should write the weigh-in when the latest weigh-in is %s",
      async (_name, latestWeighInKg) => {
        const fake = installSetupSaveFake(server);

        await run({ latestWeighInKg });

        expect(fake.order()).toContain("POST weigh_ins");
      },
    );
  });

  describe("the program", () => {
    it("should read only the active program", async () => {
      const fake = installSetupSaveFake(server);

      await run();

      expect(fake.searchOf("GET programs")?.get("ended_on")).toBe("is.null");
    });

    it("should insert with exactly the insert columns and their values when there is no program", async () => {
      const fake = installSetupSaveFake(server);

      await run();

      expect(sortedKeys(fake.bodyOf("POST programs"))).toEqual([
        "fat_fraction_of_remaining",
        "goal",
        "protein_g_per_kg",
        "rate_pct_per_week",
        "split_preset",
        "started_on",
        "updated_at",
      ]);
      expect(fake.bodyOf("POST programs")).toEqual({
        goal: "lose",
        rate_pct_per_week: 0.5,
        protein_g_per_kg: 2,
        fat_fraction_of_remaining: 0.3,
        split_preset: "balanced",
        started_on: "2026-10-24",
        updated_at: NOW,
      });
    });

    it("should update the active row by its id with exactly the update columns, never started_on", async () => {
      const fake = installSetupSaveFake(server, {
        programs: [programRow({ id: "88888888-8888-4888-8888-888888888802", goal: "gain" })],
      });

      await run();

      expect(fake.searchOf("PATCH programs")?.get("id")).toBe(
        "eq.88888888-8888-4888-8888-888888888802",
      );
      expect(sortedKeys(fake.bodyOf("PATCH programs"))).toEqual([
        "fat_fraction_of_remaining",
        "goal",
        "protein_g_per_kg",
        "rate_pct_per_week",
        "split_preset",
        "updated_at",
      ]);
      expect(fake.bodyOf("PATCH programs")).toEqual({
        goal: "lose",
        rate_pct_per_week: 0.5,
        protein_g_per_kg: 2,
        fat_fraction_of_remaining: 0.3,
        split_preset: "balanced",
        updated_at: NOW,
      });
    });

    it("should not add a second program when one is active", async () => {
      const fake = installSetupSaveFake(server, { programs: [programRow()] });

      await run();

      expect(fake.order()).not.toContain("POST programs");
      expect(fake.programs).toHaveLength(1);
    });

    describe("the columns the wizard does not own, even if the plan object carries them", () => {
      const greedyProgram = {
        ...save.program,
        dow_offsets_kcal: [1, 2, 3, 4, 5, 6, 7],
        goal_weight_kg: 70,
        next_checkin_date: "2026-11-01",
        ended_on: "2026-10-30",
      };
      const forbidden = ["dow_offsets_kcal", "goal_weight_kg", "next_checkin_date", "ended_on"];

      it("should not write them on the insert", async () => {
        const fake = installSetupSaveFake(server);

        await run({}, { ...save, program: greedyProgram });

        expect(
          sortedKeys(fake.bodyOf("POST programs")).filter((c) => forbidden.includes(c)),
        ).toEqual([]);
      });

      it("should not write them on the update", async () => {
        const fake = installSetupSaveFake(server, { programs: [programRow()] });

        await run({}, { ...save, program: greedyProgram });

        expect(
          sortedKeys(fake.bodyOf("PATCH programs")).filter((c) => forbidden.includes(c)),
        ).toEqual([]);
      });
    });

    it("should refuse a first save that races another with the program step and the code, then update on the retry", async () => {
      const fake = installSetupSaveFake(server);
      fake.failWith("POST programs", "23505");

      await expect(run()).rejects.toThrow("Could not save your setup (program, 23505)");
      expect(fake.order()).not.toContain("PATCH profiles");

      fake.failWith("POST programs", null);
      fake.programs.push(programRow());
      await run();

      expect(fake.order().slice(-2)).toEqual(["PATCH programs", "PATCH profiles"]);
    });
  });

  describe("the program update", () => {
    it("should fail with the program step and not save the profile when the active row ended before the update", async () => {
      const fake = installSetupSaveFake(server, { programs: [programRow()], patchMatches: false });

      await expect(run()).rejects.toThrow("Could not save your setup (program, PGRST116)");

      expect(fake.order()).not.toContain("PATCH profiles");
    });
  });

  describe("the profile", () => {
    it("should update the user's own row with exactly the allowed columns and no weight_unit", async () => {
      const fake = installSetupSaveFake(server);

      await run();

      expect(fake.searchOf("PATCH profiles")?.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
      expect(sortedKeys(fake.bodyOf("PATCH profiles"))).toEqual([
        "activity",
        "birth_date",
        "height_cm",
        "onboarding_completed_at",
        "onboarding_weight_kg",
        "sex",
        "target_carbs_g",
        "target_fat_g",
        "target_kcal",
        "target_protein_g",
        "targets_updated_at",
      ]);
      expect(fake.bodyOf("PATCH profiles")).toEqual({
        sex: "female",
        birth_date: "1987-03-09",
        height_cm: 183.4,
        activity: "moderate",
        onboarding_weight_kg: 83.417,
        target_kcal: 2310,
        target_protein_g: 167,
        target_carbs_g: 240,
        target_fat_g: 64,
        targets_updated_at: NOW,
        onboarding_completed_at: NOW,
      });
    });

    it("should write weight_unit when the plan carries it", async () => {
      const fake = installSetupSaveFake(server);

      await run({}, { ...save, profile: { ...save.profile, weight_unit: "lb" } });

      expect(fake.bodyOf("PATCH profiles")).toMatchObject({ weight_unit: "lb" });
    });

    it("should never write an id or a terms column, even if the plan object carries them", async () => {
      const fake = installSetupSaveFake(server);
      const greedyProfile = {
        ...save.profile,
        id: "11111111-1111-4111-8111-111111111112",
        terms_version: "2026-10-15",
        terms_accepted_at: NOW,
      };

      await run({}, { ...save, profile: greedyProfile });

      const columns = sortedKeys(fake.bodyOf("PATCH profiles"));
      expect(columns).not.toContain("id");
      expect(columns).not.toContain("terms_version");
      expect(columns).not.toContain("terms_accepted_at");
    });

    it("should fail with the profile step when the update matches no row", async () => {
      installSetupSaveFake(server, { profileExists: false });

      await expect(run()).rejects.toThrow("Could not save your setup (profile, PGRST116)");
    });
  });

  describe("a failure", () => {
    it("should stop at a weigh-in row that would not parse, with a message that holds no weight", async () => {
      const fake = installSetupSaveFake(server, { malformedWeighIn: true });
      const consoleSpies = spyOnConsole();

      const failure = await run().then(
        () => undefined,
        (error: unknown) => error,
      );

      expect(failure).toHaveProperty(
        "message",
        "Could not read the new weigh-in: row 99999999-9999-4999-8999-999999999902 has an unexpected shape at measured_at, local_date, tz, weight_kg, source, note",
      );
      expect(fake.order()).toEqual(["POST weigh_ins"]);
      for (const spy of consoleSpies) {
        expect(spy).not.toHaveBeenCalled();
      }
    });

    it.each([
      ["POST weigh_ins", "weigh-in", "23514", ["POST weigh_ins"]],
      ["GET programs", "program", "42501", ["POST weigh_ins", "GET programs"]],
      ["POST programs", "program", "23505", ["POST weigh_ins", "GET programs", "POST programs"]],
      ["PATCH programs", "program", "42501", ["POST weigh_ins", "GET programs", "PATCH programs"]],
      [
        "PATCH profiles",
        "profile",
        "42501",
        ["POST weigh_ins", "GET programs", "POST programs", "PATCH profiles"],
      ],
    ] as const)(
      "should stop the later steps and name the step and the code only when %s fails",
      async (requestKey, step, code, expectedCalls) => {
        const fake = installSetupSaveFake(server, {
          programs: requestKey === "PATCH programs" ? [programRow()] : [],
        });
        fake.failWith(requestKey, code);
        const consoleSpies = spyOnConsole();

        const failure = await run().then(
          () => undefined,
          (error: unknown) => error,
        );

        expect(failure).toBeInstanceOf(Error);
        expect(failure).toHaveProperty("message", `Could not save your setup (${step}, ${code})`);
        expect(fake.order()).toEqual(expectedCalls);
        expect(JSON.stringify(failure)).not.toContain("83.4");
        expect(JSON.stringify(failure, Object.getOwnPropertyNames(failure))).not.toContain("83.4");
        for (const spy of consoleSpies) {
          expect(spy).not.toHaveBeenCalled();
        }
      },
    );
  });
});
