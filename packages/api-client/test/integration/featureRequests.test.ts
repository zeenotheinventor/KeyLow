import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { createFeatureRequest } from "../../src/repos/featureRequests";

import type { TestUser } from "./support/users";

// Each user is made for this file and the asserts read only that user's rows. The shared database is
// never reseeded and no whole-table count is taken.
const ownRequests = async (user: TestUser) => {
  const { data, error } = await user.client
    .from("feature_requests")
    .select("id,user_id,source,request,context");
  expect(error).toBeNull();
  return data ?? [];
};

const context = {
  version: 1 as const,
  ask: "stub ask",
  unsupported: "stub unsupported",
  recent: [{ role: "user" as const, text: "stub turn" }],
};

describe("feature requests against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  let userC: TestUser;

  beforeAll(async () => {
    [userA, userB, userC] = await Promise.all([
      createTestUser("key976"),
      createTestUser("key976"),
      createTestUser("key976"),
    ]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should store a more_menu request for the caller with a null context", async () => {
    const created = await createFeatureRequest(userA.client, {
      source: "more_menu",
      request: "  key976 dark mode  ",
    });

    const rows = await ownRequests(userA);
    expect(rows).toEqual([
      {
        id: created.id,
        user_id: userA.id,
        source: "more_menu",
        request: "key976 dark mode",
        context: null,
      },
    ]);
  });

  it("should store an assistant request with its context", async () => {
    const created = await createFeatureRequest(userB.client, {
      source: "assistant",
      request: "key976 gym cards",
      context,
    });

    const rows = (await ownRequests(userB)).filter((row) => row.id === created.id);
    expect(rows).toEqual([
      {
        id: created.id,
        user_id: userB.id,
        source: "assistant",
        request: "key976 gym cards",
        context,
      },
    ]);
  });

  it("should show a user none of another user's requests", async () => {
    expect(await ownRequests(userA)).toHaveLength(1);
    expect((await ownRequests(userB)).every((row) => row.user_id === userB.id)).toBe(true);
  });

  it("should refuse an update and a delete by the owner", async () => {
    const [row] = await ownRequests(userA);

    const update = await userA.client
      .from("feature_requests")
      .update({ request: "key976 edited" })
      .eq("id", row?.id ?? "");
    const removal = await userA.client
      .from("feature_requests")
      .delete()
      .eq("id", row?.id ?? "");

    expect(update.error?.code).toBe("42501");
    expect(removal.error?.code).toBe("42501");
  });

  it("should fail the 21st request in 24 hours with the code rate_limited", async () => {
    for (let count = 1; count <= 20; count += 1) {
      await createFeatureRequest(userC.client, {
        source: "more_menu",
        request: `key976 request ${count}`,
      });
    }

    const failure = await createFeatureRequest(userC.client, {
      source: "more_menu",
      request: "key976 request 21",
    }).catch((error: unknown) => error);

    expect(failure).toHaveProperty("message", "Could not send the feature request (rate_limited)");
    expect(failure).toHaveProperty("cause", { code: "rate_limited" });
    expect(await ownRequests(userC)).toHaveLength(20);
  });
});
