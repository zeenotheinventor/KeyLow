import { renderHook, waitFor } from "@testing-library/react";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useAcceptedSuggestions } from "../../src/hooks/useAcceptedSuggestions";
import { keys } from "../../src/queryKeys";
import {
  LEGS_DAY_ID,
  RECOGNISABLE_SUGGESTION_TEXT,
  THURSDAY,
  acceptedRow,
  installAcceptedSuggestionsFake,
} from "../support/acceptedSuggestions";
import { createWrapper } from "../support/wrapper";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const WEEK_START = "2026-10-12";

describe("useAcceptedSuggestions", () => {
  it("should load the week's accepted suggestions under their key, as rows", async () => {
    const thursday = acceptedRow();
    installAcceptedSuggestionsFake(server, { rows: [thursday] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useAcceptedSuggestions(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data?.suggestions).toMatchObject([
      { id: thursday["id"], local_date: THURSDAY, routine_day_id: LEGS_DAY_ID },
    ]);
    expect(queryClient.getQueryData(keys.training.acceptedSuggestions(WEEK_START))).toBe(
      result.current.data,
    );
  });

  it("should hold what was skipped as ids and field paths, with no exercise or figure", async () => {
    const broken = acceptedRow({ params_version: "" });
    installAcceptedSuggestionsFake(server, { rows: [broken] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAcceptedSuggestions(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(result.current.data).toEqual({
      suggestions: [],
      skipped: [{ id: broken["id"], fieldPaths: ["params_version"] }],
    });
  });

  it("should make no request when it is not enabled", async () => {
    const fake = installAcceptedSuggestionsFake(server, { rows: [acceptedRow()] });
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAcceptedSuggestions(WEEK_START, { enabled: false }), {
      wrapper,
    });

    await Promise.resolve();
    expect(result.current.data).toBeUndefined();
    expect(fake.reads).toEqual([]);
  });

  it("should fail at once, without a request, for a week that is not a Monday", async () => {
    const fake = installAcceptedSuggestionsFake(server);
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAcceptedSuggestions("2026-10-13"), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error).toBeInstanceOf(RangeError);
    expect(fake.reads).toEqual([]);
  });

  it("should report an error that names the action and the code only", async () => {
    const fake = installAcceptedSuggestionsFake(server);
    fake.failReadsWith("42501");
    const { wrapper } = createWrapper();

    const { result } = renderHook(() => useAcceptedSuggestions(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
    expect(result.current.error?.message).toBe("Could not load your accepted suggestions (42501)");
    expect(JSON.stringify(result.current.error?.cause)).not.toContain(RECOGNISABLE_SUGGESTION_TEXT);
  });

  it("should keep a key with a date and fixed words only", async () => {
    installAcceptedSuggestionsFake(server, { rows: [acceptedRow()] });
    const { queryClient, wrapper } = createWrapper();

    const { result } = renderHook(() => useAcceptedSuggestions(WEEK_START), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const [query] = queryClient.getQueryCache().findAll({ queryKey: keys.training.all });
    expect(query?.queryKey).toEqual(["training", "accepted-suggestions", WEEK_START]);
  });
});
