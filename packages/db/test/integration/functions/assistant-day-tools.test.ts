import { afterAll, beforeAll, describe, expect, inject, it } from "vitest";

import { getDiaryDay } from "../../../../api-client/src/repos/diary";
import { logQuickEntry } from "../../../../api-client/src/repos/diaryWrites";
import { anthropicMock } from "../support/anthropicMock";
import { callAssistant, eventsOf, newAssistantUser, turnBody } from "../support/assistantClient";
import { requireServedFunction } from "../support/functionsLane";
import { deleteCreatedTestUsers } from "../support/users";

import type { ScriptedReply } from "../support/anthropicMock";
import type { TestUser } from "../support/users";
import type { AssistantStreamEvent } from "@keylow/core";

/*
 * The served path of the day write tools (KEY-693): `copy_day` through the served `assistant` and `mcp`
 * functions, with only the Messages API mocked. Three users, each with entries the test writes: Alice
 * copies yesterday onto an empty today, Bob has a yesterday and a today of his own that must stay as they
 * are, and Carol copies onto a today that already has an entry, so her turn ends asking first.
 *
 * Every user logs a different label, so a copy that read another user's day would show in the labels. The
 * days are today and yesterday on the clock, and the turn is opened on today. The labels are invented.
 */

// The card words "yesterday" and "today" by the person's own clock, so the days come from the clock too.
// A new user has no time zone, which is read as UTC.
const today = new Date().toISOString().slice(0, 10);
const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

