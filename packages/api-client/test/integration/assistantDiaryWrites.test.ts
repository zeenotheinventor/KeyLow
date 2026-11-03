import { assistantChangesFromActions } from "@keylow/core";
import { customFoodInputSchema } from "@keylow/core/schemas";
import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { requireServedFunction } from "../../../db/test/integration/support/functionsLane";
import { readAssistantActions, undoAssistantActions } from "../../src/repos/assistantConversations";
import { getLogEntry } from "../../src/repos/diary";
import {
  logFood,
  logQuickEntry,
  readLogEntryStamps,
  softDeleteLogEntries,
  updateLogEntry,
} from "../../src/repos/diaryWrites";
import { createFood } from "../../src/repos/foods";

import type { TestUser } from "./support/users";

/*
 * The diary write tools' Undo and rows against the real tables and the served `assistant` function
 * (KEY-688). The tools run in Deno and cannot be imported here, so an action is stored the way the
 * executor stores it, with the target and the stamp the tool reads back after its write: the entry's
 * `updated_at`. The repo functions the tools write through are used with each user's own JWT, so row
 * level security and the snapshot rules apply as they do in the tools. The Undo then runs through the
 * `undo` route, which is the tools' own inverse in the real function, against the real trigger.
 */

const RUN_ID = crypto.randomUUID();

type Admin = ReturnType<typeof adminClient>;

async function storeAction(
  admin: Admin,
  user: TestUser,
  tool: "log_entry" | "delete_entry" | "update_entry",
  entryId: string,
  stamp: string,
): Promise<string> {
  const { data, error } = await admin
    .from("assistant_actions")
    .insert({
      user_id: user.id,
      turn_seq: 1,
      tool,
      target_table: "food_log_entries",
      target_id: entryId,
      target_updated_at: stamp,
    })
    .select("id")
    .single();
  expect(error).toBeNull();
  return data?.id ?? "";
}

async function stampOf(client: TestUser["client"], entryId: string): Promise<string> {
  const [state] = await readLogEntryStamps(client, [entryId]);
  expect(state).toBeDefined();
  return state?.updatedAt ?? "";
}

const quick = (label: string) => ({
  kcal: 300,
  label,
  localDate: "2026-11-03",
  loggedAt: "2026-11-03T08:10:00Z",
});

async function changesRow(user: TestUser) {
  const read = await readAssistantActions(user.client);
  const changes = assistantChangesFromActions(read.actions, {
    now: new Date("2026-11-04T12:00:00Z"),
    timeZone: "UTC",
    targets: read.targets,
  });
  return changes.days.flatMap((day) => day.rows);
}

