import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { markMySetupDone } from "../../src/repos/setup";
import { createTestClient } from "../createTestClient";
import { SIGNED_IN_USER_ID } from "../support/postgrest";
import { installSetupSaveFake } from "../support/setupSave";
import { RECOGNISABLE_SETUP_WEIGHT } from "../support/setupState";

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

const run = () => markMySetupDone(createTestClient(), SIGNED_IN_USER_ID);

const spyOnConsole = () =>
  (["log", "info", "warn", "error", "debug"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );

const sortedKeys = (body: unknown) =>
  typeof body === "object" && body !== null ? Object.keys(body).sort() : [];

describe("markMySetupDone", () => {
  it("should write one profile update and nothing else", async () => {
    const fake = installSetupSaveFake(server);

    await run();

    expect(fake.order()).toEqual(["PATCH profiles"]);
  });

  it("should write exactly onboarding_completed_at, so no stat, target or program can be touched", async () => {
    const fake = installSetupSaveFake(server);

    await run();

    expect(sortedKeys(fake.bodyOf("PATCH profiles"))).toEqual(["onboarding_completed_at"]);
  });

  it("should write the client's now as an ISO time", async () => {
    const fake = installSetupSaveFake(server);

    await run();

    expect(fake.bodyOf("PATCH profiles")).toEqual({
      onboarding_completed_at: "2026-10-24T09:30:00.000Z",
    });
  });

  it("should update the signed in user's own profile row only", async () => {
    const fake = installSetupSaveFake(server);

    await run();

    expect(fake.searchOf("PATCH profiles")?.get("id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
  });

  describe("when the update fails", () => {
    it("should throw an error that names the action and the code only", async () => {
      const fake = installSetupSaveFake(server);
      fake.failWith("PATCH profiles", "42501");

      const error: unknown = await run().catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(Error);
      expect(error).toHaveProperty("message", "Could not mark your setup done (42501)");
      expect(error).toHaveProperty("cause", { code: "42501" });
    });

    it("should say nothing of the database's own message, which can quote a value", async () => {
      const fake = installSetupSaveFake(server);
      fake.failWith("PATCH profiles", "42501");

      const error: unknown = await run().catch((caught: unknown) => caught);

      expect(JSON.stringify(error)).not.toContain(String(RECOGNISABLE_SETUP_WEIGHT));
      expect(String(error)).not.toContain(String(RECOGNISABLE_SETUP_WEIGHT));
    });

    it("should name the code when no profile row matches", async () => {
      installSetupSaveFake(server, { profileExists: false });

      await expect(run()).rejects.toThrow("Could not mark your setup done (PGRST116)");
    });

    it("should write nothing to the console, on a success or a failure", async () => {
      const consoleSpies = spyOnConsole();
      const fake = installSetupSaveFake(server);

      await run();
      fake.failWith("PATCH profiles", "42501");
      await run().catch(() => undefined);

      expect(consoleSpies.flatMap((spy) => spy.mock.calls)).toEqual([]);
    });
  });
});
