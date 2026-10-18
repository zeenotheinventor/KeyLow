import { dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useActiveSession } from "../../src/hooks/useActiveSession";
import { useSession } from "../../src/hooks/useSession";
import { KeyLowProvider } from "../../src/KeyLowProvider";
import { keys } from "../../src/queryKeys";
import { createTestClient } from "../createTestClient";
import { createQueryClient } from "../support/queryClients";
import { installTrainingFake, openSessionRow, sessionSetRow } from "../support/training";
import { createWrapper } from "../support/wrapper";

import type { SessionWithSets } from "../../src";
import type { DehydratedState } from "@tanstack/react-query";
import type { ReactNode } from "react";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  onlineManager.setOnline(true);
});
afterAll(() => {
  server.close();
});

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

// What a persister does to a cache: it goes to storage as text and comes back as the same plain data.
const throughStorage = <Value,>(value: Value): Value =>
  // A cache holds plain JSON data only, which the text form keeps exactly.
  JSON.parse(JSON.stringify(value)) as Value;

/** Every property name anywhere in a stored value. */
const namesIn = (value: unknown): string[] =>
  typeof value !== "object" || value === null
    ? []
    : Object.entries(value).flatMap(([name, inner]) => [name, ...namesIn(inner)]);

// A session with three sets, one of them a warm-up and one with no load, so a count, a total or a
// clock stored in its place would show.
const seedSession = () =>
  openSessionRow({
    id: SESSION_ID,
    workout_sets: [
      sessionSetRow({ session_id: SESSION_ID, position: 0, set_type: "warmup", load_kg: 40 }),
      sessionSetRow({ session_id: SESSION_ID, position: 1, load_kg: 100, reps: 8 }),
      sessionSetRow({ session_id: SESSION_ID, position: 2, load_kg: null, reps: 12 }),
    ],
  });

const DERIVED_NAMES = [
  "setCount",
  "workingSets",
  "warmupSets",
  "elapsed",
  "elapsedMinutes",
  "duration",
  "durationMinutes",
  "progress",
  "plannedSets",
  "volume",
  "heat",
];

describe("the session reads in a persisted cache", () => {
  /** Opens the app online once, then returns what a persister would have stored. */
  const openOnline = async () => {
    const fake = installTrainingFake(server, { sessions: [seedSession()] });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ session: useSession(SESSION_ID), active: useActiveSession() }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.session.data).toBeDefined();
      expect(result.current.active.data).toBeDefined();
    });
    const rows = {
      session: queryClient.getQueryData<SessionWithSets | null>(keys.training.session(SESSION_ID)),
      active: queryClient.getQueryData<SessionWithSets | null>(keys.training.activeSession),
    };
    return { fake, rows, stored: throughStorage(dehydrate(queryClient)) };
  };

  /** A new session of the app: a new query client restored from storage, and no connection. */
  const restoreOffline = (stored: DehydratedState) => {
    const restored = createQueryClient({ defaultOptions: { queries: { retry: false } } });
    hydrate(restored, stored);
    onlineManager.setOnline(false);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <KeyLowProvider client={createTestClient()} queryClient={restored}>
        {children}
      </KeyLowProvider>
    );
    return { restored, wrapper };
  };

  it("should store both reads as rows, under keys of fixed words and the session's id", async () => {
    const { stored } = await openOnline();

    const training = stored.queries.filter(({ queryKey }) => queryKey[0] === "training");
    expect(training.map(({ queryKey }) => queryKey)).toEqual(
      expect.arrayContaining([keys.training.session(SESSION_ID), keys.training.activeSession]),
    );
  });

  it("should store no derived value: no count, clock, progress, volume or heat in any stored read", async () => {
    const { stored } = await openOnline();

    const training = stored.queries.filter(({ queryKey }) => queryKey[0] === "training");
    for (const { state } of training) {
      for (const derived of DERIVED_NAMES) {
        expect(namesIn(state)).not.toContain(derived);
      }
    }
  });

  it("should give back the stored session and the stored active session with the network down, asking for nothing", async () => {
    const { fake, rows, stored } = await openOnline();
    const requestsBefore = fake.requests.length;
    fake.goOffline();
    const { wrapper } = restoreOffline(stored);

    const { result } = renderHook(
      () => ({ session: useSession(SESSION_ID), active: useActiveSession() }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.session.data).toBeDefined();
      expect(result.current.active.data).toBeDefined();
    });
    expect(result.current.session.data).toEqual(throughStorage(rows.session));
    expect(result.current.active.data).toEqual(throughStorage(rows.active));
    expect(result.current.session.data?.sets.map(({ set_type }) => set_type)).toEqual([
      "warmup",
      "working",
      "working",
    ]);
    expect(fake.requests).toHaveLength(requestsBefore);
  });
});
