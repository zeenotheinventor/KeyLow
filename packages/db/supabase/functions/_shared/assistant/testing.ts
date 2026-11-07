// Stand-ins for the executor's tests: an in-memory action store that enforces the same keys as the
// real tables, a spy on the console, and a way to build a context. Nothing in production imports this.
import { z } from "zod";

import { createRegistry } from "./registry.ts";
import { maxWritesPerTurn } from "./store.ts";

import type {
  ActionRecord,
  ActionStore,
  ActionTarget,
  PendingConfirmation,
  SlotRequest,
  StoredConfirmation,
} from "./store.ts";
import type {
  ConfirmationNeed,
  ReadToolDefinition,
  ToolContext,
  ToolDefinition,
  ToolRunOutput,
  WriteToolDefinition,
} from "./tool.ts";

export const userId = "00000000-0000-4000-8000-0000000000a1";
export const otherUserId = "00000000-0000-4000-8000-0000000000b2";
export const conversationId = "00000000-0000-4000-8000-0000000000c1";
export const turnId = "00000000-0000-4000-8000-0000000000d3";

type FakeTurn = {
  id: string;
  conversationId: string;
  userId: string;
  // A row written before the label was stored has `confirmLabel: null`.
  pending: StoredConfirmation | null;
};

export type FakeActionStore = ActionStore & {
  actions: ActionRecord[];
  turns: FakeTurn[];
  // Counts the calls of the store, by method.
  calls: Record<string, number>;
};

// The real store is awaited over a network, so two parallel callers both read before either writes.
// Yielding between the two steps reproduces that interleaving.
const yieldToOthers = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function createFakeActionStore(
  options: { slotLimit?: number; turns?: FakeTurn[] } = {},
): FakeActionStore {
  const slotLimit = options.slotLimit ?? maxWritesPerTurn;
  const actions: ActionRecord[] = [];
  const turns: FakeTurn[] = options.turns ?? [
    { id: turnId, conversationId, userId, pending: null },
  ];
  const calls: Record<string, number> = {};
  const count = (method: string) => {
    calls[method] = (calls[method] ?? 0) + 1;
  };
  let nextId = 1;

  const mine = (actionId: string, forUser: string) =>
    actions.find((action) => action.id === actionId && action.userId === forUser);
  const turnOf = (id: string, forUser: string) =>
    turns.find((turn) => turn.id === id && turn.userId === forUser);

  return {
    actions,
    turns,
    calls,

    async takenSlots(forTurn) {
      count("takenSlots");
      const slots = actions.filter((a) => a.turnId === forTurn).map((a) => a.turnSeq);
      await yieldToOthers();
      return slots;
    },

    async insertReservation(request: SlotRequest & { turnSeq: number }) {
      count("insertReservation");
      await yieldToOthers();
      if (request.turnSeq < 1 || request.turnSeq > slotLimit) {
        return { outcome: "over_limit" };
      }
      if (actions.some((a) => a.turnId === request.turnId && a.turnSeq === request.turnSeq)) {
        return { outcome: "slot_taken" };
      }
      const record: ActionRecord = {
        id: `action-${nextId++}`,
        userId: request.userId,
        conversationId: request.conversationId,
        turnId: request.turnId,
        turnSeq: request.turnSeq,
        tool: request.tool,
        targetTable: request.targetTable,
        targetId: null,
        targetIds: null,
        targetLocalDate: null,
        targetUpdatedAt: null,
        undoneAt: null,
      };
      actions.push(record);
      return { outcome: "reserved", actionId: record.id };
    },

    fillTarget(actionId: string, forUser: string, target: ActionTarget) {
      count("fillTarget");
      const action = mine(actionId, forUser);
      if (action !== undefined) {
        action.targetId = target.targetId ?? null;
        action.targetIds = target.targetIds ?? null;
        action.targetLocalDate = target.targetLocalDate ?? null;
        action.targetUpdatedAt = target.targetUpdatedAt ?? null;
      }
      return Promise.resolve();
    },

    release(actionId: string, forUser: string) {
      count("release");
      const index = actions.findIndex((a) => a.id === actionId && a.userId === forUser);
      if (index !== -1) {
        actions.splice(index, 1);
      }
      return Promise.resolve();
    },

    findAction(actionId: string, forUser: string) {
      count("findAction");
      const found = mine(actionId, forUser);
      return Promise.resolve(found === undefined ? null : { ...found });
    },

    claimUndo(actionId: string, forUser: string, undoneAt: string) {
      count("claimUndo");
      const action = mine(actionId, forUser);
      if (action === undefined || action.undoneAt !== null) {
        return Promise.resolve(false);
      }
      action.undoneAt = undoneAt;
      return Promise.resolve(true);
    },

    releaseUndoClaim(actionId: string, forUser: string) {
      count("releaseUndoClaim");
      const action = mine(actionId, forUser);
      if (action !== undefined) {
        action.undoneAt = null;
      }
      return Promise.resolve();
    },

    previousPendingConfirmation(forConversation: string, forUser: string, currentTurn: string) {
      count("previousPendingConfirmation");
      // The turns are kept oldest first, so a turn is earlier when it sits before the current one.
      const inConversation = turns.filter(
        (t) => t.conversationId === forConversation && t.userId === forUser,
      );
      const position = inConversation.findIndex((t) => t.id === currentTurn);
      const previous = position === -1 ? undefined : inConversation[position - 1];
      return Promise.resolve(
        previous === undefined || previous.pending === null
          ? null
          : { turnId: previous.id, confirmation: { ...previous.pending } },
      );
    },

    storePendingConfirmation(forTurn: string, forUser: string, confirmation: PendingConfirmation) {
      count("storePendingConfirmation");
      const turn = turnOf(forTurn, forUser);
      if (turn !== undefined) {
        turn.pending = { ...confirmation };
      }
      return Promise.resolve();
    },

    async spendPendingConfirmation(forTurn: string, forUser: string, confirmationId: string) {
      count("spendPendingConfirmation");
      await yieldToOthers();
      const turn = turnOf(forTurn, forUser);
      if (turn === undefined || turn.pending?.id !== confirmationId) {
        return false;
      }
      turn.pending = null;
      return true;
    },
  };
}

