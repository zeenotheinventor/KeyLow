// The compaction set (KEY-706): one case that proves a conversation carries on after its older turns have
// been replaced by a note. The case seeds a long, text-only conversation for the run's own eval user, so
// the turn that follows passes the compaction threshold. That turn triggers the compaction, which runs after
// the answer, so the case waits for the note and then asks about the early answer. The note has to hold it,
// because the turn that gave it is no longer sent.
import { answerContainsNumber, rowsExist } from "../src/case.ts";

import type { EvalCase, Grader, SeedTurn } from "../src/case.ts";

const EARLY_REPLY = "Your average last week was 1,850 kcal a day.";

// Sentences with no number and no food in them, so the only figure in the history is the one asked about.
const FILLER_SENTENCES = [
  "We went through how the week was planned and which days were still left to fill in.",
  "The plan stays flexible, and nothing was changed in the diary while we talked about it.",
  "It helps to look at the whole week together instead of judging a single day on its own.",
  "Some days were busier than others, and the plan allows for that without any fuss.",
  "A quiet weekend gives more room to cook, so those days were kept open for it.",
  "Nothing needed correcting here, and no entry was added, moved or removed.",
  "The shopping for the week was talked through in general terms and left for later.",
  "A steady routine is easier to follow than a strict one, so the plan stays loose.",
  "Evenings were kept for the main meal, and the other meals were left to suit the day.",
  "There was no question waiting for an answer, and the conversation simply carried on.",
  "The notes on how the week felt were kept short and were not turned into targets.",
  "Planning ahead was treated as a convenience and never as a rule to be kept.",
] as const;

const ORDINALS = [
  "first",
  "second",
  "third",
  "fourth",
  "fifth",
  "sixth",
  "seventh",
  "eighth",
  "ninth",
  "tenth",
  "eleventh",
  "twelfth",
] as const;

// Enough turns that the history alone is about 136,000 characters, which is 30,000 to 34,000 tokens. With the
// system prompt and the tools (22,000 tokens or more) that puts the next turn's prompt above the 46,000 token
// threshold with room to spare (KEY-927 raised it from 20,000, KEY-952 from 40,000 and KEY-964 from 42,000).
const SEED_TURN_COUNT = 90;
const SENTENCES_PER_REPLY = 18;

function fillerReply(turnIndex: number): string {
  return Array.from(
    { length: SENTENCES_PER_REPLY },
    (_, offset) => FILLER_SENTENCES[(turnIndex * 5 + offset) % FILLER_SENTENCES.length],
  ).join(" ");
}

/** The earlier turns of the conversation, in order. The second one holds the answer the case asks about. */
export function compactionSeed(): SeedTurn[] {
  return Array.from({ length: SEED_TURN_COUNT }, (_, index): SeedTurn => {
    const ordinal = ORDINALS[index % ORDINALS.length];
    if (index === 1) {
      return {
        user: "How did last week average out?",
        assistant: `${EARLY_REPLY} ${fillerReply(index)}`,
      };
    }
    return {
      user: `Let us go over the ${ordinal} part of the plan again.`,
      assistant: fillerReply(index),
    };
  });
}

// The note was stored for the turn that triggered it, which is the first message of the case.
const noteStoredForFirstTurn: Grader = (context) => {
  const first = context.turns[0];
  if (first === undefined) {
    return Promise.resolve({ passed: false, reason: "the case has no first turn" });
  }
  return rowsExist({
    table: "assistant_conversations",
    where: { id: first.conversationId, compacted_through_turn_id: first.turnId },
  })(context);
};

export const compactionCases: readonly EvalCase[] = [
  {
    id: "compaction-keeps-an-early-answer",
    set: "compaction",
    setup: (environment) => environment.seedConversation(compactionSeed()),
    messages: [
      "Thanks, that all sounds right.",
      "What did you tell me my daily average was last week?",
    ],
    afterTurn: async ({ index, result }, environment) => {
      // The compaction runs after the answer, so the question waits for the note.
      if (index === 0) {
        await environment.waitForCompaction(result.conversationId);
      }
    },
    expect: [noteStoredForFirstTurn, answerContainsNumber(1850)],
  },
];