const markerOf = () => `kl693${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
const toolUseId = () => `toolu_${crypto.randomUUID().replaceAll("-", "")}`;

type Person = { user: TestUser; labels: string[] };

async function createPerson(name: string, labels: string[], onToday: string[]): Promise<Person> {
  const user = await newAssistantUser("assistant-day-tools");
  for (const [index, label] of labels.entries()) {
    await logQuickEntry(user.client, {
      localDate: yesterday,
      loggedAt: `${yesterday}T${String(8 + index * 4).padStart(2, "0")}:00:00.000Z`,
      kcal: 300 + index * 100,
      label: `${name} ${label}`,
    });
  }
  for (const label of onToday) {
    await logQuickEntry(user.client, {
      localDate: today,
      loggedAt: `${today}T07:00:00.000Z`,
      kcal: 150,
      label: `${name} ${label}`,
    });
  }
  return { user, labels: [...labels, ...onToday].map((label) => `${name} ${label}`) };
}

async function copyTurn(user: TestUser, marker: string, replies: ScriptedReply[]) {
  await anthropicMock.script(marker, replies);
  const response = await callAssistant("turn", {
    user,
    body: { ...turnBody(`Copy yesterday to today ${marker}`), localDate: today },
  });
  return eventsOf(response);
}

const copyInput = (entryCount: number) => ({ from: yesterday, to: today, entry_count: entryCount });

let alice: Person;
let bob: Person;
let carol: Person;
let aliceEvents: AssistantStreamEvent[];
let carolEvents: AssistantStreamEvent[];
const markers = [markerOf(), markerOf()];

beforeAll(async () => {
  await requireServedFunction(inject("stack"), "assistant");
  await requireServedFunction(inject("stack"), "mcp");
  alice = await createPerson("alice", ["porridge", "soup"], []);
  bob = await createPerson("bob", ["omelette", "curry", "salad"], ["toast"]);
  carol = await createPerson("carol", ["pancakes", "stew"], ["coffee"]);
  aliceEvents = await copyTurn(alice.user, markers[0] ?? "", [
    {
      blocks: [{ type: "tool_use", id: toolUseId(), name: "copy_day", input: copyInput(2) }],
      stopReason: "tool_use",
    },
    { blocks: [{ type: "text", text: "Copied yesterday." }], stopReason: "end_turn" },
  ]);
  carolEvents = await copyTurn(carol.user, markers[1] ?? "", [
    {
      blocks: [
        { type: "text", text: "Today already has 1 entry. Add yesterday's 2 entries to it?" },
        { type: "tool_use", id: toolUseId(), name: "copy_day", input: copyInput(2) },
      ],
      stopReason: "tool_use",
    },
  ]);
}, 120_000);

afterAll(async () => {
  await Promise.all(markers.map((marker) => anthropicMock.forget(marker)));
  await deleteCreatedTestUsers();
});

const labelsOn = async (person: Person, localDate: string) =>
  (await getDiaryDay(person.user.client, localDate)).entries.map((entry) =>
    entry.item_type === "quick" ? entry.snapshot.label : null,
  );

describe("a turn that calls copy_day onto an empty day", () => {
  it("streams the day-copied card and ends complete", () => {
    const card = aliceEvents.find((event) => event.type === "card");

    expect(card?.type === "card" && card.card).toMatchObject({
      kind: "day_copied",
      title: "Copied 2 entries from yesterday",
      undo: "available",
    });
    expect(card?.type === "card" && card.card.sub).toMatch(
      /^[A-Za-z]+ \d+ [A-Za-z]+ to today · 700 kcal$/,
    );
    expect(aliceEvents.at(-1)).toEqual({ type: "done", outcome: "complete" });
  });

  it("copies Alice's own day onto today and leaves her yesterday as it was", async () => {
    expect(await labelsOn(alice, today)).toEqual(["alice porridge", "alice soup"]);
    expect(await labelsOn(alice, yesterday)).toEqual(["alice porridge", "alice soup"]);
  });

  it("leaves Bob's yesterday and today exactly as he wrote them", async () => {
    expect(await labelsOn(bob, yesterday)).toEqual(["bob omelette", "bob curry", "bob salad"]);
    expect(await labelsOn(bob, today)).toEqual(["bob toast"]);
  });

  it("records one action that holds ids and a date, and no words of the diary", async () => {
    const { data, error } = await alice.user.client
      .from("assistant_actions")
      .select("*")
      .eq("tool", "copy_day");
    const copiedIds = (await getDiaryDay(alice.user.client, today)).entries.map(({ id }) => id);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data?.[0]).toMatchObject({
      target_table: "food_log_entries",
      target_id: null,
      target_local_date: today,
      turn_seq: 1,
    });
    expect([...(data?.[0]?.target_ids ?? [])].sort()).toEqual([...copiedIds].sort());
    // Every copy carries the one change time the action recorded, which Undo and the changes list compare.
    const stamps = await alice.user.client
      .from("food_log_entries")
      .select("updated_at")
      .in("id", copiedIds);
    expect(stamps.data).toHaveLength(2);
    expect(data?.[0]?.target_updated_at).not.toBeNull();
    for (const { updated_at } of stamps.data ?? []) {
      expect(Date.parse(updated_at)).toBe(Date.parse(data?.[0]?.target_updated_at ?? ""));
    }
    const written = JSON.stringify(data);
    for (const word of [...alice.labels, "kcal", "porridge", "soup"]) {
      expect(written).not.toContain(word);
    }
    const bobActions = await bob.user.client.from("assistant_actions").select("id");
    expect(bobActions.data).toEqual([]);
  });
});

describe("a turn that calls copy_day onto a day that has entries", () => {
  it("ends asking, with the board's buttons, and copies nothing", async () => {
    const confirm = carolEvents.find((event) => event.type === "confirm");

    expect(confirm).toMatchObject({
      type: "confirm",
      confirmLabel: "Copy 2 entries",
      cancelLabel: "Don't copy",
      tone: "primary",
    });
    expect(carolEvents.at(-1)).toEqual({ type: "done", outcome: "confirm" });
    expect(await labelsOn(carol, today)).toEqual(["carol coffee"]);
    const actions = await carol.user.client.from("assistant_actions").select("id");
    expect(actions.data).toEqual([]);
  });
});
