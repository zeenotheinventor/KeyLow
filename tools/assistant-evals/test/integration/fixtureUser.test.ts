import { getMyTargets } from "@keylow/api-client";
import { afterAll, describe, expect, inject, it } from "vitest";

import { adminClient } from "../../../../packages/db/test/integration/support/stack";
import { ASK_TARGETS, writeAskExtras } from "../../fixtures/askExtras.ts";
import { DIARY_DAY_COUNT, diaryDateOf, diaryDay, fixtureRecipes } from "../../fixtures/diary.ts";
import { dayTotals } from "../../fixtures/diaryTotals.ts";
import { createEvalDatabase } from "../../src/database.ts";
import { createFixtureUser } from "../../src/fixtureUser.ts";

import type { FixtureUser } from "../../src/fixtureUser.ts";

// Every user these tests create is named key677-<run id>-<label>-<random>@keylow.test, and the users are new
// for the run, so rows another session left on the shared stack cannot change a result. Every read below is
// of these users' own rows, and afterAll removes them.
const RUN_ID = crypto.randomUUID().slice(0, 8);
const namePrefix = `key677-${RUN_ID}`;

const plannedDays = Array.from({ length: DIARY_DAY_COUNT }, (_, index) => diaryDay(index));
const plannedEntryCount = plannedDays.reduce((total, { entries }) => total + entries.length, 0);
const plannedWeighInCount = plannedDays.filter(({ weightKg }) => weightKg !== null).length;
const plannedCompleteDayCount = plannedDays.filter(({ complete }) => complete).length;

const created: FixtureUser[] = [];
const newUser = async (label: string) => {
  const user = await createFixtureUser(inject("stack"), { namePrefix: `${namePrefix}-${label}` });
  created.push(user);
  return user;
};

// The service role can read the diary tables but not `recipes`, so recipes are counted through the user's own
// client, where row-level security shows the user's rows and no one else's. That client's token outlives the
// user for a while, so a count of 0 after the removal still means the rows are gone.
const countOf = async (
  table: "food_log_entries" | "weigh_ins" | "recipes" | "day_logs",
  user: FixtureUser,
) => {
  const query =
    table === "recipes"
      ? user.client.from(table).select("*", { count: "exact", head: true })
      : adminClient()
          .from(table)
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id);
  const { count, error } = await query;
  if (error) {
    throw new Error(`Could not count ${table} (${error.code})`);
  }
  return count;
};

afterAll(async () => {
  await Promise.all(created.map((user) => user.remove().catch(() => undefined)));
});

describe("createFixtureUser against the local stack", () => {
  it("should create a user under a test domain with the whole synthetic diary", async () => {
    const user = await newUser("diary");

    expect(user.email).toMatch(new RegExp(`^${namePrefix}-diary-.+@keylow\\.test$`));
    expect(await countOf("food_log_entries", user)).toBe(plannedEntryCount);
    expect(await countOf("weigh_ins", user)).toBe(plannedWeighInCount);
    expect(await countOf("recipes", user)).toBe(fixtureRecipes.length);
    expect(await countOf("day_logs", user)).toBe(plannedCompleteDayCount);
  });

  it("should write entries with real snapshots and nutrients", async () => {
    const user = await newUser("snapshots");

    const { data, error } = await user.client.from("food_log_entries").select("snapshot,kcal");
    expect(error).toBeNull();

    expect(data).toHaveLength(plannedEntryCount);
    expect(data?.every(({ snapshot, kcal }) => snapshot !== null && (kcal ?? 0) > 0)).toBe(true);
  });

  it("should write exactly one day note", async () => {
    const user = await newUser("note");

    const { data } = await user.client.from("day_logs").select("note").not("note", "is", null);

    expect(data).toHaveLength(1);
  });

  it("should give two runs two users that share no rows", async () => {
    const [first, second] = await Promise.all([newUser("run-a"), newUser("run-b")]);

    expect(first.id).not.toBe(second.id);
    expect(first.email).not.toBe(second.email);
    for (const user of [first, second]) {
      expect(await countOf("food_log_entries", user)).toBe(plannedEntryCount);
      expect(await countOf("recipes", user)).toBe(fixtureRecipes.length);
    }
    const { data: firstRecipes } = await first.client.from("recipes").select("id");
    const { data: secondRecipes } = await second.client.from("recipes").select("id");
    const seenByFirst = new Set(firstRecipes?.map(({ id }) => id));
    expect(secondRecipes?.some(({ id }) => seenByFirst.has(id))).toBe(false);
  });

  it("should give the user an unlimited assistant plan, so a run is not cut short by the free 15 turns", async () => {
    const user = await newUser("unlimited");

    const { data, error } = await user.client
      .from("entitlements")
      .select("feature,plan,source")
      .eq("feature", "assistant");

    expect(error).toBeNull();
    expect(data).toStrictEqual([{ feature: "assistant", plan: "unlimited", source: "eval" }]);
  });

  it("should give back the anchor date it dated the diary from", async () => {
    const user = await createFixtureUser(inject("stack"), {
      namePrefix: `${namePrefix}-anchor`,
      anchorDate: "2026-03-01",
    });
    created.push(user);

    expect(user.anchorDate).toBe("2026-03-01");
    const { data } = await user.client
      .from("food_log_entries")
      .select("local_date")
      .order("local_date", { ascending: false })
      .limit(1);
    expect(data?.[0]?.local_date).toBe("2026-02-28");
  });

  it("should remove the user it created when the diary cannot be written", async () => {
    const failedPrefix = `${namePrefix}-failed`;

    await expect(
      createFixtureUser(inject("stack"), { namePrefix: failedPrefix, anchorDate: "not a date" }),
    ).rejects.toThrow();

    const { data, error } = await adminClient().auth.admin.listUsers({ perPage: 1000 });
    expect(error).toBeNull();
    expect(data.users.filter(({ email }) => email?.startsWith(failedPrefix))).toStrictEqual([]);
  });

  it("should remove the user and every row it wrote", async () => {
    const user = await createFixtureUser(inject("stack"), { namePrefix: `${namePrefix}-gone` });

    await user.remove();

    expect(await countOf("food_log_entries", user)).toBe(0);
    expect(await countOf("weigh_ins", user)).toBe(0);
    expect(await countOf("recipes", user)).toBe(0);
    expect(await countOf("day_logs", user)).toBe(0);
  });
});

