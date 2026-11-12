import { KeyLowProvider } from "@keylow/api-client";
import { createClient } from "@supabase/supabase-js";
import { onlineManager, QueryClient } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ErrorEvent } from "@sentry/nextjs";

import { CheckinRunner } from "@/app/(dashboard)/CheckinRunner";
import { announceNewTargets, hasNewTargets, takeNewTargets } from "@/lib/checkinToast";
import { scrubEvent } from "@/lib/sentry/scrub";

const { captureException } = vi.hoisted(() => ({
  captureException: vi.fn<(error: Error, hint?: { tags?: Record<string, string> }) => void>(),
}));

vi.mock("@sentry/nextjs", () => ({ captureException }));

const TODAY = "2026-11-06";
const RECOGNISABLE_SERVER_TEXT = "a target of 2412.34 was refused";

/** What the database and `run-checkin` hold, and how they answer, which a test changes between calls. */
const backend: {
  nextCheckinDate: string | null;
  kcal: number;
  kcalAfterRun: number;
  refusal: { status: number; code: string } | undefined;
  gate: Promise<void> | undefined;
  scheduleReads: number;
  runs: number;
} = {
  nextCheckinDate: TODAY,
  kcal: 2200,
  kcalAfterRun: 2140,
  refusal: undefined,
  gate: undefined,
  scheduleReads: 0,
  runs: 0,
};

function resetBackend() {
  backend.nextCheckinDate = TODAY;
  backend.kcal = 2200;
  backend.kcalAfterRun = 2140;
  backend.refusal = undefined;
  backend.gate = undefined;
  backend.scheduleReads = 0;
  backend.runs = 0;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });

/** A PostgREST answer for a single-row read, which asks for an object and gets a 406 for none. */
function rowOrNone(request: Request, rows: readonly unknown[]) {
  const [row] = rows;
  if (request.headers.get("accept")?.includes("vnd.pgrst.object+json") !== true) {
    return json(rows);
  }
  return row === undefined
    ? json({ code: "PGRST116", message: "no rows", details: "", hint: "" }, 406)
    : json(row);
}

async function respond(input: string | URL | Request, init?: RequestInit): Promise<Response> {
  const request = new Request(input, init);
  const { pathname, searchParams } = new URL(request.url);
  const table = pathname.split("/").pop() ?? "";

  if (table === "run-checkin") {
    backend.runs += 1;
    await backend.gate;
    if (backend.refusal !== undefined) {
      return json(
        { error: { code: backend.refusal.code, message: RECOGNISABLE_SERVER_TEXT } },
        backend.refusal.status,
      );
    }
    backend.kcal = backend.kcalAfterRun;
    return json({ ran: 1, nextCheckinDate: "2026-11-13" });
  }
  if (table === "programs") {
    if (searchParams.get("select") === "id") {
      return rowOrNone(request, []);
    }
    backend.scheduleReads += 1;
    return rowOrNone(request, [{ next_checkin_date: backend.nextCheckinDate }]);
  }
  if (table === "profiles") {
    return rowOrNone(request, [
      (searchParams.get("select") ?? "").includes("target_kcal")
        ? {
            target_kcal: backend.kcal,
            target_protein_g: null,
            target_carbs_g: null,
            target_fat_g: null,
          }
        : { timezone: "UTC" },
    ]);
  }
  return rowOrNone(request, []);
}

const client = createClient("http://localhost:54321", "anon-key", {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { fetch: (input, init) => respond(input, init) },
});

let visibility: DocumentVisibilityState;

function changeVisibility(next: DocumentVisibilityState) {
  visibility = next;
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

function renderRunner() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const tree = (
    <KeyLowProvider client={client} queryClient={queryClient}>
      <CheckinRunner />
    </KeyLowProvider>
  );
  const view = render(tree);
  return {
    ...view,
    redraw: () => {
      view.rerender(tree);
    },
  };
}

