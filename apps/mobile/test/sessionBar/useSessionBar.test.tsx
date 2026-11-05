import { KeyLowProvider } from "@keylow/api-client";
import { buildSetSnapshot } from "@keylow/core/training";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react-native";

import { useSessionBar } from "../../components/SessionBar";
import { createDiaryQueryClient, diaryBackend } from "../support/diaryBackend";
import { resetRouterMock, routerMock } from "../support/expoRouterMock";
import { goldenLegsOpen, legsRoutine, LEGS_DAY_ID } from "../support/sessionGoldenLegs";
import {
  resetTrainBackend,
  trainBackend,
  trainClient,
  trainRequestsTo,
} from "../support/trainBackend";

import type { QueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));
jest.mock(
  "expo-router",
  () => jest.requireActual<{ mockExpoRouter: unknown }>("../support/expoRouterMock").mockExpoRouter,
);

let queryClient: QueryClient;

async function renderBarHook(seed?: (client: QueryClient) => void) {
  queryClient = createDiaryQueryClient();
  seed?.(queryClient);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <KeyLowProvider client={trainClient} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );

  // Every total the bar showed, so a test can say a number was never drawn.
  const totals: (number | undefined)[] = [];
  const rendered = await renderHook(
    () => {
      const bar = useSessionBar();
      totals.push(bar?.setsPlanned);
      return bar;
    },
    { wrapper },
  );
  return { ...rendered, totals };
}

