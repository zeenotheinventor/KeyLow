// A scripted reply as the Messages API streams it (Server-Sent Events), so the real Anthropic SDK in the
// `assistant` function parses it as it would a live one. The order is the one the API documents:
// `message_start`, `ping`, then each block as `content_block_start`, its deltas and `content_block_stop`,
// then `message_delta` (the stop reason and the output tokens) and `message_stop`.
import type { ScriptedBlock, ScriptedReply } from "./anthropicMock";

/** What a request with no script registered is answered with: one short text reply that ends the turn. */
export const defaultReply: ScriptedReply = {
  blocks: [{ type: "text", text: "Noted." }],
  stopReason: "end_turn",
};

const MODEL = "claude-haiku-5-5";
const DEFAULT_INPUT_TOKENS = 100;
const DEFAULT_OUTPUT_TOKENS = 20;

const event = (name: string, data: Record<string, unknown>) =>
  `event: ${name}\ndata: ${JSON.stringify({ type: name, ...data })}\n\n`;

// Words with the space that follows, so the SDK sees several deltas and a test sees them join back.
const chunksOf = (text: string): string[] => text.split(/(?<= )/).filter((chunk) => chunk !== "");

function blockEvents(block: ScriptedBlock, index: number): string[] {
  const delta = (body: Record<string, unknown>) =>
    event("content_block_delta", { index, delta: body });
  if (block.type === "text") {
    return [
      event("content_block_start", { index, content_block: { type: "text", text: "" } }),
      ...chunksOf(block.text).map((chunk) => delta({ type: "text_delta", text: chunk })),
      event("content_block_stop", { index }),
    ];
  }
  const json = JSON.stringify(block.input);
  const middle = Math.floor(json.length / 2);
  return [
    event("content_block_start", {
      index,
      content_block: { type: "tool_use", id: block.id, name: block.name, input: {} },
    }),
    delta({ type: "input_json_delta", partial_json: json.slice(0, middle) }),
    delta({ type: "input_json_delta", partial_json: json.slice(middle) }),
    event("content_block_stop", { index }),
  ];
}

/** The whole stream of one reply. `index` is the reply's place in its script and makes its message id. */
export function messageStreamOf(reply: ScriptedReply, index: number): string {
  const usage = reply.usage ?? {};
  return [
    event("message_start", {
      message: {
        id: `msg_mock_${index}`,
        type: "message",
        role: "assistant",
        model: MODEL,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: {
          input_tokens: usage.input ?? DEFAULT_INPUT_TOKENS,
          output_tokens: 1,
          cache_read_input_tokens: usage.cacheRead ?? 0,
          cache_creation_input_tokens: usage.cacheCreation ?? 0,
        },
      },
    }),
    event("ping", {}),
    ...reply.blocks.flatMap(blockEvents),
    event("message_delta", {
      delta: { stop_reason: reply.stopReason, stop_sequence: null },
      usage: { output_tokens: usage.output ?? DEFAULT_OUTPUT_TOKENS },
    }),
    event("message_stop", {}),
  ].join("");
}
