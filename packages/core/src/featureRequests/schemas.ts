import { z } from "zod";

import { characterCount } from "../recipes/characterCount";

export const FEATURE_REQUEST_TEXT_MIN = 3;
export const FEATURE_REQUEST_TEXT_MAX = 1000;

const MAX_CONTEXT_ASK_LENGTH = 500;
const MAX_CONTEXT_UNSUPPORTED_LENGTH = 200;
const MAX_CONTEXT_TURN_LENGTH = 500;
const MAX_CONTEXT_TURNS = 6;

/** The request as typed, trimmed, and between the bounds the database checks. */
export const featureRequestTextSchema = z
  .string()
  .trim()
  .refine(
    (text) =>
      characterCount(text) >= FEATURE_REQUEST_TEXT_MIN &&
      characterCount(text) <= FEATURE_REQUEST_TEXT_MAX,
    {
      message: `Request must be ${FEATURE_REQUEST_TEXT_MIN} to ${FEATURE_REQUEST_TEXT_MAX} characters`,
    },
  );

export const featureRequestSourceSchema = z.enum(["assistant", "more_menu"]);

const textOfAtMost = (maximumLength: number) =>
  z.string().refine((text) => characterCount(text) <= maximumLength, {
    message: `Text must be at most ${maximumLength} characters`,
  });

/**
 * What the assistant sends with a request: the ask, what was unsupported, and the last few turns.
 * No ids, tool calls, tool results or diary rows.
 */
export const featureRequestContextSchema = z.strictObject({
  version: z.literal(1),
  ask: textOfAtMost(MAX_CONTEXT_ASK_LENGTH),
  unsupported: textOfAtMost(MAX_CONTEXT_UNSUPPORTED_LENGTH),
  recent: z
    .array(
      z.strictObject({
        role: z.enum(["user", "assistant"]),
        text: textOfAtMost(MAX_CONTEXT_TURN_LENGTH),
      }),
    )
    .max(MAX_CONTEXT_TURNS),
});

export type FeatureRequestContext = z.infer<typeof featureRequestContextSchema>;
export type FeatureRequestSource = z.infer<typeof featureRequestSourceSchema>;

/**
 * What a caller sends to file a request. A `more_menu` request has no context and an `assistant`
 * request must have one, as the database checks. The parsed value always carries a context, null
 * for `more_menu`.
 */
export const featureRequestInputSchema = z.discriminatedUnion("source", [
  z.strictObject({
    source: z.literal("more_menu"),
    request: featureRequestTextSchema,
    context: z.null().optional().default(null),
  }),
  z.strictObject({
    source: z.literal("assistant"),
    request: featureRequestTextSchema,
    context: featureRequestContextSchema,
  }),
]);

export type FeatureRequestInput = z.input<typeof featureRequestInputSchema>;
export type FeatureRequest = z.output<typeof featureRequestInputSchema>;
