import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useExerciseSearch } from "../../src/hooks/useExerciseSearch";
import { keys } from "../../src/queryKeys";
import {
  OWN_EXERCISE_ID,
  RECOGNISABLE_EXERCISE_NAME,
  exerciseRow,
  globalExerciseRow,
} from "../support/exercises";
import { REST_URL, postgrestError } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

import type { UseExerciseSearchOptions } from "../../src/hooks/useExerciseSearch";

const server = setupServer();

type SearchRequest = { name: string | null; limit: string | null };

let requests: SearchRequest[] = [];

/** Answers every exercises read with `rows(name)`, where `name` is the `ilike` filter, and records the request. */
const answerSearch = (rows: (name: string | null) => unknown[]) => {
  server.use(
    http.get(`${REST_URL}/exercises`, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const seen = { name: searchParams.get("name"), limit: searchParams.get("limit") };
      requests.push(seen);
      return HttpResponse.json(rows(seen.name));
    }),
  );
};

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  // Real time still passes, so waitFor and the network keep working. The debounce is advanced explicitly.
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  vi.useRealTimers();
  server.resetHandlers();
  requests = [];
});
afterAll(() => {
  server.close();
});

const DEBOUNCE_MS = 250;

const settleDebounce = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(DEBOUNCE_MS);
  });

function renderSearch(initialQuery: string, options?: UseExerciseSearchOptions) {
  const { queryClient, wrapper } = createWrapper();
  const rendered = renderHook(({ query }) => useExerciseSearch(query, options), {
    wrapper,
    initialProps: { query: initialQuery },
  });

  const search = async (query: string) => {
    rendered.rerender({ query });
    await settleDebounce();
  };

  return { ...rendered, queryClient, search };
}

const raises = [exerciseRow({ name: "Lean-away cable raise" }), globalExerciseRow()];

describe("useExerciseSearch", () => {
  it("should be loading, then give the matching exercises, the user's own first as the database orders them", async () => {
    answerSearch(() => raises);

    const { result } = renderSearch("raise");

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => {
      expect(result.current.exercises.map((exercise) => exercise.name)).toEqual([
        "Lean-away cable raise",
        "Cable lateral raise",
      ]);
    });
    expect(result.current.exercises[0]).toMatchObject({
      id: OWN_EXERCISE_ID,
      source: "user",
      primary_muscles: ["delt_side"],
      secondary_muscles: ["traps_upper"],
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("should cache the result under the exercise search key", async () => {
    answerSearch(() => raises);

    const { result, queryClient } = renderSearch("raise");

    await waitFor(() => {
      expect(result.current.exercises).toHaveLength(2);
    });
    expect(queryClient.getQueryData(keys.training.exerciseSearch("raise"))).toEqual(
      result.current.exercises,
    );
  });

  it("should make exactly one request for five keystrokes within the debounce window", async () => {
    answerSearch(() => raises);
    const { result, rerender } = renderSearch("r");

    for (const query of ["ra", "rai", "rais", "raise"]) {
      rerender({ query });
    }
    expect(requests).toEqual([]);

    await settleDebounce();
    await waitFor(() => {
      expect(result.current.exercises).toHaveLength(2);
    });

    expect(requests).toEqual([{ name: "ilike.%raise%", limit: "25" }]);
  });

  it("should not search for fewer than 2 characters, and give nothing in progress", async () => {
    answerSearch(() => raises);
    const { result, search } = renderSearch("r");

    expect(result.current.isLoading).toBe(false);
    await search("  r ");
    await vi.advanceTimersByTimeAsync(500);

    expect(requests).toEqual([]);
    expect(result.current).toEqual({
      exercises: [],
      isLoading: false,
      isDebouncing: false,
      error: null,
    });
  });

  it("should search the trimmed query and pass the limit", async () => {
    answerSearch(() => raises);
    const { result } = renderSearch("  raise  ", { limit: 10 });

    await waitFor(() => {
      expect(result.current.exercises).toHaveLength(2);
    });

    expect(requests).toEqual([{ name: "ilike.%raise%", limit: "10" }]);
  });

  it("should make no request while enabled is false", async () => {
    answerSearch(() => raises);
    const { result } = renderSearch("raise", { enabled: false });

    await settleDebounce();
    await vi.advanceTimersByTimeAsync(500);

    expect(requests).toEqual([]);
    expect(result.current.exercises).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it("should give no exercises, and not an error, for a word that matches nothing", async () => {
    answerSearch(() => []);
    const { result } = renderSearch("raise");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.exercises).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("should keep the previous results in view while the next query loads", async () => {
    let releaseNext: () => void = () => undefined;
    const nextMayAnswer = new Promise<void>((resolve) => {
      releaseNext = resolve;
    });
    server.use(
      http.get(`${REST_URL}/exercises`, async ({ request }) => {
        if (new URL(request.url).searchParams.get("name") === "ilike.%raises%") {
          await nextMayAnswer;
          return HttpResponse.json([globalExerciseRow({ name: "Raises" })]);
        }
        return HttpResponse.json(raises);
      }),
    );
    const { result, search } = renderSearch("raise");
    await waitFor(() => {
      expect(result.current.exercises).toHaveLength(2);
    });

    await search("raises");

    await waitFor(() => {
      expect(result.current.isLoading).toBe(true);
    });
    expect(result.current.exercises).toHaveLength(2);

    releaseNext();
    await waitFor(() => {
      expect(result.current.exercises.map((exercise) => exercise.name)).toEqual(["Raises"]);
    });
  });

  it("should be debouncing for the whole gap after a keystroke, and not on the first render", async () => {
    answerSearch(() => raises);
    const { result, rerender } = renderSearch("raise");
    expect(result.current.isDebouncing).toBe(false);
    await waitFor(() => {
      expect(result.current.exercises).toHaveLength(2);
    });

    rerender({ query: "raises" });
    expect(result.current.isDebouncing).toBe(true);
    expect(result.current.exercises).toHaveLength(2);

    await settleDebounce();
    expect(result.current.isDebouncing).toBe(false);
  });

  describe("when the search fails", () => {
    it("should give an error that names the action and the code only, and no exercises", async () => {
      server.use(
        http.get(`${REST_URL}/exercises`, () =>
          postgrestError(500, "XX000", `unavailable ${RECOGNISABLE_EXERCISE_NAME}`),
        ),
      );
      const { result } = renderSearch("raise");

      await waitFor(() => {
        expect(result.current.error).not.toBeNull();
      });

      expect(result.current.error).toEqual({
        kind: "failed",
        debugMessage: "Could not search the exercises (XX000)",
      });
      expect(result.current.exercises).toEqual([]);
      expect(result.current.isLoading).toBe(false);
    });
  });
});