describe("the totals the ask set expects, against the local stack", () => {
  it("should match day_totals for days 0, 1 and 2, day 0 holding both recipes", async () => {
    const user = await newUser("day-totals");

    const { data, error } = await user.client
      .from("day_totals")
      .select("local_date,kcal,protein_g,fat_g")
      .in(
        "local_date",
        [0, 1, 2].map((dayNumber) => diaryDateOf(user.anchorDate, dayNumber)),
      );

    expect(error).toBeNull();
    expect(data).toHaveLength(3);
    for (const dayNumber of [0, 1, 2]) {
      const row = data?.find(
        ({ local_date }) => local_date === diaryDateOf(user.anchorDate, dayNumber),
      );
      const expected = dayTotals(dayNumber);
      expect(row?.kcal).toBeCloseTo(expected.kcal ?? Number.NaN, 3);
      expect(row?.protein_g).toBeCloseTo(expected.protein_g ?? Number.NaN, 3);
      expect(row?.fat_g).toBeCloseTo(expected.fat_g ?? Number.NaN, 3);
    }
  });
});

describe("writeAskExtras against the local stack", () => {
  it("should leave the user with the targets the ask cases are worked out against", async () => {
    const user = await newUser("ask-targets");

    await writeAskExtras(user);

    expect(await getMyTargets(user.client)).toMatchObject({ ...ASK_TARGETS, source: "manual" });
  });
});