describe("the diary write tools against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;
  const admin = adminClient();

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key688"), createTestUser("key688")]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  describe("the rows the tools write", () => {
    it("should create the caller's row with the portion link and a frozen snapshot", async () => {
      const { food, portions } = await createFood(
        userA.client,
        userA.id,
        customFoodInputSchema.parse({
          name: `key688-egg-${RUN_ID}`,
          basis: "per_100g",
          kcal: 144,
          protein_g: 12,
          fat_g: 10,
          carbs_g: 1,
          portions: [{ label: "large egg", grams: 50, isDefault: true }],
        }),
      );
      const portion = portions[0];
      expect(portion).toBeDefined();

      const entry = await logFood(userA.client, {
        food,
        quantity: 2,
        unit: "portion",
        ...(portion === undefined ? {} : { portion }),
        loggedAt: "2026-11-03T08:10:00Z",
        localDate: "2026-11-03",
      });

      expect(entry).toMatchObject({
        item_type: "food",
        portion_id: portion?.id,
        resolved_grams: 100,
        snapshot: { name: food.name, portion: { label: "large egg", grams: 50 } },
      });
      const stored = await admin.from("food_log_entries").select("user_id").eq("id", entry.id);
      expect(stored.data).toEqual([{ user_id: userA.id }]);
    });

    it("should delete nothing when the ids are another user's", async () => {
      const theirs = await logQuickEntry(userB.client, quick("key688 B's entry"));

      const deleted = await softDeleteLogEntries(userA.client, [theirs.id]);

      expect(deleted).toEqual([]);
      expect(await getLogEntry(userB.client, theirs.id)).not.toBeNull();
    });

    it("should stamp updated_at on every update, so an edit moves it, and give one stamp to rows deleted together", async () => {
      const first = await logQuickEntry(userA.client, quick("key688 one"));
      const second = await logQuickEntry(userA.client, quick("key688 two"));
      const before = await stampOf(userA.client, first.id);

      await updateLogEntry(userA.client, {
        entry: first,
        time: { loggedAt: "2026-11-03T09:00:00Z", timeZone: "UTC" },
      });
      const afterEdit = await stampOf(userA.client, first.id);
      const deleted = await softDeleteLogEntries(userA.client, [first.id, second.id]);

      expect(Date.parse(afterEdit)).toBeGreaterThan(Date.parse(before));
      expect(deleted).toHaveLength(2);
      expect(new Set(deleted.map(({ updatedAt }) => updatedAt)).size).toBe(1);
    });
  });

  describe("Undo through the assistant function", () => {
    beforeAll(async () => {
      await requireServedFunction(inject("stack"), "assistant");
    });

    it("should restore a soft-deleted entry, and the changes-list row then reads undone", async () => {
      const user = await createTestUser("key688");
      const entry = await logQuickEntry(user.client, quick("key688 to restore"));
      const [stamped] = await softDeleteLogEntries(user.client, [entry.id]);
      const actionId = await storeAction(
        admin,
        user,
        "delete_entry",
        entry.id,
        stamped?.updatedAt ?? "",
      );
      expect(await getLogEntry(user.client, entry.id)).toBeNull();

      const results = await undoAssistantActions(user.client, [actionId]);

      expect(results).toEqual([{ actionId, result: "undone" }]);
      expect(await getLogEntry(user.client, entry.id)).not.toBeNull();
      expect((await changesRow(user)).map((row) => row.state)).toEqual(["undone"]);
    });

    it("should remove a logged entry, and answer already_undone the second time", async () => {
      const user = await createTestUser("key688");
      const entry = await logQuickEntry(user.client, quick("key688 to remove"));
      const actionId = await storeAction(
        admin,
        user,
        "log_entry",
        entry.id,
        await stampOf(user.client, entry.id),
      );

      const first = await undoAssistantActions(user.client, [actionId]);
      const second = await undoAssistantActions(user.client, [actionId]);

      expect(first).toEqual([{ actionId, result: "undone" }]);
      expect(second).toEqual([{ actionId, result: "already_undone" }]);
      expect(await getLogEntry(user.client, entry.id)).toBeNull();
    });

    it("should answer undo_unavailable, and keep the entry, once the person edited it", async () => {
      const user = await createTestUser("key688");
      const entry = await logQuickEntry(user.client, quick("key688 edited"));
      const actionId = await storeAction(
        admin,
        user,
        "log_entry",
        entry.id,
        await stampOf(user.client, entry.id),
      );
      await updateLogEntry(user.client, {
        entry,
        time: { loggedAt: "2026-11-03T09:00:00Z", timeZone: "UTC" },
      });

      const results = await undoAssistantActions(user.client, [actionId]);

      expect(results).toEqual([{ actionId, result: "undo_unavailable" }]);
      expect(await getLogEntry(user.client, entry.id)).not.toBeNull();
      expect((await changesRow(user)).map((row) => row.state)).toEqual(["cant_undo"]);
    });

    it("should have no Undo for an edit", async () => {
      const user = await createTestUser("key688");
      const entry = await logQuickEntry(user.client, quick("key688 edit only"));
      const actionId = await storeAction(
        admin,
        user,
        "update_entry",
        entry.id,
        await stampOf(user.client, entry.id),
      );

      const results = await undoAssistantActions(user.client, [actionId]);

      expect(results).toEqual([{ actionId, result: "undo_unavailable" }]);
    });
  });
});
