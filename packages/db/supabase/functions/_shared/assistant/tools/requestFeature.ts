// Offers the Ki-Lo team a feature request when the app has no such feature, and sends it on the person's
// word. The call always asks first. The confirmation protocol is the explicit OK: nothing is written until
// the person presses Send request or types its words, and then the turn loop makes the stored call itself
// (ADR 0006, Amendment 4). The context that goes with the request is built here from the stored chat in core,
// never by the model. Nothing the person wrote goes into a log, an error, Sentry or analytics.
import { z } from "zod";

import {
  buildFeatureRequestContext,
  buildFeatureRequestedCard,
  confirmFeatureRequestButtons,
  confirmFeatureRequestNote,
  confirmFeatureRequestQuestion,
} from "../../core.ts";
import { createFeatureRequest } from "../../repos.ts";

import type {
  ConfirmationNeed,
  ToolContext,
  WriteRunOutput,
  WriteToolDefinition,
} from "../tool.ts";

const requestFeatureInput = z.strictObject({
  request: z.string().trim().min(3).max(300).describe("The feature, in the person's own terms."),
  unsupported: z.string().trim().min(3).max(200).describe("What Ki-Lo cannot do."),
});

type RequestFeatureInput = z.infer<typeof requestFeatureInput>;

// The newest messages the context is built from. Core keeps the last few text ones.
const MESSAGES_READ = 12;

const rateLimitedCause = z.object({ code: z.literal("rate_limited") });

// The repo's error holds the action and a code and nothing else, so it is safe to report once the cap is told apart.
const isRateLimited = (caught: unknown): boolean =>
  caught instanceof Error && rateLimitedCause.safeParse(caught.cause).success;

// The person's own chat, read under their JWT so row level security scopes it. A failure carries a code only.
async function readMessages(ctx: ToolContext) {
  const { data, error } = await ctx.caller
    .from("assistant_messages")
    .select("seq, role, content")
    .eq("conversation_id", ctx.turn.conversationId)
    .order("seq", { ascending: false })
    .limit(MESSAGES_READ);
  if (error !== null) {
    throw new Error(`Could not read the conversation (${error.code})`);
  }
  return data;
}

export const requestFeatureTool: WriteToolDefinition<RequestFeatureInput> = {
  name: "request_feature",
  description:
    "Offers to send the Ki-Lo team a feature request when Ki-Lo has no such feature at all. Never for " +
    "something done elsewhere in the app, a medical or injury limit, after a tool error, after the user " +
    "declined, or twice for one ask. The call answers needs_confirmation: in the same response as the " +
    "call, before it, say in one sentence that Ki-Lo does not do that and ask if they want it sent as a " +
    "feature request. Nothing is sent until they press Send request. When they decline, do not call " +
    "again. rate_limited means too many requests today.",
  kind: "write",
  // Its confirmation id would take the 15th of the union parameters a request may hold, over the cap in
  // `registry.test.ts`, so the tool opts out. The executor checks every input with the same schema.
  strict: false,
  input: requestFeatureInput,
  annotations: { readOnlyHint: false, destructiveHint: false },
  targetTable: "feature_requests",
  // Always asks, so a model cannot file a request on its own.
  needsConfirmation(): ConfirmationNeed {
    return {
      question: confirmFeatureRequestQuestion(),
      confirmLabel: confirmFeatureRequestButtons().confirmLabel,
      note: confirmFeatureRequestNote(),
    };
  },
  async run(ctx, { request, unsupported }): Promise<WriteRunOutput> {
    const messages = await readMessages(ctx);
    const context = buildFeatureRequestContext({
      messages,
      confirmLabel: confirmFeatureRequestButtons().confirmLabel,
      input: { unsupported },
    });
    let sent;
    try {
      sent = await createFeatureRequest(ctx.caller, { source: "assistant", request, context });
    } catch (caught) {
      if (isRateLimited(caught)) {
        return { data: { error: "rate_limited" }, target: null };
      }
      throw caught;
    }
    return {
      data: { sent: true },
      structured: { card: buildFeatureRequestedCard({ request }) },
      target: { targetId: sent.id },
    };
  },
  // A client cannot delete a request, so there is nothing to undo.
  inverse: null,
};
