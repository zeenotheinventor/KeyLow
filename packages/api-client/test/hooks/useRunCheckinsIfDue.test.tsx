import { onlineManager } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { useRunCheckinsIfDue } from "../../src/hooks/useRunCheckinsIfDue";
import { keys } from "../../src/queryKeys";
import { REST_URL, postgrestRows } from "../support/postgrest";
import { createWrapper } from "../support/wrapper";

const RUN_CHECKIN_URL = "http://127.0.0.1:54321/functions/v1/run-checkin";
const TODAY = "2026-10-24";
const TOMORROW = "2026-10-25";
const RECOGNISABLE_SERVER_TEXT = "a target of 2412.34 was refused";

/** What the database and `run-checkin` hold, and how they answer, which a test changes between calls. */
const backend: {
  nextCheckinDate: string | null;
  hasProgram: boolean;
  kcal: number;
  kcalAfterRun: number;
  ran: number;
  refusal: { status: number; code: string } | undefined;
  gate: Promise<void> | undefined;
  scheduleReads: number;
  runs: number;
} = {
  nextCheckinDate: TODAY,
  hasProgram: true,
  kcal: 2200,
  kcalAfterRun: 2140,
  ran: 1,
  refusal: undefined,
  gate: undefined,
  scheduleReads: 0,
  runs: 0,
};

function resetBackend() {
  backend.nextCheckinDate = TODAY;
  backend.hasProgram = true;
  backend.kcal = 2200;
  backend.kcalAfterRun = 2140;
  backend.ran = 1;
  backend.refusal = undefined;
  backend.gate = undefined;
  backend.scheduleReads = 0;
  backend.runs = 0;
}