describe("createEvalDatabase against the local stack", () => {
  it("should count only the rows of the user it is signed in as", async () => {
    const [owner, other] = await Promise.all([newUser("count-a"), newUser("count-b")]);

    const noMatch = await createEvalDatabase(owner.client).countRows({
      table: "day_logs",
      where: { local_date: "2000-01-01" },
    });
    const completeDays = await createEvalDatabase(owner.client).countRows({
      table: "day_logs",
      where: { is_complete: true },
    });
    const recipesOfOther = await createEvalDatabase(other.client).countRows({
      table: "recipes",
      where: {},
    });
    const withoutNote = await createEvalDatabase(owner.client).countRows({
      table: "day_logs",
      where: { note: null },
    });

    expect(noMatch).toBe(0);
    expect(completeDays).toBe(plannedCompleteDayCount);
    expect(recipesOfOther).toBe(fixtureRecipes.length);
    expect(withoutNote).toBe(plannedCompleteDayCount - 1);
  });

  it("should sum the usage rows of a turn and leave out another turn's", async () => {
    const user = await newUser("usage");
    const turnId = crypto.randomUUID();
    const row = (turn: string, tokens: number) => ({
      user_id: user.id,
      turn_id: turn,
      route: "describe_or_ask",
      model: "key677-test-model",
      input_tokens: tokens,
      output_tokens: tokens * 2,
      cache_read_input_tokens: tokens * 3,
      cache_creation_input_tokens: tokens * 4,
      cost_usd_micros: tokens * 100,
      latency_ms: 10,
      transport: "mcp_http",
    });
    const { error } = await adminClient()
      .from("assistant_usage")
      .insert([row(turnId, 1), row(turnId, 10), row(crypto.randomUUID(), 1_000)]);
    expect(error).toBeNull();

    const usage = await createEvalDatabase(user.client).usageOfTurn(turnId);

    expect(usage).toEqual({
      inputTokens: 11,
      outputTokens: 22,
      cacheReadInputTokens: 33,
      cacheCreationInputTokens: 44,
      costUsdMicros: 1_100,
    });
  });

  it("should sum every usage row of the user, whatever turn it names, and no other user's", async () => {
    const [user, other] = await Promise.all([newUser("user-usage"), newUser("user-usage-other")]);
    const row = (owner: FixtureUser, tokens: number) => ({
      user_id: owner.id,
      turn_id: crypto.randomUUID(),
      route: "compact",
      model: "key677-test-model",
      input_tokens: tokens,
      output_tokens: tokens,
      cache_read_input_tokens: tokens,
      cache_creation_input_tokens: tokens,
      cost_usd_micros: tokens,
      latency_ms: 1,
      transport: "none",
    });
    const { error } = await adminClient()
      .from("assistant_usage")
      .insert([row(user, 1), row(user, 2), row(other, 1_000)]);
    expect(error).toBeNull();

    const usage = await createEvalDatabase(user.client).usageOfUser();

    expect(usage).toEqual({
      inputTokens: 3,
      outputTokens: 3,
      cacheReadInputTokens: 3,
      cacheCreationInputTokens: 3,
      costUsdMicros: 3,
    });
  });

  it("should total more usage rows than the stack returns for one select", async () => {
    const user = await newUser("many-rows");
    const turnId = crypto.randomUUID();
    const rowCount = 1_050;
    const rows = Array.from({ length: rowCount }, () => ({
      user_id: user.id,
      turn_id: turnId,
      route: "describe_or_ask",
      model: "key677-test-model",
      input_tokens: 2,
      output_tokens: 3,
      cache_read_input_tokens: 4,
      cache_creation_input_tokens: 5,
      cost_usd_micros: 6,
      latency_ms: 1,
      transport: "mcp_http",
    }));
    const { error } = await adminClient().from("assistant_usage").insert(rows);
    expect(error).toBeNull();

    // The stack caps one select at 1000 rows, which is why a plain select of the rows would undercount.
    const plain = await user.client.from("assistant_usage").select("input_tokens");
    expect(plain.data).toHaveLength(1_000);

    const usage = await createEvalDatabase(user.client).usageOfUser();

    expect(usage).toEqual({
      inputTokens: 2 * rowCount,
      outputTokens: 3 * rowCount,
      cacheReadInputTokens: 4 * rowCount,
      cacheCreationInputTokens: 5 * rowCount,
      costUsdMicros: 6 * rowCount,
    });
  });

  it("should read the earliest usage row of a turn as its first model call", async () => {
    const user = await newUser("first-call");
    const turnId = crypto.randomUUID();
    const row = (createdAt: string, cacheRead: number) => ({
      user_id: user.id,
      turn_id: turnId,
      route: "describe_or_ask",
      model: "key677-test-model",
      input_tokens: 1,
      output_tokens: 1,
      cache_read_input_tokens: cacheRead,
      cache_creation_input_tokens: 0,
      cost_usd_micros: 1,
      latency_ms: 1,
      transport: "mcp_http",
      created_at: createdAt,
    });
    // Inserted newest first, so the order of insertion is not the order of creation.
    const { error } = await adminClient()
      .from("assistant_usage")
      .insert([row("2026-01-01T00:00:02Z", 900), row("2026-01-01T00:00:01Z", 0)]);
    expect(error).toBeNull();

    const database = createEvalDatabase(user.client);

    expect((await database.firstModelCallOfTurn(turnId))?.cacheReadInputTokens).toBe(0);
    expect(await database.firstModelCallOfTurn(crypto.randomUUID())).toBeNull();
  });

  it("should answer zero usage for a turn that has no rows", async () => {
    const user = await newUser("no-usage");

    const usage = await createEvalDatabase(user.client).usageOfTurn(crypto.randomUUID());

    expect(usage.inputTokens + usage.cacheReadInputTokens).toBe(0);
  });
});
