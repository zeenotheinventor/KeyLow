import { KeyLowProvider, keys } from "@keylow/api-client";
import { captureException } from "@sentry/react-native";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, render, waitFor } from "@testing-library/react-native";
import { AppState } from "react-native";

import { CheckinRunner } from "../components/CheckinRunner";
import { hasNewTargets, takeNewTargets } from "../lib/checkinToast";
import { checkinBackend, checkinClient, resetCheckinBackend } from "./support/checkinBackend";
import { createTestQueryClient } from "./support/termsBackend";

import type { Targets } from "@keylow/api-client";
import type { QueryClient } from "@tanstack/react-query";
import type { AppStateStatus, NativeEventSubscription } from "react-native";

// Only the clock is faked, so the day a check-in is due on can be fixed and nothing else waits on a timer.
const fakeOnlyTheClock = (now: string) => {
  jest.useFakeTimers({
    now: new Date(now),
    doNotFake: [
      "hrtime",
      "nextTick",
      "performance",
      "queueMicrotask",
      "requestAnimationFrame",
      "cancelAnimationFrame",
      "requestIdleCallback",
      "cancelIdleCallback",
      "setImmediate",
      "clearImmediate",
      "setInterval",
      "clearInterval",
      "setTimeout",
      "clearTimeout",
    ],
  });
};

const TODAY = "2026-10-24";
const TOMORROW = "2026-10-25";
const RECOGNISABLE_SERVER_TEXT = "a target of 2412.34 was refused";

let queryClient: QueryClient;
const removeForegroundListener = jest.fn();
let foregroundListeners: ((state: AppStateStatus) => void)[];

function renderRunner(seedCache: (client: QueryClient) => void = () => undefined) {
  queryClient = createTestQueryClient();
  seedCache(queryClient);
  return render(
    <KeyLowProvider client={checkinClient} queryClient={queryClient}>
      <CheckinRunner />
    </KeyLowProvider>,
  );
}

const returnToForeground = () =>
  act(() => {
    foregroundListeners.forEach((listener) => {
      listener("active");
    });
  });

const programReadCount = () => checkinBackend.programReads;
const runCount = () => checkinBackend.runBodies.length;

const cachedTargets = (kcal: number | null): Targets => ({
  kcal,
  protein_g: null,
  carbs_g: null,
  fat_g: null,
  source: "manual",
});

const isInvalidated = (key: readonly unknown[]) => queryClient.getQueryState(key)?.isInvalidated;

