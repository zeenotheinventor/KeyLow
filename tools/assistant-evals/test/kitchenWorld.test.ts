import { describe, expect, it } from "vitest";

import { createKitchenWorld, kitchenWorldHolder } from "../src/kitchenWorld.ts";

import type { FixtureUser } from "../src/fixtureUser.ts";
import type { Database } from "@keylow/api-client";
import type { SupabaseClient } from "@supabase/supabase-js";

// A client that counts every use and fails it, so a test can tell whether the world touched the database.
function failingClient() {
  const uses = { count: 0 };
  const stand = new Proxy(
    {},
    {
      get: () => {
        uses.count += 1;
        throw new Error("the database was used");
      },
    },
  );
  // The proxy stands in for a signed in client, and no test here gets as far as a call that needs a real one.
  const client = stand as SupabaseClient<Database>;
  return { uses, client };
}

const userWith = (
  client: SupabaseClient<Database>,
): Pick<FixtureUser, "client" | "id" | "anchorDate"> => ({
  client,
  id: "11111111-1111-4111-8111-111111111111",
  anchorDate: "2026-11-13",
});

describe("createKitchenWorld", () => {
  it("should write nothing until a case asks for the world", () => {
    const { uses, client } = failingClient();

    createKitchenWorld(userWith(client), client);

    expect(uses.count).toBe(0);
  });

  it("should try again after a failed write, and not remember the failure", async () => {
    const { uses, client } = failingClient();
    const world = createKitchenWorld(userWith(client), client);

    await expect(world.ensureWorld()).rejects.toThrow("the database was used");
    await expect(world.ensureWorld()).rejects.toThrow("the database was used");

    expect(uses.count).toBe(2);
  });
});

describe("kitchenWorldHolder", () => {
  it("should say so when a case runs in a session that attached no world", async () => {
    await kitchenWorldHolder.detach();

    expect(() => kitchenWorldHolder.current()).toThrow(/attached the kitchen world/);
  });
});
