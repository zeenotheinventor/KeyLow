import { z } from "zod";

import { isConfirmAnswer } from "./confirmAnswer";
import {
  MAX_CONTEXT_ASK_LENGTH,
  MAX_CONTEXT_TURN_LENGTH,
  MAX_CONTEXT_TURNS,
  MAX_CONTEXT_UNSUPPORTED_LENGTH,
} from "../featureRequests";

import type { FeatureRequestContext } from "../featureRequests";

/** A row of `assistant_messages` as the function reads it: the place in the conversation, the role and the stored content blocks. */
export type StoredFeatureRequestMessage = { seq: number; role: string; content: unknown };

const blocksSchema = z.array(z.looseObject({ type: z.string(), text: z.string().optional() }));

/** The first `maximum` characters, counted as code points so an emoji is never cut in half. */
const clipped = (text: string, maximum: number): string =>
  Array.from(text.trim()).slice(0, maximum).join("");

// The person's own words are the last block of their message, when it is text. The loop stores a message as
// the results of open calls, then the context block, then the person's words, so the last block is never a
// tool result or the context block. A message stored before the loop rewrote it is plain text.
function personsWords(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  const blocks = blocksSchema.safeParse(content);
  const last = blocks.success ? blocks.data.at(-1) : undefined;
  return last?.type === "text" ? (last.text ?? "") : "";
}

// The assistant's words are its text blocks. Its tool calls and thinking are never read.
function assistantWords(content: unknown): string {
  if (typeof content === "string") {
    return content;
  }
  const blocks = blocksSchema.safeParse(content);
  return blocks.success
    ? blocks.data
        .filter((block) => block.type === "text")
        .map((block) => block.text ?? "")
        .join("\n")
    : "";
}

/**
 * What goes with a feature request the assistant raised, built here and never by the model: the person's
 * latest own words that are not the confirm button's, what Ki-Lo cannot do, and the last few text
 * messages of the conversation. Tool calls, tool results, the context block, thinking and ids are never
 * read. A message of any other role is ignored.
 */
export function buildFeatureRequestContext({
  messages,
  confirmLabel,
  input,
}: {
  messages: readonly StoredFeatureRequestMessage[];
  /** The words of the button that confirmed the request, which are not the person's ask. */
  confirmLabel: string;
  input: { unsupported: string };
}): FeatureRequestContext {
  const texts = [...messages]
    .sort((first, second) => first.seq - second.seq)
    .flatMap(({ role, content }): FeatureRequestContext["recent"] => {
      if (role !== "user" && role !== "assistant") {
        return [];
      }
      const text = clipped(
        role === "user" ? personsWords(content) : assistantWords(content),
        MAX_CONTEXT_TURN_LENGTH,
      );
      return text === "" ? [] : [{ role, text }];
    });
  const ask = texts
    .filter(({ role, text }) => role === "user" && !isConfirmAnswer(text, confirmLabel))
    .at(-1);
  return {
    version: 1,
    ask: clipped(ask?.text ?? "", MAX_CONTEXT_ASK_LENGTH),
    unsupported: clipped(input.unsupported, MAX_CONTEXT_UNSUPPORTED_LENGTH),
    recent: texts.slice(-MAX_CONTEXT_TURNS),
  };
}