describe("CheckinRunner", () => {
  beforeEach(() => {
    resetCheckinBackend();
    fakeOnlyTheClock(`${TODAY}T12:00:00Z`);
    foregroundListeners = [];
    removeForegroundListener.mockClear();
    jest.mocked(captureException).mockClear();
    jest
      .spyOn(AppState, "addEventListener")
      .mockImplementation((_type, listener): NativeEventSubscription => {
        foregroundListeners.push(listener);
        return { remove: removeForegroundListener };
      });
  });

  afterEach(async () => {
    takeNewTargets();
    await cleanup();
    queryClient.clear();
    onlineManager.setOnline(true);
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("should run the due check-ins once when it mounts on a due day", async () => {
    checkinBackend.program = { next_checkin_date: TODAY };

    await renderRunner();

    await waitFor(() => {
      expect(runCount()).toBe(1);
    });
  });

  it("should ask for the due mode", async () => {
    checkinBackend.program = { next_checkin_date: TODAY };

    await renderRunner();

    await waitFor(() => {
      expect(checkinBackend.runBodies).toEqual([{ mode: "due" }]);
    });
  });

  it("should run nothing when the next check-in is a later day", async () => {
    checkinBackend.program = { next_checkin_date: TOMORROW };

    await renderRunner();

    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });
    expect(runCount()).toBe(0);
  });

  it("should run when the next check-in was a day ago", async () => {
    checkinBackend.program = { next_checkin_date: "2026-10-23" };

    await renderRunner();

    await waitFor(() => {
      expect(runCount()).toBe(1);
    });
  });

  it("should run nothing for a program with no schedule yet", async () => {
    checkinBackend.program = { next_checkin_date: null };

    await renderRunner();

    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });
    expect(runCount()).toBe(0);
  });

  it("should run nothing, and report nothing, when there is no active program", async () => {
    checkinBackend.program = null;

    await renderRunner();

    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });
    expect(runCount()).toBe(0);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("should read the day in the profile's time zone, which is a day ahead in Auckland", async () => {
    fakeOnlyTheClock(`${TODAY}T20:00:00Z`);
    checkinBackend.timeZone = "Pacific/Auckland";
    checkinBackend.program = { next_checkin_date: TOMORROW };

    await renderRunner();

    await waitFor(() => {
      expect(runCount()).toBe(1);
    });
  });

  it("should read the same instant as the earlier day in UTC", async () => {
    fakeOnlyTheClock(`${TODAY}T20:00:00Z`);
    checkinBackend.timeZone = "UTC";
    checkinBackend.program = { next_checkin_date: TOMORROW };

    await renderRunner();

    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });
    expect(runCount()).toBe(0);
  });

  it("should read a profile with no time zone as UTC", async () => {
    fakeOnlyTheClock(`${TODAY}T20:00:00Z`);
    checkinBackend.timeZone = null;
    checkinBackend.program = { next_checkin_date: TOMORROW };

    await renderRunner();

    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });
    expect(runCount()).toBe(0);
  });

  it("should read a profile time zone that is not a zone as UTC", async () => {
    fakeOnlyTheClock(`${TODAY}T23:30:00Z`);
    checkinBackend.timeZone = "Not/AZone";
    checkinBackend.program = { next_checkin_date: TOMORROW };

    await renderRunner();

    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });
    expect(runCount()).toBe(0);
  });

  it("should read nothing, run nothing and report nothing on a return to the foreground while offline", async () => {
    checkinBackend.program = { next_checkin_date: TOMORROW };
    await renderRunner();
    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });

    onlineManager.setOnline(false);
    checkinBackend.program = { next_checkin_date: TODAY };
    await returnToForeground();
    await act(async () => {
      await Promise.resolve();
    });

    expect(programReadCount()).toBe(1);
    expect(runCount()).toBe(0);
    expect(captureException).not.toHaveBeenCalled();
  });

  it("should read nothing and run nothing until the terms are accepted", async () => {
    checkinBackend.termsAccepted = false;
    checkinBackend.program = { next_checkin_date: TODAY };

    await renderRunner();
    await act(async () => {
      await Promise.resolve();
    });
    await returnToForeground();

    expect(programReadCount()).toBe(0);
    expect(runCount()).toBe(0);
  });

  it("should run again on a return to the foreground only if a check-in is still due", async () => {
    checkinBackend.program = { next_checkin_date: TOMORROW };
    await renderRunner();
    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });

    checkinBackend.program = { next_checkin_date: TODAY };
    await returnToForeground();

    await waitFor(() => {
      expect(runCount()).toBe(1);
    });
  });

  it("should send one request when the app returns to the foreground while a run is pending", async () => {
    let release: () => void = () => undefined;
    checkinBackend.runGate = new Promise((resolve) => {
      release = resolve;
    });
    checkinBackend.program = { next_checkin_date: TODAY };
    await renderRunner((client) => {
      client.setQueryData(keys.profiles.targets, "cached");
    });
    await waitFor(() => {
      expect(runCount()).toBe(1);
    });

    await returnToForeground();
    await waitFor(() => {
      expect(programReadCount()).toBe(2);
    });
    await act(() => {
      release();
    });

    await waitFor(() => {
      expect(isInvalidated(keys.profiles.targets)).toBe(true);
    });
    expect(runCount()).toBe(1);
  });

  it("should not run again on a later foreground once the schedule shows the new date", async () => {
    checkinBackend.program = { next_checkin_date: TODAY };
    await renderRunner();
    await waitFor(() => {
      expect(runCount()).toBe(1);
    });
    await waitFor(() => {
      expect(checkinBackend.program?.next_checkin_date).toBe("2026-10-31");
    });

    await returnToForeground();

    await waitFor(() => {
      expect(programReadCount()).toBe(2);
    });
    expect(runCount()).toBe(1);
  });

  it("should not read the schedule when the app goes to the background", async () => {
    checkinBackend.program = { next_checkin_date: TOMORROW };
    await renderRunner();
    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });

    await act(() => {
      foregroundListeners.forEach((listener) => {
        listener("background");
      });
    });

    expect(programReadCount()).toBe(1);
  });

  it("should stop listening for the foreground when it unmounts", async () => {
    checkinBackend.program = { next_checkin_date: TOMORROW };
    const screen = await renderRunner();
    await waitFor(() => {
      expect(programReadCount()).toBe(1);
    });

    await screen.unmount();

    expect(removeForegroundListener).toHaveBeenCalledTimes(1);
  });

  it("should draw nothing", async () => {
    checkinBackend.program = { next_checkin_date: TOMORROW };

    const screen = await renderRunner();

    expect(screen.toJSON()).toBeNull();
  });

  describe("after a run that recorded check-ins", () => {
    it.each([
      ["targets", keys.profiles.targets],
      ["program summary", keys.program.summary],
      ["expenditure history", keys.program.expenditureHistory(12)],
      ["targets history", keys.program.targetsHistory(12)],
    ])("should invalidate the %s", async (_name, key) => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.runAnswer = { ran: 1, nextCheckinDate: "2026-10-31" };

      await renderRunner((client) => {
        client.setQueryData(key, "cached");
      });

      await waitFor(() => {
        expect(isInvalidated(key)).toBe(true);
      });
    });
  });

  describe("when a run recorded nothing", () => {
    it("should invalidate no read", async () => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.runAnswer = { ran: 0, nextCheckinDate: "2026-10-31" };

      await renderRunner((client) => {
        client.setQueryData(keys.profiles.targets, "cached");
      });

      await waitFor(() => {
        expect(runCount()).toBe(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(isInvalidated(keys.profiles.targets)).toBe(false);
    });
  });

  describe("when something fails", () => {
    const consoleSpies = () =>
      (["log", "info", "warn", "error", "debug"] as const).map((method) =>
        jest.spyOn(console, method).mockImplementation(() => undefined),
      );

    it("should throw nothing, show nothing and report only the code when the run cannot connect", async () => {
      const spies = consoleSpies();
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.runFailure = "offline";

      const screen = await renderRunner();

      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });
      const [reported] = jest.mocked(captureException).mock.calls[0] ?? [];
      expect(reported).toBeInstanceOf(Error);
      expect(reported).toHaveProperty("message", "Could not run your check-in (failed)");
      expect(screen.toJSON()).toBeNull();
      expect(spies.flatMap((spy) => spy.mock.calls)).toEqual([]);
    });

    it("should report only the database code when the schedule cannot be read", async () => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.programReadFails = true;

      await renderRunner();

      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });
      const [reported] = jest.mocked(captureException).mock.calls[0] ?? [];
      expect(reported).toHaveProperty("message", "Could not run your check-in (XX000)");
      expect(JSON.stringify(jest.mocked(captureException).mock.calls)).not.toContain("2412.34");
      expect(runCount()).toBe(0);
    });

    it("should report the code of a typed refusal and nothing the server said", async () => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.runFailure = {
        status: 500,
        code: "internal_error",
        message: RECOGNISABLE_SERVER_TEXT,
      };

      await renderRunner();

      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });
      const [reported] = jest.mocked(captureException).mock.calls[0] ?? [];
      expect(reported).toHaveProperty("message", "Could not run your check-in (internal_error)");
      expect(JSON.stringify(jest.mocked(captureException).mock.calls)).not.toContain("2412.34");
    });

    it("should report the code of a rate limit", async () => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.runFailure = { status: 429, code: "rate_limited", message: "Slow down" };

      await renderRunner();

      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });
      const [reported] = jest.mocked(captureException).mock.calls[0] ?? [];
      expect(reported).toHaveProperty("message", "Could not run your check-in (rate_limited)");
    });

    it.each([
      ["no_program", "No active program"],
      ["missing_stats", "A stat is missing"],
    ])("should treat a 409 %s as nothing to do and report nothing", async (code, message) => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.runFailure = { status: 409, code, message };

      await renderRunner();

      await waitFor(() => {
        expect(runCount()).toBe(1);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(captureException).not.toHaveBeenCalled();
    });

    it("should try again on the next return to the foreground", async () => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.runFailure = "offline";
      await renderRunner();
      await waitFor(() => {
        expect(runCount()).toBe(1);
      });

      checkinBackend.runFailure = undefined;
      await returnToForeground();

      await waitFor(() => {
        expect(runCount()).toBe(2);
      });
    });
  });

  describe("the new targets signal", () => {
    const flushWork = () =>
      act(async () => {
        await Promise.resolve();
      });

    const runWithCachedTarget = async (cachedKcal: number | null) => {
      checkinBackend.program = { next_checkin_date: TODAY };
      await renderRunner((client) => {
        client.setQueryData(keys.profiles.targets, cachedTargets(cachedKcal));
      });
    };

    it("should be set once when a run recorded check-ins and the calorie target changed", async () => {
      checkinBackend.runAnswer = { ran: 1, nextCheckinDate: "2026-10-31" };
      checkinBackend.targetKcalAfterRun = 2140;

      await runWithCachedTarget(2200);

      await waitFor(() => {
        expect(hasNewTargets()).toBe(true);
      });
      expect(takeNewTargets()).toBe(true);
      expect(takeNewTargets()).toBe(false);
    });

    it("should compare with the target as read after the run, not with the stale cache", async () => {
      checkinBackend.runAnswer = { ran: 2, nextCheckinDate: "2026-10-31" };
      checkinBackend.targetKcalAfterRun = 2140;

      await runWithCachedTarget(2200);

      await waitFor(() => {
        expect(hasNewTargets()).toBe(true);
      });
      expect(checkinBackend.targetReads).toBe(1);
    });

    it("should be set when the user had no calorie target and now has one", async () => {
      checkinBackend.targetKcalAfterRun = 2140;

      await runWithCachedTarget(null);

      await waitFor(() => {
        expect(hasNewTargets()).toBe(true);
      });
    });

    it("should not be set when a run recorded check-ins and left the calorie target as it was", async () => {
      checkinBackend.runAnswer = { ran: 1, nextCheckinDate: "2026-10-31" };
      checkinBackend.targetKcalAfterRun = 2200;

      await runWithCachedTarget(2200);

      await waitFor(() => {
        expect(checkinBackend.targetReads).toBe(1);
      });
      await flushWork();
      expect(hasNewTargets()).toBe(false);
    });

    it("should not be set when a run recorded nothing, and should read no targets", async () => {
      checkinBackend.runAnswer = { ran: 0, nextCheckinDate: "2026-10-31" };
      checkinBackend.targetKcalAfterRun = 2140;

      await runWithCachedTarget(2200);

      await waitFor(() => {
        expect(runCount()).toBe(1);
      });
      await flushWork();
      expect(checkinBackend.targetReads).toBe(0);
      expect(hasNewTargets()).toBe(false);
    });

    it("should not be set when the run fails", async () => {
      checkinBackend.runFailure = "offline";
      checkinBackend.targetKcalAfterRun = 2140;

      await runWithCachedTarget(2200);

      await waitFor(() => {
        expect(captureException).toHaveBeenCalledTimes(1);
      });
      expect(hasNewTargets()).toBe(false);
    });

    it("should not be set, and nothing should run, while offline", async () => {
      onlineManager.setOnline(false);
      checkinBackend.targetKcalAfterRun = 2140;

      await runWithCachedTarget(2200);
      await flushWork();

      expect(runCount()).toBe(0);
      expect(hasNewTargets()).toBe(false);
    });

    it("should read the target once before the run when none is cached, and be set when it changed", async () => {
      let release: () => void = () => undefined;
      checkinBackend.runGate = new Promise((resolve) => {
        release = resolve;
      });
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.targetKcalAfterRun = 2140;

      await renderRunner();

      await waitFor(() => {
        expect(runCount()).toBe(1);
      });
      expect(checkinBackend.targetReads).toBe(1);
      await act(() => {
        release();
      });

      await waitFor(() => {
        expect(hasNewTargets()).toBe(true);
      });
      expect(checkinBackend.targetReads).toBe(2);
    });

    it("should not be set when no target was cached and the run left it as it was", async () => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.targetKcalAfterRun = 2200;

      await renderRunner();

      await waitFor(() => {
        expect(checkinBackend.targetReads).toBe(2);
      });
      await flushWork();
      expect(hasNewTargets()).toBe(false);
    });

    it("should still run the check-in, and set nothing, when the target cannot be read before it", async () => {
      checkinBackend.program = { next_checkin_date: TODAY };
      checkinBackend.targetKcalAfterRun = 2140;
      checkinBackend.targetsReadFails = true;

      await renderRunner();

      await waitFor(() => {
        expect(runCount()).toBe(1);
      });
      await flushWork();
      expect(hasNewTargets()).toBe(false);
      expect(captureException).not.toHaveBeenCalled();
    });

    it("should not be set, and should report nothing, when the targets cannot be read after the run", async () => {
      checkinBackend.targetKcalAfterRun = 2140;
      checkinBackend.targetsReadFails = true;

      await runWithCachedTarget(2200);

      await waitFor(() => {
        expect(checkinBackend.targetReads).toBeGreaterThan(0);
      });
      await flushWork();
      expect(hasNewTargets()).toBe(false);
      expect(captureException).not.toHaveBeenCalled();
    });
  });
});
