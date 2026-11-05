import { setAssistantConsent, undoAssistantActions } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";

import { createCaseEnvironment } from "./caseEnvironment.ts";
import { createEvalDatabase } from "./database.ts";
import { createFixtureUser } from "./fixtureUser.ts";
import { createHttpDriver } from "./httpDriver.ts";
import { startPageServer } from "./pageServer.ts";
import { readSupabaseStatus } from "../../../packages/db/scripts/supabaseStatus.ts";
import { writeAskExtras } from "../fixtures/askExtras.ts";
import { fixturePages } from "../fixtures/pages/index.ts";

import type { EvalSession } from "./cli.ts";
import type { FixtureUser } from "./fixtureUser.ts";
import type { ToolCall } from "./types.ts";
import type { Database } from "@keylow/api-client";

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
 * for the served `assistant` function, and the eval user's own view of the database. It also starts the page
 * server the recipe import cases read their pages from (`src/pageServer.ts`). Closing it removes the user and
 * stops the server.
 */
export async function openLocalHttpSession(): Promise<EvalSession> {
  const stack = await readSupabaseStatus(databaseWorkdir);
  const pageServer = await startPageServer(fixturePages);
  const user = await createFixtureUser(stack).catch(async (error: unknown) => {
    await pageServer.close();
    throw error;
  });
  try {
    // Without the consent the first turn is refused with `consent_needed`. It is the app's own write.
    await setAssistantConsent(user.client, user.id, true);
    // The targets the ask set's "what is left" and "days at target" cases are worked out against.
    await writeAskExtras(user);
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
        undoActions: (actionIds) => undoAssistantActions(user.client, actionIds),
      }),
      close: async () => {
        // The server stops even when removing the user fails, or the run would not end.
        try {
          await user.remove();
        } finally {
          await pageServer.close();
        }
      },
    };
  } catch (error) {
    try {
      await user.remove();
    } finally {
      await pageServer.close();
    }
    throw error;
  }
}
