// How the assistant suites call the served `assistant` function and read what it streams back. The gates
// suite and the turn suite both use it, so the two cannot drift apart on what a consented user is or on how
// a stream is read.
import { ASSISTANT_CONSENT_VERSION, parseAssistantEvent } from "@keylow/core";
import { inject } from "vitest";

import { createTestUser } from "./users";

import type { TestUser } from "./users";
import type { AssistantStreamEvent } from "@keylow/core";

export type AssistantResponse = { status: number; headers: Headers; text: string };

export async function callAssistant(
  route: string,
  options: { method?: "GET" | "POST"; user?: TestUser; body?: unknown } = {},
): Promise<AssistantResponse> {
  const { apiUrl, anonKey } = inject("stack");
  const method = options.method ?? "POST";
  const response = await fetch(`${apiUrl}/functions/v1/assistant/${route}`, {
    method,
    headers: {
      apikey: anonKey,
      "Content-Type": "application/json",
      ...(options.user === undefined
        ? {}
        : { Authorization: `Bearer ${options.user.accessToken}` }),
    },
    body: method === "GET" ? null : JSON.stringify(options.body ?? {}),
    // A turn with a tool round is several calls, each a hop to the `mcp` function.
    signal: AbortSignal.timeout(60_000),
  });
  return { status: response.status, headers: response.headers, text: await response.text() };
}

/** The stream's events, each parsed with the core schema. An event that does not parse fails with its field paths. */
export function eventsOf(response: AssistantResponse): AssistantStreamEvent[] {
  return response.text
    .split("\n\n")
    .filter((block) => block !== "")
    .map((block) => {
      const parsed = parseAssistantEvent(block.replace(/^data: /, ""));
      if (!parsed.ok) {
        throw new Error(
          `The stream held an event that is not one: ${parsed.reason} ${parsed.fieldPaths.join(",")}`,
        );
      }
      return parsed.event;
    });
}

export const turnBody = (text = "two eggs on toast") => ({
  conversationId: null,
  text,
  localDate: "2026-10-25",
  localTime: null,
});

/** A new user who has accepted the assistant's consent, unless `consented` is false. */
export async function newAssistantUser(
  suite: string,
  options: { consented?: boolean } = {},
): Promise<TestUser> {
  const user = await createTestUser(suite);
  if (options.consented !== false) {
    const { error } = await user.client
      .from("profiles")
      .update({
        assistant_consent_at: new Date().toISOString(),
        assistant_consent_version: ASSISTANT_CONSENT_VERSION,
      })
      .eq("id", user.id);
    if (error) {
      throw new Error("Could not record the consent", { cause: error });
    }
  }
  return user;
}
