import { MUSCLE_IDS } from "@keylow/core";
import { afterAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "../support/users";

// Core's MUSCLE_IDS and the `muscles` rows the migration seeds are two copies of ADR 0005's list.
// This compares them directly, by position, so an id that is added, renamed or moved in one place
// and not the other fails here. The service role has no grant on `muscles` (the migration revokes
// it and grants select to `authenticated` only), so the table is read as a signed-in user.

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("the muscles table", () => {
  it("should hold core's muscle ids in core's order", async () => {
    const user = await createTestUser("muscle-list");

    const { data, error } = await user.client
      .from("muscles")
      .select("id")
      .order("position", { ascending: true });

    expect(error).toBeNull();
    expect(data?.map(({ id }) => id)).toEqual([...MUSCLE_IDS]);
  });
});