const server = setupServer(
  http.get(`${REST_URL}/profiles`, ({ request }) => {
    const selected = new URL(request.url).searchParams.get("select") ?? "";
    return postgrestRows(
      request,
      selected.includes("target_kcal")
        ? [
            {
              target_kcal: backend.kcal,
              target_protein_g: null,
              target_carbs_g: null,
              target_fat_g: null,
            },
          ]
        : [{ timezone: "UTC" }],
    );
  }),
  http.get(`${REST_URL}/programs`, ({ request }) => {
    if (new URL(request.url).searchParams.get("select") === "id") {
      return postgrestRows(request, []);
    }
    backend.scheduleReads += 1;
    return postgrestRows(
      request,
      backend.hasProgram ? [{ next_checkin_date: backend.nextCheckinDate }] : [],
    );
  }),
  http.get(`${REST_URL}/targets`, ({ request }) => postgrestRows(request, [])),
  http.post(RUN_CHECKIN_URL, async () => {
    backend.runs += 1;
    await backend.gate;
    if (backend.refusal !== undefined) {
      return HttpResponse.json(
        { error: { code: backend.refusal.code, message: RECOGNISABLE_SERVER_TEXT } },
        { status: backend.refusal.status },
      );
    }
    backend.kcal = backend.kcalAfterRun;
    return HttpResponse.json({ ran: backend.ran, nextCheckinDate: "2026-10-31" });
  }),
);

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  resetBackend();
  vi.useFakeTimers({ now: new Date(`${TODAY}T12:00:00Z`), toFake: ["Date"] });
});
afterEach(() => {
  vi.useRealTimers();
  onlineManager.setOnline(true);
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

function renderRunner() {
  const onNewTargets = vi.fn();
  const onFailureCode = vi.fn();
  const { wrapper, queryClient } = createWrapper();
  const hook = renderHook(
    (callbacks: { onNewTargets: () => void; onFailureCode: (code: string) => void }) =>
      useRunCheckinsIfDue(callbacks),
    { wrapper, initialProps: { onNewTargets, onFailureCode } },
  );
  return { ...hook, queryClient, onNewTargets, onFailureCode };
}

describe("useRunCheckinsIfDue", () => {
  it("should read nothing and run nothing while offline", async () => {
    onlineManager.setOnline(false);
    const { result, onNewTargets, onFailureCode } = renderRunner();

    await act(() => result.current());

    expect(backend.scheduleReads).toBe(0);
    expect(backend.runs).toBe(0);
    expect(onNewTargets).not.toHaveBeenCalled();
    expect(onFailureCode).not.toHaveBeenCalled();
  });

  it("should run nothing when the next check-in is a later day", async () => {
    backend.nextCheckinDate = TOMORROW;
    const { result } = renderRunner();

    await act(() => result.current());

    expect(backend.scheduleReads).toBe(1);
    expect(backend.runs).toBe(0);
  });

  it("should run nothing for a user with no active program", async () => {
    backend.hasProgram = false;
    const { result, onFailureCode } = renderRunner();

    await act(() => result.current());

    expect(backend.runs).toBe(0);
    expect(onFailureCode).not.toHaveBeenCalled();
  });

  it("should run the check-ins once when one is due", async () => {
    const { result } = renderRunner();

    await act(() => result.current());

    expect(backend.runs).toBe(1);
  });

  describe("the new targets signal", () => {
    it("should announce once when a run recorded check-ins and the calorie target changed", async () => {
      const { result, onNewTargets } = renderRunner();

      await act(() => result.current());

      expect(onNewTargets).toHaveBeenCalledTimes(1);
    });

    it("should not announce when the calorie target is as it was", async () => {
      backend.kcalAfterRun = 2200;
      const { result, onNewTargets } = renderRunner();

      await act(() => result.current());

      expect(backend.runs).toBe(1);
      expect(onNewTargets).not.toHaveBeenCalled();
    });

    it("should not announce when the run recorded none, even if the target now reads differently", async () => {
      let release: () => void = () => undefined;
      backend.gate = new Promise((resolve) => {
        release = resolve;
      });
      backend.ran = 0;
      const { result, queryClient, onNewTargets } = renderRunner();

      let run: Promise<unknown> = Promise.resolve();
      act(() => {
        run = result.current();
      });
      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });
      // Something else (the diary's own refetch) has marked the target stale while the run was out.
      await queryClient.invalidateQueries({ queryKey: keys.profiles.targets, refetchType: "none" });
      release();
      await act(() => run);

      expect(backend.kcal).toBe(backend.kcalAfterRun);
      expect(onNewTargets).not.toHaveBeenCalled();
    });

    it("should announce once, and run once, when calls overlap", async () => {
      let release: () => void = () => undefined;
      backend.gate = new Promise((resolve) => {
        release = resolve;
      });
      const { result, onNewTargets } = renderRunner();

      let both: Promise<unknown> = Promise.resolve();
      act(() => {
        both = Promise.all([result.current(), result.current()]);
      });
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(2);
      });
      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });
      release();
      await act(() => both);

      expect(backend.runs).toBe(1);
      expect(onNewTargets).toHaveBeenCalledTimes(1);
    });

    it("should announce again for a later run once the first has finished", async () => {
      const { result, onNewTargets } = renderRunner();
      await act(() => result.current());
      backend.kcalAfterRun = 2090;

      await act(() => result.current());

      expect(backend.runs).toBe(2);
      expect(onNewTargets).toHaveBeenCalledTimes(2);
    });
  });

  describe("when something fails", () => {
    it("should pass only the code of a refused run to the callback", async () => {
      backend.refusal = { status: 500, code: "internal_error" };
      const { result, onNewTargets, onFailureCode } = renderRunner();

      await act(() => result.current());

      expect(onFailureCode).toHaveBeenCalledExactlyOnceWith("internal_error");
      expect(JSON.stringify(onFailureCode.mock.calls)).not.toContain("2412.34");
      expect(onNewTargets).not.toHaveBeenCalled();
    });

    it("should report a refused run once when calls overlap", async () => {
      let release: () => void = () => undefined;
      backend.gate = new Promise((resolve) => {
        release = resolve;
      });
      backend.refusal = { status: 500, code: "internal_error" };
      const { result, onFailureCode } = renderRunner();

      let both: Promise<unknown> = Promise.resolve();
      act(() => {
        both = Promise.all([result.current(), result.current()]);
      });
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(2);
      });
      release();
      await act(() => both);

      expect(onFailureCode).toHaveBeenCalledTimes(1);
    });

    it("should treat a 409 as nothing to do and report nothing", async () => {
      backend.refusal = { status: 409, code: "no_program" };
      const { result, onFailureCode } = renderRunner();

      await act(() => result.current());

      expect(backend.runs).toBe(1);
      expect(onFailureCode).not.toHaveBeenCalled();
    });

    it("should run again on the next call after a failure", async () => {
      backend.refusal = { status: 500, code: "internal_error" };
      const { result } = renderRunner();
      await act(() => result.current());
      backend.refusal = undefined;

      await act(() => result.current());

      expect(backend.runs).toBe(2);
    });
  });

  describe("the returned function", () => {
    it("should keep its identity when the callbacks are new on every render", () => {
      const { result, rerender } = renderRunner();
      const first = result.current;

      rerender({ onNewTargets: vi.fn(), onFailureCode: vi.fn() });

      expect(result.current).toBe(first);
    });

    it("should call the latest callbacks, not the ones from the first render", async () => {
      const { result, rerender, onNewTargets } = renderRunner();
      const latestOnNewTargets = vi.fn();
      rerender({ onNewTargets: latestOnNewTargets, onFailureCode: vi.fn() });

      await act(() => result.current());

      expect(latestOnNewTargets).toHaveBeenCalledTimes(1);
      expect(onNewTargets).not.toHaveBeenCalled();
    });
  });
});