describe("what the session bar shows", () => {
  beforeEach(() => {
    resetTrainBackend();
    resetRouterMock();
  });

  afterEach(async () => {
    await cleanup();
    await act(() => {
      onlineManager.setOnline(true);
    });
    queryClient.clear();
  });

  it("should show nothing when no session is open, once the read has answered", async () => {
    trainBackend.routine = legsRoutine;

    const { result } = await renderBarHook();

    await waitFor(() => {
      expect(trainRequestsTo("active_session")).toBe(1);
    });
    expect(result.current).toBeNull();
    expect(trainRequestsTo("routines")).toBe(0);
  });

  it("should show the day, the start and 8 of 16 sets for the golden Legs session, warm-ups left out", async () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();

    const { result } = await renderBarHook();

    await waitFor(() => {
      expect(result.current).toMatchObject({
        dayName: "Legs",
        startedAt: "2026-10-15T18:30:00+01:00",
        setsLogged: 8,
        setsPlanned: 16,
      });
    });
  });

  describe("with a suggestion accepted for the session's day", () => {
    const curl = {
      id: "00000001-0000-4000-8000-000000000077",
      name: "Dumbbell curl",
      equipment: "dumbbell",
      mechanic: "isolation",
    } as const;
    const muscles = [{ muscle_id: "biceps", role: "primary", weight: 1 }] as const;
    const acceptedRow = (overrides: Record<string, unknown> = {}) => ({
      id: "66666666-6666-4666-8666-000000000001",
      local_date: "2026-10-15",
      routine_day_id: LEGS_DAY_ID,
      exercises: [
        {
          id: curl.id,
          position: 0,
          exercise_id: curl.id,
          target_sets: 3,
          target_rir: 2,
          rep_min: 8,
          rep_max: 10,
          exercise: curl,
          muscles,
          snapshot: buildSetSnapshot(curl, [...muscles]),
        },
      ],
      reasons: { picks: [] },
      params_version: "suggest-v2",
      deleted_at: null,
      ...overrides,
    });

    it("should count the added sets once in the total", async () => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = goldenLegsOpen();
      trainBackend.acceptedSuggestions = [acceptedRow()];

      const { result } = await renderBarHook();

      await waitFor(() => {
        expect(result.current).toMatchObject({ setsLogged: 8, setsPlanned: 19 });
      });
    });

    it("should show no total until the accepted suggestions are read, and never 16 and then 19", async () => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = goldenLegsOpen();
      trainBackend.acceptedSuggestions = [acceptedRow()];
      let release: () => void = () => undefined;
      trainBackend.holdAcceptedSuggestions = new Promise((resolve) => {
        release = resolve;
      });

      const { result, totals } = await renderBarHook();

      await waitFor(() => {
        expect(trainRequestsTo("routines")).toBeGreaterThanOrEqual(2);
      });
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(result.current).toMatchObject({ setsLogged: 8, setsPlanned: 0 });

      await act(() => {
        release();
      });
      await waitFor(() => {
        expect(result.current).toMatchObject({ setsPlanned: 19 });
      });
      expect(totals).not.toContain(16);
    });

    it("should show the day's total without the additions when the phone went offline before it read them", async () => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = goldenLegsOpen();
      trainBackend.acceptedSuggestions = [acceptedRow()];
      // The first run reads everything but the accepted suggestions, which never answer.
      trainBackend.holdAcceptedSuggestions = new Promise(() => undefined);
      await renderBarHook();
      await waitFor(() => {
        // The Terms, the session, the routine and its detail. The accepted suggestions never answer.
        expect(
          queryClient
            .getQueryCache()
            .getAll()
            .filter(({ state }) => state.data !== undefined).length,
        ).toBe(4);
      });
      const saved = queryClient
        .getQueryCache()
        .getAll()
        .map(({ queryKey, state }) => ({ queryKey, data: state.data }));
      await cleanup();
      queryClient.clear();
      await act(() => {
        onlineManager.setOnline(false);
      });

      const { result } = await renderBarHook((client) => {
        for (const { queryKey, data } of saved) {
          client.setQueryData(queryKey, data);
        }
      });

      await waitFor(() => {
        expect(result.current).toMatchObject({ setsLogged: 8, setsPlanned: 16 });
      });
    });

    it("should count nothing for a suggestion accepted into another day", async () => {
      trainBackend.routine = legsRoutine;
      trainBackend.activeSession = goldenLegsOpen();
      trainBackend.acceptedSuggestions = [acceptedRow({ local_date: "2026-10-16" })];

      const { result } = await renderBarHook();

      await waitFor(() => {
        expect(result.current).toMatchObject({ setsLogged: 8, setsPlanned: 16 });
      });
    });

    it("should plan a free session as the added sets alone when the suggestion stands alone", async () => {
      trainBackend.activeSession = goldenLegsOpen(null);
      trainBackend.acceptedSuggestions = [acceptedRow({ routine_day_id: null })];

      const { result } = await renderBarHook();

      await waitFor(() => {
        expect(result.current).toMatchObject({ dayName: null, setsPlanned: 3 });
      });
    });
  });

  it("should show the sets without a total, and read no routine, for a session with no routine day", async () => {
    trainBackend.activeSession = goldenLegsOpen(null);

    const { result } = await renderBarHook();

    await waitFor(() => {
      expect(result.current).toMatchObject({ dayName: null, setsLogged: 8, setsPlanned: 0 });
    });
    expect(trainRequestsTo("routines")).toBe(0);
  });

  it("should show the sets without a total when the session's day is no longer in the active routine", async () => {
    trainBackend.routine = { ...legsRoutine, routine_days: [] };
    trainBackend.activeSession = goldenLegsOpen(LEGS_DAY_ID);

    const { result } = await renderBarHook();

    await waitFor(() => {
      expect(result.current).toMatchObject({ setsLogged: 8, setsPlanned: 0 });
    });
  });

  it("should show the sets without a total while the plan is on its way, then the total when the plan lands", async () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
    trainBackend.hungTables.add("routines");

    const { result } = await renderBarHook();

    await waitFor(() => {
      expect(result.current).toMatchObject({ dayName: "Legs", setsLogged: 8, setsPlanned: 0 });
    });
    expect(trainRequestsTo("routines")).toBe(1);

    trainBackend.hungTables.delete("routines");
    // A read with no answer yet is not started again while it is on its way, so it is let go first.
    await act(async () => {
      await queryClient.cancelQueries();
      void queryClient.invalidateQueries();
    });

    await waitFor(() => {
      expect(result.current).toMatchObject({ setsLogged: 8, setsPlanned: 16 });
    });
  });

  it("should show the sets without a total when the routine cannot be read", async () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
    trainBackend.failingTables.add("routines");

    const { result } = await renderBarHook();

    await waitFor(() => {
      expect(result.current).toMatchObject({ dayName: "Legs", setsLogged: 8, setsPlanned: 0 });
    });
  });

  it("should read nothing, and show nothing, until the Terms are accepted", async () => {
    diaryBackend.terms = { terms_accepted_at: null, terms_version: null };
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();

    const { result } = await renderBarHook();

    await waitFor(() => {
      expect(diaryBackend.requests.some((request) => request.table === "profiles")).toBe(true);
    });
    expect(trainRequestsTo("active_session")).toBe(0);
    expect(trainRequestsTo("routines")).toBe(0);
    expect(result.current).toBeNull();
  });

  it("should open the session screen when pressed", async () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
    const { result } = await renderBarHook();
    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    result.current?.onPress();

    expect(routerMock.push).toHaveBeenCalledWith("/session");
  });
});
