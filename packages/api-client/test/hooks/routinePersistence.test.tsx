import { dehydrate, hydrate, onlineManager } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useRoutine } from "../../src/hooks/useRoutine";
import { useRoutines } from "../../src/hooks/useRoutines";
import { KeyLowProvider } from "../../src/KeyLowProvider";
import { createTestClient } from "../createTestClient";
import { createQueryClient } from "../support/queryClients";
import {
  RECOGNISABLE_ROUTINE_DAY_NAME,
  RECOGNISABLE_ROUTINE_EXERCISE_NAME,
  RECOGNISABLE_ROUTINE_NAME,
  ROUTINE_ID,
  installRoutinesFake,
  routineDetailRow,
  routineListRow,
} from "../support/routines";
import { createWrapper } from "../support/wrapper";

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

// What a persister does to a cache: it goes to storage as text and comes back as the same plain data.
const throughStorage = <Value,>(value: Value): Value =>
  // A cache holds plain JSON data only, which the text form keeps exactly.
  JSON.parse(JSON.stringify(value)) as Value;

/** Every property name anywhere in a stored value. */
const namesIn = (value: unknown): string[] =>
  typeof value !== "object" || value === null
    ? []
    : Object.entries(value).flatMap(([name, inner]) => [name, ...namesIn(inner)]);

const DERIVED_NAMES = ["summary", "dayCount", "setsPerWeek", "setCount", "exerciseCount"];

describe("the routine reads in a persisted cache", () => {
  /** Opens the app online once, then returns what a persister would have stored. */
  const openOnline = async () => {
    const fake = installRoutinesFake(server, {
      routines: [routineListRow({ is_active: true, activated_at: "2026-10-12T08:30:00+00:00" })],
      details: [routineDetailRow({ is_active: true })],
    });
    const { queryClient, wrapper } = createWrapper();
    const { result } = renderHook(
      () => ({ library: useRoutines({ archived: false }), one: useRoutine(ROUTINE_ID) }),
      { wrapper },
    );
    await waitFor(() => {
      expect(result.current.library.data).toBeDefined();
      expect(result.current.one.data).not.toBeUndefined();
    });
    return {
      fake,
      library: result.current.library.data,
      stored: throughStorage(dehydrate(queryClient)),
    };
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

  it("should store both reads as rows, under keys of fixed words, a flag and the routine's id", async () => {
    const { stored } = await openOnline();

    const keysStored = stored.queries
      .filter(({ queryKey }) => queryKey[0] === "training")
      .map(({ queryKey }) => queryKey);
    expect(keysStored).toEqual(
      expect.arrayContaining([
        ["training", "routines", false],
        ["training", "routine", ROUTINE_ID],
      ]),
    );
    expect(JSON.stringify(keysStored)).not.toContain(RECOGNISABLE_ROUTINE_NAME);
    expect(JSON.stringify(keysStored)).not.toContain(RECOGNISABLE_ROUTINE_EXERCISE_NAME);
  });

  it("should store no derived value: no summary, count or total in any stored read", async () => {
    const { stored } = await openOnline();

    const training = stored.queries.filter(({ queryKey }) => queryKey[0] === "training");
    for (const { state } of training) {
      for (const derived of DERIVED_NAMES) {
        expect(namesIn(state)).not.toContain(derived);
      }
    }
  });

  it("should give back the stored routines, summarised again, with the network down and asking for nothing", async () => {
    const { fake, library, stored } = await openOnline();
    const requestsBefore = fake.requestCount;
    fake.goOffline();
    const { wrapper } = restoreOffline(stored);

    const { result } = renderHook(
      () => ({ library: useRoutines({ archived: false }), one: useRoutine(ROUTINE_ID) }),
      { wrapper },
    );

    await waitFor(() => {
      expect(result.current.library.data).toBeDefined();
      expect(result.current.one.data).toBeDefined();
    });
    expect(result.current.library.data).toEqual(throughStorage(library));
    expect(result.current.library.data?.[0]).toMatchObject({
      name: RECOGNISABLE_ROUTINE_NAME,
      is_active: true,
      activated_at: "2026-10-12T08:30:00+00:00",
      summary: { dayCount: 2, setsPerWeek: 12 },
    });
    expect(result.current.one.data?.days[0]?.name).toBe(RECOGNISABLE_ROUTINE_DAY_NAME);
    expect(fake.requestCount).toBe(requestsBefore);
  });
});
