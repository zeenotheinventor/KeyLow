import type { CaseEnvironment, UndoOutcome } from "../src/case.ts";

type FakeEnvironmentOptions = {
  /** What Undo answers for a turn, in the order the actions were written. A turn that is not listed has no actions. */
  undoOutcomes?: Readonly<Record<string, readonly UndoOutcome[]>>;
};

/** A case environment that records what it was asked and answers from the lists it was given. */
export function fakeEnvironment(options: FakeEnvironmentOptions = {}): CaseEnvironment & {
  calls: string[];
} {
  const calls: string[] = [];
  return {
    calls,
    seedConversation: (turns) => {
      calls.push(`seed ${turns.length}`);
      return Promise.resolve("seeded-conversation");
    },
    waitForCompaction: (conversationId) => {
      calls.push(`wait ${conversationId}`);
      return Promise.resolve();
    },
    undoTurn: (turnId) => {
      calls.push(`undo ${turnId}`);
      return Promise.resolve(options.undoOutcomes?.[turnId] ?? []);
    },
    restoreTargets: () => {
      calls.push("restore targets");
      return Promise.resolve();
    },
  };
}
