import { setAssistantConsent } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";

import { createCaseEnvironment } from "./caseEnvironment.ts";
import { createEvalDatabase } from "./database.ts";
import { createFixtureUser } from "./fixtureUser.ts";
import { createHttpDriver } from "./httpDriver.ts";
import { createUndoTurn } from "./undoTurn.ts";
import { readSupabaseStatus } from "../../../packages/db/scripts/supabaseStatus.ts";
import { writeAskExtras } from "../fixtures/askExtras.ts";

import type { EvalSession } from "./cli.ts";
import type { FixtureUser } from "./fixtureUser.ts";
import type { ToolCall } from "./types.ts";
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

/**
 * The calls of a whole turn, in order, from every stored message of it: each `tool_use` block, with the error
 * code its `tool_result` block carried when the tool refused it. The code says why a write did not land, such as
 * `not_found` for an id the tool could not find.
 */
export function toolCallsOfTurn(contents: readonly unknown[]): ToolCall[] {
  const codes = new Map<string, string>();
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
      const code = typeof text === "string" ? ERROR_CODE.exec(text)?.[1] : undefined;
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
    return [
      {
        name: block["name"],
        input: block["input"],
        ...(code === undefined ? {} : { errorCode: code }),
        ...(outcome === undefined ? {} : { outcome }),
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
 * The session of a run against the local stack: a new eval user with the synthetic diary and the assistant consent, the HTTP driver
 * for the served `assistant` function, and the eval user's own view of the database. Closing it removes the
 * user.
 */
export async function openLocalHttpSession(): Promise<EvalSession> {
  const stack = await readSupabaseStatus(databaseWorkdir);
  const user = await createFixtureUser(stack);
  try {
    // Without the consent the first turn is refused with `consent_needed`. It is the app's own write.
    await setAssistantConsent(user.client, user.id, true);
    // The targets the ask set's "what is left" and "days at target" cases are worked out against.
    await writeAskExtras(user);
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
    return {
      driver,
      database: createEvalDatabase(user.client),
      environment: createCaseEnvironment({
        client: serviceClient,
        userId: user.id,
        undoTurn: createUndoTurn({ client: user.client }),
        restoreTargets: () => writeAskExtras(user),
      }),
      close: user.remove,
    };
  } catch (error) {
    await user.remove();
    throw error;
  }
}