async function settle() {
  // Lets a run that is out finish: the schedule read, the run and the read of the target after it.
  await act(async () => {
    for (let turn = 0; turn < 40; turn += 1) {
      await Promise.resolve();
    }
  });
}

beforeEach(() => {
  resetBackend();
  captureException.mockReset();
  visibility = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  vi.useFakeTimers({ now: new Date(`${TODAY}T12:00:00Z`), toFake: ["Date"] });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
  onlineManager.setOnline(true);
  takeNewTargets();
});

describe("the check-in runner", () => {
  it("should draw nothing", async () => {
    backend.nextCheckinDate = "2026-11-07";
    const { container } = renderRunner();
    await settle();

    expect(container.innerHTML).toBe("");
  });

  describe("when it runs", () => {
    it("should run a due check-in when the page opens", async () => {
      renderRunner();

      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });
    });

    it("should run nothing when the next check-in is a later day", async () => {
      backend.nextCheckinDate = "2026-11-07";
      renderRunner();

      await waitFor(() => {
        expect(backend.scheduleReads).toBe(1);
      });
      await settle();

      expect(backend.runs).toBe(0);
    });

    it("should wait for the tab to be in view when it opens in the background", async () => {
      visibility = "hidden";
      renderRunner();
      await settle();

      expect(backend.scheduleReads).toBe(0);

      changeVisibility("visible");

      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });
    });

    it("should run nothing when the tab goes out of view", async () => {
      backend.nextCheckinDate = "2026-11-07";
      renderRunner();
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(1);
      });

      changeVisibility("hidden");
      await settle();

      expect(backend.scheduleReads).toBe(1);
    });

    it("should read the schedule again each time the tab returns to view", async () => {
      backend.nextCheckinDate = "2026-11-07";
      renderRunner();
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(1);
      });
      await settle();

      changeVisibility("hidden");
      changeVisibility("visible");

      await waitFor(() => {
        expect(backend.scheduleReads).toBe(2);
      });
    });

    it("should stop listening when it unmounts", async () => {
      backend.nextCheckinDate = "2026-11-07";
      const { unmount } = renderRunner();
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(1);
      });
      await settle();

      unmount();
      changeVisibility("hidden");
      changeVisibility("visible");
      await settle();

      expect(backend.scheduleReads).toBe(1);
    });

    it("should run once for a due schedule when the tab is focused twice while the run is out", async () => {
      let release: () => void = () => undefined;
      backend.gate = new Promise((resolve) => {
        release = resolve;
      });
      renderRunner();
      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });

      changeVisibility("hidden");
      changeVisibility("visible");
      changeVisibility("hidden");
      changeVisibility("visible");
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(3);
      });
      release();
      await settle();

      expect(backend.runs).toBe(1);
    });

    it("should not run again when the page is drawn again with callbacks of its own", async () => {
      backend.nextCheckinDate = "2026-11-07";
      const { redraw } = renderRunner();
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(1);
      });

      redraw();
      redraw();
      redraw();
      await settle();

      expect(backend.scheduleReads).toBe(1);
    });
  });

  describe("offline", () => {
    beforeEach(() => {
      onlineManager.setOnline(false);
    });

    it("should read nothing, run nothing and say nothing when the page opens", async () => {
      renderRunner();
      await settle();

      expect(backend.scheduleReads).toBe(0);
      expect(backend.runs).toBe(0);
      expect(hasNewTargets()).toBe(false);
      expect(captureException).not.toHaveBeenCalled();
    });

    it("should read nothing and run nothing when the tab returns to view", async () => {
      renderRunner();
      changeVisibility("hidden");
      changeVisibility("visible");
      await settle();

      expect(backend.scheduleReads).toBe(0);
      expect(backend.runs).toBe(0);
      expect(captureException).not.toHaveBeenCalled();
    });

    it("should not run when the connection returns with the tab already in view, as the phone does not", async () => {
      renderRunner();
      await settle();

      act(() => {
        onlineManager.setOnline(true);
      });
      await settle();

      expect(backend.scheduleReads).toBe(0);
      expect(backend.runs).toBe(0);
    });

    it("should run the next time the tab returns to view once the connection is back", async () => {
      renderRunner();
      await settle();
      act(() => {
        onlineManager.setOnline(true);
      });

      changeVisibility("hidden");
      changeVisibility("visible");

      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });
    });
  });

  describe("the new targets signal", () => {
    it("should tell the Diary a new target exists when the calorie target changed", async () => {
      renderRunner();

      await waitFor(() => {
        expect(hasNewTargets()).toBe(true);
      });
    });

    it("should say nothing when the check-in left the calorie target as it was", async () => {
      backend.kcalAfterRun = 2200;
      renderRunner();
      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });
      await settle();

      expect(hasNewTargets()).toBe(false);
    });
  });

  describe("when the person signs out", () => {
    it("should forget a new target that was still waiting, so the next account is not told of it", () => {
      backend.nextCheckinDate = "2026-11-07";
      const { unmount } = renderRunner();
      act(() => {
        announceNewTargets();
      });

      unmount();

      expect(hasNewTargets()).toBe(false);
    });

    it("should still forget it when the shell is mounted again for the next account", async () => {
      backend.nextCheckinDate = "2026-11-07";
      const first = renderRunner();
      act(() => {
        announceNewTargets();
      });
      first.unmount();

      renderRunner();
      await settle();

      expect(hasNewTargets()).toBe(false);
    });

    it("should keep it while the runner stays mounted, as it does between dashboard pages", async () => {
      backend.nextCheckinDate = "2026-11-07";
      const { redraw } = renderRunner();
      act(() => {
        announceNewTargets();
      });

      redraw();
      changeVisibility("hidden");
      changeVisibility("visible");
      await settle();

      expect(hasNewTargets()).toBe(true);
    });
  });

  describe("when a run fails", () => {
    beforeEach(() => {
      backend.refusal = { status: 500, code: "internal_error" };
    });

    it("should report the code alone to Sentry, as a tag the report scrubbing keeps", async () => {
      renderRunner();

      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });
      const call = captureException.mock.calls[0];
      if (call === undefined) {
        throw new Error("The failure should have been reported");
      }
      const [error, hint] = call;
      expect(hint).toEqual({ tags: { checkinFailureCode: "internal_error" } });
      const event = scrubEvent({
        type: undefined,
        exception: { values: [{ type: error.name, value: error.message }] },
        tags: hint?.tags ?? {},
      } satisfies ErrorEvent);
      expect(event.tags).toEqual({ checkinFailureCode: "internal_error" });
      expect(event.exception?.values?.[0]).not.toHaveProperty("value");
    });

    it("should quote nothing the server said, and no figure, in anything it reports", async () => {
      renderRunner();

      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });

      const reported = JSON.stringify(
        captureException.mock.calls.map(([error, hint]) => [error.message, hint]),
      );
      expect(reported).not.toContain("2412.34");
      expect(reported).not.toContain("2200");
      expect(reported).not.toContain("2140");
    });

    it("should show nothing and tell the Diary nothing", async () => {
      const { container } = renderRunner();
      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });

      expect(container.innerHTML).toBe("");
      expect(hasNewTargets()).toBe(false);
    });

    it("should report a failure once when the tab is focused again while the run is out", async () => {
      let release: () => void = () => undefined;
      backend.gate = new Promise((resolve) => {
        release = resolve;
      });
      renderRunner();
      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });

      changeVisibility("hidden");
      changeVisibility("visible");
      await waitFor(() => {
        expect(backend.scheduleReads).toBe(2);
      });
      release();
      await settle();

      expect(captureException).toHaveBeenCalledTimes(1);
    });

    it("should treat a 409 as nothing to run and report nothing", async () => {
      backend.refusal = { status: 409, code: "no_program" };
      renderRunner();
      await waitFor(() => {
        expect(backend.runs).toBe(1);
      });
      await settle();

      expect(captureException).not.toHaveBeenCalled();
    });
  });
});
