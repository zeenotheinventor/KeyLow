import { KeyLowProvider } from "@keylow/api-client";
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

async function renderBarHook() {
  queryClient = createDiaryQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <KeyLowProvider client={trainClient} queryClient={queryClient}>
      {children}
    </KeyLowProvider>
  );

  return renderHook(() => useSessionBar(), { wrapper });
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
