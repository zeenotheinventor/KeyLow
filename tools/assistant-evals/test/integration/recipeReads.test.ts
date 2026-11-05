import { foodRowSchema } from "@keylow/core/schemas";
import { afterAll, describe, expect, inject, it } from "vitest";

import { createEvalDatabase } from "../../src/database.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";

// What the recipe import graders read as the eval user (KEY-701). It needs the local stack and is not part of
// the unit run. The user is new for this file and removed after it.
let user: FixtureUser | null = null;
const newUser = async () => {
  user = await createFixtureUser(inject("stack"), {
    namePrefix: `key701-${crypto.randomUUID().slice(0, 8)}`,
  });
  return user;
};

afterAll(async () => {
  await user?.remove();
});

describe("readRows as the eval user", () => {
  it("should read a seeded food with every column, in the shape core's food schema takes", async () => {
    const database = createEvalDatabase((await newUser()).client);

    const rows = await database.readRows({
      table: "foods",
      where: { source: "cofid", source_ref: "12-596" },
    });

    expect(rows).toHaveLength(1);
    expect(foodRowSchema.safeParse(rows[0]).success).toBe(true);
  });

  it("should read no recipe for a link nobody imported", async () => {
    const database = createEvalDatabase((await newUser()).client);

    const rows = await database.readRows({
      table: "recipes",
      where: { source_url: "https://recipes.keylow.test/recipes/never-imported.html" },
    });

    expect(rows).toEqual([]);
  });
});
