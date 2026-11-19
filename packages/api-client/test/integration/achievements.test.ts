import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import {
  appendFreezeEvents,
  fetchAchievementStats,
  markAchievementsSeen,
  recordAchievements,
} from "../../src/repos/achievements";

import type { TestUser } from "./support/users";

// The user is made for this file and every assert reads that user's rows only. The shared database is
// never reseeded and no whole-table count is taken.
const heldRows = async (user: TestUser) => {
  const { data, error } = await user.client
    .from("user_achievements")
    .select("achievement_id,seen_at,backfilled")
    .order("achievement_id");
  expect(error).toBeNull();
  return data ?? [];
};

const FREEZE_ROWS = [
  {
    kind: "earned" as const,
    reason: "level_reached",
    reference: "level-1",
    date: "2026-11-19",
    count: 1,
  },
  {
    kind: "earned" as const,
    reason: "achievement_platinum",
    reference: "archivist",
    date: "2026-11-19",
    count: 3,
  },
];

describe("achievements against the local stack with a real user JWT", () => {
  let user: TestUser;

  beforeAll(async () => {
    user = await createTestUser("key1085");
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should read and map the stats of a new user", async () => {
    const snapshot = await fetchAchievementStats(user.client);

    expect(snapshot.stats.entries.total).toBe(0);
    expect(snapshot.held).toEqual([]);
    expect(snapshot.ledger).toEqual([]);
  });

  it("should record the ids once and give back nothing when they are recorded again", async () => {
    const first = await recordAchievements(user.client, ["first-bite", "jotter"], false);
    const again = await recordAchievements(user.client, ["first-bite", "jotter"], false);

    expect(first).toEqual(["first-bite", "jotter"]);
    expect(again).toEqual([]);
    expect(await heldRows(user)).toEqual([
      { achievement_id: "first-bite", seen_at: null, backfilled: false },
      { achievement_id: "jotter", seen_at: null, backfilled: false },
    ]);
  });

  it("should give back only the ids that are new when some are already held", async () => {
    const inserted = await recordAchievements(user.client, ["jotter", "notebook"], false);

    expect(inserted).toEqual(["notebook"]);
  });

  it("should append freeze rows and leave them as they are when appended again", async () => {
    await appendFreezeEvents(user.client, FREEZE_ROWS);
    await appendFreezeEvents(user.client, FREEZE_ROWS);

    const { ledger } = await fetchAchievementStats(user.client);
    expect(ledger).toHaveLength(2);
    expect(ledger).toEqual(expect.arrayContaining(FREEZE_ROWS));
  });

  it("should stamp seen_at on the ids given and keep the stamp of one already seen", async () => {
    await markAchievementsSeen(user.client, ["first-bite"], new Date("2026-11-19T12:00:00Z"));
    await markAchievementsSeen(
      user.client,
      ["first-bite", "jotter"],
      new Date("2026-11-19T13:00:00Z"),
    );

    const rows = await heldRows(user);
    expect(rows.find((row) => row.achievement_id === "first-bite")?.seen_at).toBe(
      "2026-11-19T12:00:00+00:00",
    );
    expect(rows.find((row) => row.achievement_id === "jotter")?.seen_at).toBe(
      "2026-11-19T13:00:00+00:00",
    );
    expect(rows.find((row) => row.achievement_id === "notebook")?.seen_at).toBeNull();
  });

  it("should show the held rows and the ledger in the next read of the stats", async () => {
    const { held, ledger } = await fetchAchievementStats(user.client);

    expect(held.map((row) => row.id).sort()).toEqual(["first-bite", "jotter", "notebook"]);
    expect(ledger).toHaveLength(2);
  });
});
