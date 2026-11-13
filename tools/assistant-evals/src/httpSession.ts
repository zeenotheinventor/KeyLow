import { setAssistantConsent } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";

import { createCaseEnvironment } from "./caseEnvironment.ts";
import { createEvalDatabase } from "./database.ts";
import { createFixtureUser } from "./fixtureUser.ts";
import { createHttpDriver } from "./httpDriver.ts";
import { createKitchenWorld, kitchenWorldHolder } from "./kitchenWorld.ts";
import { stopPageServer } from "./pageServerHolder.ts";
import { attachRedTeamWorld } from "./redTeamSession.ts";
import { createTrainingEditsWorld, trainingEditsWorldHolder } from "./trainingEditsWorld.ts";
import { createTrainingWorld } from "./trainingWorld.ts";
import { trainingWorldHolder } from "./trainingWorldHolder.ts";
import { createUndoTurn } from "./undoTurn.ts";
import { readSupabaseStatus } from "../../../packages/db/scripts/supabaseStatus.ts";
import { writeAskExtras } from "../fixtures/askExtras.ts";
import { redTeamWorldHolder } from "../fixtures/redTeamWorld.ts";

import type { EvalSession } from "./cli.ts";
import type { FixtureUser } from "./fixtureUser.ts";
import type { EstimatedAmount, ToolCall } from "./types.ts";
import type { Database } from "@keylow/api-client";

// packages/db, which holds the Supabase project the CLI reads the stack status for.
const databaseWorkdir = new URL("../../../packages/db", import.meta.url).pathname;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const blocksOf = (content: unknown): unknown[] =>
  Array.isArray(content) ? (content as unknown[]) : [];

/** The `tool_use` blocks of a stored assistant message, in order. Anything else in the content is left out. */
export function toolCallsOf(content: unknown): ToolCall[] {
  return blocksOf(content).flatMap((block) =>
    isRecord(block) && block["type"] === "tool_use" && typeof block["name"] === "string"
      ? [{ name: block["name"], input: block["input"] }]
      : [],
  );
}

// The code a tool answered with: `"error": "not_found"` in the text of its result, which the tools write as JSON.
// Only the code is kept, never the rest of the result.
const NEEDS_CONFIRMATION = /"status"\s*:\s*"needs_confirmation"/;
const ERROR_CODE = /"error"\s*:\s*"([a-z_]+)"/;
// An `estimate_portions` answer holds an `error` for each item it could not size, and that is not a refused call.
const SIZED_ITEMS = /"shares_scaled"\s*:/;

const UNTRUSTED_PAYLOAD = /<untrusted_data[^>]*>([\s\S]*)<\/untrusted_data>/;

/**
 * The food, the unit and the size of each item an `estimate_portions` result sized. Nothing else of the result is
 * kept. A result that is not the tool's answer, or an item that carries an error, gives no amount.
 */
export function estimatedAmountsOf(result: string): EstimatedAmount[] {
  try {
    const parsed: unknown = JSON.parse(UNTRUSTED_PAYLOAD.exec(result)?.[1] ?? result);
    const items = isRecord(parsed) ? parsed["items"] : undefined;
    return (Array.isArray(items) ? items.filter(isRecord) : []).flatMap((item) => {
      if (typeof item["food_id"] !== "string") {
        return [];
      }
      const unit = typeof item["grams"] === "number" ? "g" : "ml";
      const amount = item[unit === "g" ? "grams" : "ml"];
      return typeof amount === "number" ? [{ foodId: item["food_id"], unit, amount }] : [];
    });
  } catch {
    return [];
  }
}

// The kitchen tools whose answers graders compare with core's figures (KEY-1037, and the plan tools of KEY-1038). Every
// other tool keeps only its code.
const KITCHEN_RESULT_TOOLS: ReadonlySet<string> = new Set([
  "get_palate_profile",
  "suggest_recipe",
  "adjust_recipe",
  "plan_meals",
  "replan_day",
]);

