import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { getMySetupState } from "../../src/repos/setup";
import { createTestClient } from "../createTestClient";
import {
  RECOGNISABLE_SETUP_BIRTH_DATE,
  RECOGNISABLE_SETUP_HEIGHT,
  RECOGNISABLE_SETUP_WEIGHT,
  freshProfileRow,
  installSetupFake,
  programRow,
  setUpProfileRow,
  setupWeighInRow,
} from "../support/setupState";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

const noStats = { sex: null, birthDate: null, heightCm: null, activity: null, weightUnit: null };

describe("getMySetupState", () => {
  describe("whether the account is set up", () => {
    it("should read a profile with onboarding_completed_at set as set up", async () => {
      installSetupFake(server, { profiles: [setUpProfileRow] });

      const state = await getMySetupState(createTestClient());

      expect(state.isSetUp).toBe(true);
    });

    it("should read a profile with onboarding_completed_at null as not set up", async () => {
      installSetupFake(server, { profiles: [freshProfileRow] });

      const state = await getMySetupState(createTestClient());

      expect(state.isSetUp).toBe(false);
    });

    it("should read a signed in user with no profile row as set up, with no stats", async () => {
      installSetupFake(server, { profiles: [] });

      const state = await getMySetupState(createTestClient());

      expect(state).toEqual({ isSetUp: true, stats: noStats, program: null, latestWeighIn: null });
    });
  });

  describe("a fresh profile", () => {
    it("should return every stat null, no program and no weigh-in", async () => {
      installSetupFake(server, { profiles: [freshProfileRow] });

      expect(await getMySetupState(createTestClient())).toEqual({
        isSetUp: false,
        stats: noStats,
        program: null,
        latestWeighIn: null,
      });
    });
  });

  describe("a profile with stats, a program and a weigh-in", () => {
    it("should map every field", async () => {
      installSetupFake(server, {
        profiles: [setUpProfileRow],
        programs: [
          programRow({
            id: "66666666-6666-4666-8666-666666666601",
            goal: "gain",
            rate_pct_per_week: 0.25,
            protein_g_per_kg: 2.2,
            fat_fraction_of_remaining: 0.35,
            split_preset: "low_carb",
          }),
        ],
        weighIns: [
          setupWeighInRow({
            weight_kg: RECOGNISABLE_SETUP_WEIGHT,
            local_date: "2026-10-22",
            measured_at: "2026-10-22T06:45:00+00:00",
          }),
        ],
      });

      expect(await getMySetupState(createTestClient())).toEqual({
        isSetUp: true,
        stats: {
          sex: "female",
          birthDate: "1987-03-09",
          heightCm: 183.4,
          activity: "moderate",
          weightUnit: "kg",
        },
        program: {
          id: "66666666-6666-4666-8666-666666666601",
          goal: "gain",
          ratePctPerWeek: 0.25,
          proteinGPerKg: 2.2,
          fatFraction: 0.35,
          splitPreset: "low_carb",
        },
        latestWeighIn: { weightKg: 83.417, localDate: "2026-10-22" },
      });
    });

    it("should return a stored weight_unit of st as st, not mapped to kg or lb", async () => {
      installSetupFake(server, { profiles: [{ ...setUpProfileRow, weight_unit: "st" }] });

      const state = await getMySetupState(createTestClient());

      expect(state.stats.weightUnit).toBe("st");
    });

    it("should return a stored weight_unit of lb as lb", async () => {
      installSetupFake(server, { profiles: [{ ...setUpProfileRow, weight_unit: "lb" }] });

      const state = await getMySetupState(createTestClient());

      expect(state.stats.weightUnit).toBe("lb");
    });

    it("should return split_preset as the stored key for each preset", async () => {
      for (const splitPreset of ["balanced", "low_fat", "low_carb"]) {
        server.resetHandlers();
        installSetupFake(server, {
          profiles: [setUpProfileRow],
          programs: [programRow({ split_preset: splitPreset })],
        });

        const state = await getMySetupState(createTestClient());

        expect(state.program?.splitPreset).toBe(splitPreset);
      }
    });
  });

  describe("the active program", () => {
    it("should not return an ended program", async () => {
      installSetupFake(server, {
        profiles: [setUpProfileRow],
        programs: [programRow({ ended_on: "2026-09-30" })],
      });

      const state = await getMySetupState(createTestClient());

      expect(state.program).toBeNull();
    });

    it("should return the active program when an ended one exists as well", async () => {
      installSetupFake(server, {
        profiles: [setUpProfileRow],
        programs: [
          programRow({ id: "66666666-6666-4666-8666-666666666602", ended_on: "2026-09-30" }),
          programRow({ id: "66666666-6666-4666-8666-666666666603", goal: "maintain" }),
        ],
      });

      const state = await getMySetupState(createTestClient());

      expect(state.program).toMatchObject({
        id: "66666666-6666-4666-8666-666666666603",
        goal: "maintain",
      });
    });
  });

  describe("the latest weigh-in", () => {
    it("should return the newest weigh-in from last week when there is none today", async () => {
      installSetupFake(server, {
        profiles: [setUpProfileRow],
        weighIns: [
          setupWeighInRow({ weight_kg: 90.1, local_date: "2026-10-01" }),
          setupWeighInRow({ weight_kg: 82.3, local_date: "2026-10-16" }),
          setupWeighInRow({ weight_kg: 85.5, local_date: "2026-10-09" }),
        ],
      });

      const state = await getMySetupState(createTestClient());

      expect(state.latestWeighIn).toEqual({ weightKg: 82.3, localDate: "2026-10-16" });
    });

    it("should return the later of two weigh-ins on the same day", async () => {
      installSetupFake(server, {
        profiles: [setUpProfileRow],
        weighIns: [
          setupWeighInRow({
            weight_kg: 80.5,
            local_date: "2026-10-22",
            measured_at: "2026-10-22T18:00:00+00:00",
          }),
          setupWeighInRow({
            weight_kg: 81.5,
            local_date: "2026-10-22",
            measured_at: "2026-10-22T07:00:00+00:00",
          }),
        ],
      });

      const state = await getMySetupState(createTestClient());

      expect(state.latestWeighIn).toEqual({ weightKg: 80.5, localDate: "2026-10-22" });
    });

    it("should not return a soft-deleted weigh-in, even when it is the newest", async () => {
      installSetupFake(server, {
        profiles: [setUpProfileRow],
        weighIns: [
          setupWeighInRow({ weight_kg: 82.3, local_date: "2026-10-16" }),
          setupWeighInRow({
            weight_kg: 99.9,
            local_date: "2026-10-22",
            deleted_at: "2026-10-22T20:00:00+00:00",
          }),
        ],
      });

      const state = await getMySetupState(createTestClient());

      expect(state.latestWeighIn).toEqual({ weightKg: 82.3, localDate: "2026-10-16" });
    });

    it("should return null when every weigh-in is soft-deleted", async () => {
      installSetupFake(server, {
        profiles: [setUpProfileRow],
        weighIns: [setupWeighInRow({ deleted_at: "2026-10-22T20:00:00+00:00" })],
      });

      const state = await getMySetupState(createTestClient());

      expect(state.latestWeighIn).toBeNull();
    });
  });

  describe("what it asks for", () => {
    it("should select only the setup columns of each table and read one weigh-in", async () => {
      const { requests } = installSetupFake(server, { profiles: [setUpProfileRow] });

      await getMySetupState(createTestClient());

      const selectOf = (table: string) =>
        requests.find((request) => request.table === table)?.url.searchParams.get("select");
      expect(selectOf("profiles")).toBe(
        "sex,birth_date,height_cm,activity,weight_unit,onboarding_completed_at",
      );
      expect(selectOf("programs")).toBe(
        "id,goal,rate_pct_per_week,protein_g_per_kg,fat_fraction_of_remaining,split_preset",
      );
      expect(selectOf("weigh_ins")).toBe("weight_kg,local_date");
      expect(
        requests.find((request) => request.table === "weigh_ins")?.url.searchParams.get("limit"),
      ).toBe("1");
    });
  });

  describe("when a read fails", () => {
    it.each([["profiles"], ["programs"], ["weigh_ins"]])(
      "should throw the action and the code only when %s fails, with no value in the message, the cause or the console",
      async (table) => {
        const consoleSpies = (["log", "info", "warn", "error", "debug"] as const).map((method) =>
          vi.spyOn(console, method).mockImplementation(() => undefined),
        );
        const { failWith } = installSetupFake(server, {
          profiles: [{ ...setUpProfileRow, height_cm: RECOGNISABLE_SETUP_HEIGHT }],
          weighIns: [setupWeighInRow({ weight_kg: RECOGNISABLE_SETUP_WEIGHT })],
        });
        failWith(table, "XX000");

        const error = await getMySetupState(createTestClient()).then(
          () => null,
          (thrown: unknown) => thrown,
        );

        expect(error).toBeInstanceOf(Error);
        expect(error).toMatchObject({
          message: "Could not load your setup (XX000)",
          cause: { code: "XX000" },
        });
        const everything = JSON.stringify({
          message: error instanceof Error ? error.message : null,
          cause: error instanceof Error ? error.cause : null,
          console: consoleSpies.map((spy) => spy.mock.calls),
        });
        for (const value of [
          String(RECOGNISABLE_SETUP_WEIGHT),
          String(RECOGNISABLE_SETUP_HEIGHT),
          RECOGNISABLE_SETUP_BIRTH_DATE,
        ]) {
          expect(everything).not.toContain(value);
        }
      },
    );
  });
});
