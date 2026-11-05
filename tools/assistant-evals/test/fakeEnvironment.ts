import type { CaseEnvironment, UndoOutcome } from "../src/case.ts";

type FakeEnvironmentOptions = {
  /**
   * What Undo answers for a turn, one list for each press, in the order the actions were written. A turn that
   * is not listed has no actions, and a press past the end answers the last list again.
   */
  undoPresses?: Readonly<Record<string, readonly (readonly UndoOutcome[])[]>>;
};

/** A case environment that records what it was asked and answers from the lists it was given. */
export function fakeEnvironment(options: FakeEnvironmentOptions = {}): CaseEnvironment & {
  calls: string[];
} {
  const calls: string[] = [];
  const pressed = new Map<string, number>();
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
      const presses = options.undoPresses?.[turnId] ?? [];
      const press = pressed.get(turnId) ?? 0;
      pressed.set(turnId, press + 1);
      return Promise.resolve(presses[Math.min(press, presses.length - 1)] ?? []);
    },
    restoreTargets: () => {
      calls.push("restore targets");
      return Promise.resolve();
    },
  };
}