// Turns of one conversation, oldest first, with the current one last.
export function turnsOfConversation(
  ids: string[],
  pending: Record<string, StoredConfirmation> = {},
  inConversation: string = conversationId,
): FakeTurn[] {
  return ids.map((id) => ({
    id,
    conversationId: inConversation,
    userId,
    pending: pending[id] ?? null,
  }));
}

export type ConsoleSpy = { lines: string[]; restore: () => void };

// Records every console line, so a test can assert that no health value was logged.
export function spyOnConsole(): ConsoleSpy {
  const lines: string[] = [];
  const originals = {
    log: console.log,
    info: console.info,
    warn: console.warn,
    error: console.error,
    debug: console.debug,
  };
  for (const method of Object.keys(originals) as (keyof typeof originals)[]) {
    console[method] = (...args: unknown[]) => {
      lines.push(args.map(String).join(" "));
    };
  }
  return { lines, restore: () => Object.assign(console, originals) };
}

export type ReportedFailure = { functionName: string; code: string; caught: unknown };

export type FakeContext = {
  ctx: ToolContext;
  store: FakeActionStore;
  reported: ReportedFailure[];
};

// The caller client is never used by the fake tools, so it is an empty object.
export function createFakeContext(
  tools: readonly ToolDefinition[],
  overrides: {
    store?: FakeActionStore;
    allowedTools?: ReadonlySet<string> | undefined;
    userMessageText?: string | null;
    // The person's own words, which the context block and the tool results are never part of.
    personsWords?: string | null;
    turn?: { id: string; conversationId: string };
    localDate?: string;
    localTime?: string | null;
  } = {},
): FakeContext {
  const store = overrides.store ?? createFakeActionStore();
  const reported: ReportedFailure[] = [];
  const ctx: ToolContext = {
    caller: Object.create(null),
    actions: store,
    userId,
    turn: {
      id: overrides.turn?.id ?? turnId,
      conversationId: overrides.turn?.conversationId ?? conversationId,
      userMessageText:
        "userMessageText" in overrides ? (overrides.userMessageText ?? null) : "log my lunch",
      personsWords: overrides.personsWords ?? null,
      localDate: overrides.localDate ?? "2026-11-03",
      localTime: "localTime" in overrides ? (overrides.localTime ?? null) : "08:10",
    },
    registry: createRegistry(tools),
    allowedTools:
      "allowedTools" in overrides
        ? overrides.allowedTools
        : new Set(tools.map((tool) => tool.name)),
    reportError: (functionName, code, caught) => {
      reported.push({ functionName, code, caught });
    },
  };
  return { ctx, store, reported };
}

// What a confirming fake tool answers: the words a real tool builds from the board.
export const fakeAsk: Exclude<ConfirmationNeed, false> = {
  question: "Delete the lunch entries?",
  confirmLabel: "Delete them",
};

export const noteInput = z.object({ note: z.string(), extra: z.string().optional() });
type NoteInput = z.infer<typeof noteInput>;

export type FakeToolOptions = {
  name?: string;
  run?: (input: NoteInput) => Promise<{ target: ActionTarget | null }>;
  needsConfirmation?: (input: NoteInput) => ConfirmationNeed;
  inverse?: WriteToolDefinition<NoteInput>["inverse"];
  refusesDuringWorkout?: true;
};

// A write tool that counts its runs. By default it lands one row.
export function fakeWriteTool(options: FakeToolOptions = {}) {
  const runs: NoteInput[] = [];
  const definition: WriteToolDefinition<NoteInput> = {
    name: options.name ?? "fake_write",
    description: "A fake write.",
    kind: "write",
    input: noteInput,
    annotations: { readOnlyHint: false, destructiveHint: false },
    targetTable: "log_entries",
    ...(options.needsConfirmation === undefined
      ? {}
      : { needsConfirmation: options.needsConfirmation }),
    ...(options.refusesDuringWorkout === undefined ? {} : { refusesDuringWorkout: true as const }),
    inverse: "inverse" in options ? (options.inverse ?? null) : () => Promise.resolve("undone"),
    async run(_ctx, input) {
      runs.push(input);
      const result = (await options.run?.(input)) ?? {
        target: { targetId: `row-${runs.length}`, targetUpdatedAt: "2026-11-02T10:00:00.000Z" },
      };
      return { data: { saved: true }, structured: { card: "saved" }, target: result.target };
    },
  };
  return { definition, runs };
}

export function fakeReadTool(name: string, output: ToolRunOutput = { data: { rows: [] } }) {
  const runs: unknown[] = [];
  const definition: ReadToolDefinition<NoteInput> = {
    name,
    description: "A fake read.",
    kind: "read",
    input: noteInput,
    annotations: { readOnlyHint: true },
    run(_ctx, input) {
      runs.push(input);
      return Promise.resolve(output);
    },
  };
  return { definition, runs };
}