/** The JSON a tool answered, from inside its untrusted wrapper. Nothing when the text is not a JSON object. */
export function parsedResultOf(result: string): Record<string, unknown> | undefined {
  try {
    const parsed: unknown = JSON.parse(UNTRUSTED_PAYLOAD.exec(result)?.[1] ?? result);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/**
 * The calls of a whole turn, in order, from every stored message of it: each `tool_use` block, with the error
 * code its `tool_result` block carried when the tool refused it. The code says why a write did not land, such as
 * `not_found` for an id the tool could not find.
 */
export function toolCallsOfTurn(contents: readonly unknown[]): ToolCall[] {
  const codes = new Map<string, string>();
  const results = new Map<string, string>();
  const asked = new Set<string>();
  const answered = new Set<string>();
  for (const block of contents.flatMap(blocksOf)) {
    if (
      isRecord(block) &&
      block["type"] === "tool_result" &&
      typeof block["tool_use_id"] === "string"
    ) {
      const id = block["tool_use_id"];
      answered.add(id);
      const text = block["content"];
      if (typeof text === "string") {
        results.set(id, text);
      }
      const code =
        typeof text === "string" && !SIZED_ITEMS.test(text)
          ? ERROR_CODE.exec(text)?.[1]
          : undefined;
      if (code !== undefined) {
        codes.set(id, code);
      } else if (typeof text === "string" && NEEDS_CONFIRMATION.test(text)) {
        asked.add(id);
      }
    }
  }
  return contents.flatMap(blocksOf).flatMap((block) => {
    if (!isRecord(block) || block["type"] !== "tool_use" || typeof block["name"] !== "string") {
      return [];
    }
    const id = typeof block["id"] === "string" ? block["id"] : undefined;
    const code = id === undefined ? undefined : codes.get(id);
    const outcome =
      id === undefined || code !== undefined
        ? undefined
        : asked.has(id)
          ? ("asked to confirm" as const)
          : // `ask_user` is turned into a question by the loop and never gets a result.
            !answered.has(id) && block["name"] !== "ask_user"
            ? ("no result" as const)
            : undefined;
    const result = id === undefined ? undefined : results.get(id);
    const estimatedAmounts =
      block["name"] === "estimate_portions" && code === undefined && result !== undefined
        ? estimatedAmountsOf(result)
        : [];
    const kitchenResult =
      KITCHEN_RESULT_TOOLS.has(block["name"]) && result !== undefined
        ? parsedResultOf(result)
        : undefined;
    return [
      {
        name: block["name"],
        input: block["input"],
        ...(code === undefined ? {} : { errorCode: code }),
        ...(kitchenResult === undefined ? {} : { result: kitchenResult }),
        ...(outcome === undefined ? {} : { outcome }),
        ...(estimatedAmounts.length === 0 ? {} : { estimatedAmounts }),
      },
    ];
  });
}

async function timeZoneOf(user: FixtureUser): Promise<string | null> {
  const { data, error } = await user.client.from("profiles").select("timezone").maybeSingle();
  if (error) {
    throw new Error(`Could not read the eval user's time zone (${error.code})`);
  }
  return data?.timezone ?? null;
}

/**
 * Closes what a session holds, each step whatever the others do: the kitchen and training worlds, the red-team world
 * (user B), the page server and the eval user. The first failure is thrown once every step has been tried.
 */
const closeEverything = (user: FixtureUser) => async (): Promise<void> => {
  const failures: unknown[] = [];
  for (const step of [
    () => kitchenWorldHolder.detach(),
    () => trainingWorldHolder.detach(),
    () => trainingEditsWorldHolder.detach(),
    () => redTeamWorldHolder.detach(),
    () => stopPageServer(),
    () => user.remove(),
  ]) {
    try {
      await step();
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) {
    throw failures[0];
  }
};

/**
 * The session of a run against the local stack: a new eval user with the synthetic diary and the assistant consent, the HTTP driver
 * for the served `assistant` function, and the eval user's own view of the database. Closing it removes the user and
 * stops the page server if a case started one (`src/pageServerHolder.ts`).
 */
export async function openLocalHttpSession(): Promise<EvalSession> {
  const stack = await readSupabaseStatus(databaseWorkdir);
  const user = await createFixtureUser(stack);
  try {
    // Without the consent the first turn is refused with `consent_needed`. It is the app's own write.
    await setAssistantConsent(user.client, user.id, true);
    // The targets the ask set's "what is left" and "days at target" cases are worked out against.
    await writeAskExtras(user);
    // The training advice cases write the user's history when the first of them is played (KEY-895).
    trainingWorldHolder.attach(createTrainingWorld(user));
    // The training edits cases make their own routines, goals and workouts (KEY-911).
    trainingEditsWorldHolder.attach(createTrainingEditsWorld(user));
    const timeZone = await timeZoneOf(user);
    const getAccessToken = async () => {
      const { data } = await user.client.auth.getSession();
      if (data.session === null) {
        throw new Error("The eval user has no session");
      }
      return data.session.access_token;
    };
    const driver = createHttpDriver({
      apiUrl: stack.apiUrl,
      anonKey: stack.anonKey,
      getAccessToken,
      timeZone,
      readToolCalls: async (turnId) => {
        const { data, error } = await user.client
          .from("assistant_messages")
          .select("content")
          .eq("turn_id", turnId)
          .order("seq", { ascending: true });
        if (error) {
          throw new Error(`Could not read the tool calls of the turn (${error.code})`);
        }
        return toolCallsOfTurn(data.map(({ content }) => content));
      },
    });
    // The service role writes the conversations a case seeds, and nothing else uses it.
    const serviceClient = createClient<Database>(stack.apiUrl, stack.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // The kitchen sets ask for their world when they need it (KEY-1028), so nothing is written for the others.
    kitchenWorldHolder.attach(createKitchenWorld(user, serviceClient));
    // User B and the rows of the red-team set (KEY-702). It cannot fail the session.
    await attachRedTeamWorld({ stack, userA: user, serviceClient });
    return {
      driver,
      database: createEvalDatabase(user.client),
      environment: createCaseEnvironment({
        client: serviceClient,
        userId: user.id,
        undoTurn: createUndoTurn({ client: user.client }),
        restoreTargets: () => writeAskExtras(user),
      }),
      close: closeEverything(user),
    };
  } catch (error) {
    await closeEverything(user)().catch(() => undefined);
    throw error;
  }
}
