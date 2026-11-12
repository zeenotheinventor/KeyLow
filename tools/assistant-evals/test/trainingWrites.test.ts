import { createClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LIBRARY_EXERCISE_KEYS, setsOfSession, trainingSessions } from "../fixtures/training.ts";
import { writeSessions } from "../fixtures/trainingWrites.ts";

import type { TrainingExercise } from "../fixtures/training.ts";
import type { Database } from "@keylow/api-client";

type StoredSession = { id: string; started_at: string; ended_at: string | null };

// A stand-in for the app's session repos that keeps sessions in memory and behaves as they do where it matters
// here: a start hands back the session already in progress, a finish ends it, and a delete removes it.
const world = vi.hoisted(() => ({
  sessions: [] as StoredSession[],
  deleted: [] as string[],
  startCalls: 0,
  setsLogged: 0,
  failAfterSets: null as number | null,
}));

vi.mock("@keylow/api-client", () => ({
  startSession: (_client: unknown, { now }: { now: Date }) => {
    world.startCalls += 1;
    const open = world.sessions.find(({ ended_at }) => ended_at === null);
    if (open !== undefined) {
      return Promise.resolve(open);
    }
    const created = {
      id: `session-${world.startCalls}`,
      started_at: now.toISOString(),
      ended_at: null,
    };
    world.sessions.push(created);
    return Promise.resolve(created);
  },
  addSet: () => {
    world.setsLogged += 1;
    return world.failAfterSets !== null && world.setsLogged > world.failAfterSets
      ? Promise.reject(new Error("the connection dropped"))
      : Promise.resolve();
  },
  finishSession: (_client: unknown, id: string, { endedAt }: { endedAt: Date }) => {
    const session = world.sessions.find((candidate) => candidate.id === id);
    if (session !== undefined) {
      session.ended_at = endedAt.toISOString();
    }
    return Promise.resolve(session);
  },
  deleteSession: (_client: unknown, id: string) => {
    world.deleted.push(id);
    world.sessions = world.sessions.filter((candidate) => candidate.id !== id);
    return Promise.resolve();
  },
}));

// The one read the writer makes itself is a plain select on `workout_sessions`, answered from the same memory
// at the network level, so the client is a real one.
const client = createClient<Database>("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    fetch: () =>
      Promise.resolve(
        new Response(JSON.stringify(world.sessions), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
  },
});

const exerciseIds = new Map<TrainingExercise, string>(
  [...LIBRARY_EXERCISE_KEYS, "facePull" as const].map((key) => [key, `id-of-${key}`]),
);
const ANCHOR = "2030-06-15";

beforeEach(() => {
  world.sessions = [];
  world.deleted = [];
  world.startCalls = 0;
  world.setsLogged = 0;
  world.failAfterSets = null;
});

describe("writeSessions", () => {
  it("should write and finish every planned session", async () => {
    await writeSessions(client, ANCHOR, exerciseIds);

    expect(world.sessions).toHaveLength(trainingSessions().length);
    expect(world.sessions.every(({ ended_at }) => ended_at !== null)).toBe(true);
  });

  it("should add nothing the second time", async () => {
    await writeSessions(client, ANCHOR, exerciseIds);
    const startsAfterFirst = world.startCalls;

    await writeSessions(client, ANCHOR, exerciseIds);

    expect(world.startCalls).toBe(startsAfterFirst);
    expect(world.deleted).toEqual([]);
  });

  describe("after a run that stopped part way through a session", () => {
    const [firstSession] = trainingSessions();
    const setsInFirstSession = firstSession === undefined ? 0 : setsOfSession(firstSession).length;

    beforeEach(async () => {
      world.failAfterSets = setsInFirstSession + 3;
      await expect(writeSessions(client, ANCHOR, exerciseIds)).rejects.toThrow(
        "the connection dropped",
      );
      world.failAfterSets = null;
    });

    it("should have left one finished session and one open", () => {
      expect(world.sessions.map(({ ended_at }) => ended_at !== null)).toEqual([true, false]);
    });

    it("should delete the open session and write it again, so a rerun finishes", async () => {
      const open = world.sessions.find(({ ended_at }) => ended_at === null);

      await writeSessions(client, ANCHOR, exerciseIds);

      expect(world.deleted).toEqual([open?.id]);
      expect(world.sessions).toHaveLength(trainingSessions().length);
      expect(world.sessions.every(({ ended_at }) => ended_at !== null)).toBe(true);
      expect(new Set(world.sessions.map(({ started_at }) => started_at)).size).toBe(
        trainingSessions().length,
      );
    });
  });
});
