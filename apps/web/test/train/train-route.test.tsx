import { TRAIN_START_FAILED } from "@keylow/core/copy";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGS_DAY_ID,
  THURSDAY_1755,
  goldenRoutine,
  mondayPush,
  renderWithTrain,
  resetTrainBackend,
  thursdayLegsOpen,
  trainBackend,
  tuesdayPull,
} from "./support";

import { TrainRoute } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const renderRoute = () =>
  renderWithTrain(
    <ToastProvider>
      <TrainRoute />
    </ToastProvider>,
  );

describe("the Train page's buttons", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1755);
    trainBackend.routine = goldenRoutine;
    trainBackend.everLogged = true;
    trainBackend.weekSessions = [mondayPush, tuesdayPull];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should start the day's session and open the session page", async () => {
    renderRoute();

    await userEvent.click(await screen.findByRole("button", { name: "Start Legs" }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/train/session");
    });
    expect(trainBackend.startedSessions).toHaveLength(1);
    expect(trainBackend.startedSessions[0]).toMatchObject({ routine_day_id: LEGS_DAY_ID });
  });

  it("should start a free session from Log a session with no routine day", async () => {
    trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsOpen].map((session) => ({
      ...session,
      ended_at: "2026-10-15T18:00:00+00:00",
    }));
    renderRoute();

    await userEvent.click(await screen.findByRole("button", { name: "Log another session" }));

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/train/session");
    });
    expect(trainBackend.startedSessions[0]).toMatchObject({ routine_day_id: null });
  });

  it("should open the session in progress from Resume without starting another", async () => {
    trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsOpen];
    trainBackend.activeSession = thursdayLegsOpen;
    renderRoute();

    await userEvent.click(await screen.findByRole("button", { name: "Resume Legs" }));

    expect(router.push).toHaveBeenCalledWith("/train/session");
    expect(trainBackend.startedSessions).toEqual([]);
  });

  it("should say the session did not start, and open nothing, when the start fails", async () => {
    trainBackend.failingWrites = true;
    renderRoute();

    await userEvent.click(await screen.findByRole("button", { name: "Start Legs" }));

    expect(await screen.findByText(TRAIN_START_FAILED)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(
      within(screen.getByRole("region", { name: "Today" })).getByRole("button", {
        name: "Start Legs",
      }),
    ).toBeTruthy();
  });
});
