import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { getDiaryDay, getDiaryWeek } from "../../../../api-client/src/repos/diary";
import { logQuickEntry } from "../../../../api-client/src/repos/diaryWrites";
import { getMyTargets, updateMyTargets } from "../../../../api-client/src/repos/targets";
import { addWeighIn, listWeighIns } from "../../../../api-client/src/repos/weighIns";
import { createTestUser, deleteCreatedTestUsers } from "../support/users";

import type { TestUser } from "../support/users";

/*
 * The reads behind the assistant's diary tools (`get_day`, `get_range_totals`, `get_entries` and
 * `get_weigh_ins`) against the real tables, with two users. HTTP-free: each read runs with the user's
 * own signed-in client, which is the client the `mcp` function (not built yet) hands a tool as its
 * caller, so row level security scopes it. It proves that what one user logged and weighed never reaches
 * the tools of the other (ADR 0006).
 *
 * The tools themselves import Deno-style `.ts` paths that this package's typecheck cannot follow, so
 * their own tests run under Deno with a stub client, and assert the sums and the citation words. This
 * file proves what the repo functions they call return from a real database.
 *
 * Both users log on the same day, at the same time, and weigh in on the same day, so a read that was not
 * scoped to its user would show the other's rows too. Each user's numbers are different.
 */

const localDate = "2026-10-14";
const loggedAt = "2026-10-14T12:00:00.000Z";

type Person = { user: TestUser; kcal: number; weightKg: number; label: string };

let alice: Person;
let bob: Person;

async function createPerson(label: string, kcal: number, weightKg: number): Promise<Person> {
  const user = await createTestUser(`key690-${label}`);
  await logQuickEntry(user.client, { localDate, loggedAt, kcal, label: `${label} lunch` });
  await addWeighIn(user.client, {
    weight_kg: weightKg,
    measured_at: loggedAt,
    local_date: localDate,
    tz: "UTC",
    source: "manual",
    external_id: null,
    note: null,
  });
  return { user, kcal, weightKg, label };
}

const bobTargets = { kcal: 1800, protein_g: 120, fat_g: 60, carbs_g: 200 };

beforeAll(async () => {
  alice = await createPerson("alice", 700, 81.2);
  bob = await createPerson("bob", 900, 64.8);
  await updateMyTargets(bob.user.client, bob.user.id, bobTargets);
});

afterAll(async () => {
  await deleteCreatedTestUsers();
});

describe("get_day", () => {
  it("reads the caller's own entries and totals, and never the other user's", async () => {
    const aliceDay = await getDiaryDay(alice.user.client, localDate);
    const bobDay = await getDiaryDay(bob.user.client, localDate);

    expect(aliceDay.entries).toHaveLength(1);
    expect(aliceDay.entries[0]?.snapshot).toMatchObject({ label: "alice lunch" });
    expect(aliceDay.entries[0]?.nutrients.kcal).toBe(700);
    expect(bobDay.entries).toHaveLength(1);
    expect(bobDay.entries[0]?.snapshot).toMatchObject({ label: "bob lunch" });
    expect(bobDay.entries[0]?.nutrients.kcal).toBe(900);
  });

  it("shows the caller their own targets, and never the other user's", async () => {
    expect(await getMyTargets(alice.user.client)).toMatchObject({
      kcal: null,
      protein_g: null,
      source: "manual",
    });
    expect(await getMyTargets(bob.user.client)).toMatchObject({ ...bobTargets, source: "manual" });
  });
});

describe("get_range_totals and get_entries", () => {
  it("adds up the caller's days only, never the other user's", async () => {
    const weekStart = "2026-10-12";

    const aliceWeek = await getDiaryWeek(alice.user.client, weekStart);
    const bobWeek = await getDiaryWeek(bob.user.client, weekStart);

    expect(aliceWeek.find((day) => day.localDate === localDate)?.totals).toMatchObject({
      entry_count: 1,
      kcal: alice.kcal,
    });
    expect(bobWeek.find((day) => day.localDate === localDate)?.totals).toMatchObject({
      entry_count: 1,
      kcal: bob.kcal,
    });
  });

  it("finds nothing on a day the caller did not log, whatever the other user did", async () => {
    const aliceDay = await getDiaryDay(alice.user.client, "2026-10-15");

    expect(aliceDay.entries).toEqual([]);
    expect(aliceDay.totals).toBeNull();
  });
});

describe("get_weigh_ins", () => {
  it("lists the caller's weigh-ins only, never the other user's", async () => {
    const aliceWeighIns = await listWeighIns(alice.user.client);
    const bobWeighIns = await listWeighIns(bob.user.client);

    expect(aliceWeighIns.map((weighIn) => weighIn.weight_kg)).toEqual([alice.weightKg]);
    expect(bobWeighIns.map((weighIn) => weighIn.weight_kg)).toEqual([bob.weightKg]);
  });
});
