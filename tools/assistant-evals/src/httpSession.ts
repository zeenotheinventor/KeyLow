import { setAssistantConsent } from "@keylow/api-client";

import { createEvalDatabase } from "./database.ts";
import { createFixtureUser } from "./fixtureUser.ts";
import { createHttpDriver } from "./httpDriver.ts";
import { readSupabaseStatus } from "../../../packages/db/scripts/supabaseStatus.ts";

import type { EvalSession } from "./cli.ts";
import type { FixtureUser } from "./fixtureUser.ts";
import type { ToolCall } from "./types.ts";

// packages/db, which holds the Supabase project the CLI reads the stack status for.
const databaseWorkdir = new URL("../../../packages/db", import.meta.url).pathname;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/** The `tool_use` blocks of a stored assistant message, in order. Anything else in the content is left out. */
export function toolCallsOf(content: unknown): ToolCall[] {
  if (!Array.isArray(content)) {
    return [];
  }
  return content.flatMap((block: unknown) =>
    isRecord(block) && block["type"] === "tool_use" && typeof block["name"] === "string"
      ? [{ name: block["name"], input: block["input"] }]
      : [],
  );
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
    const timeZone = await timeZoneOf(user);
    const driver = createHttpDriver({
      apiUrl: stack.apiUrl,
      anonKey: stack.anonKey,
      getAccessToken: async () => {
        const { data } = await user.client.auth.getSession();
        if (data.session === null) {
          throw new Error("The eval user has no session");
        }
        return data.session.access_token;
      },
      timeZone,
      readToolCalls: async (turnId) => {
        const { data, error } = await user.client
          .from("assistant_messages")
          .select("content")
          .eq("turn_id", turnId)
          .eq("role", "assistant")
          .order("seq", { ascending: true });
        if (error) {
          throw new Error(`Could not read the tool calls of the turn (${error.code})`);
        }
        return data.flatMap(({ content }) => toolCallsOf(content));
      },
    });
    return { driver, database: createEvalDatabase(user.client), close: user.remove };
  } catch (error) {
    await user.remove();
    throw error;
  }
}
