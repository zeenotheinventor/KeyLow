import { TRAIN_FIRST_TIME, TRAIN_START_FAILED } from "@keylow/core/copy";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGS_DAY_ID,
  THURSDAY_1755,
  THURSDAY_1900,
  goldenRoutine,
  mondayPush,
  renderWithTrain,
  resetTrainBackend,
  thursdayLegsOpen,
  trainBackend,
  tuesdayPull,
} from "./support";
import { storedGoalRow } from "../goals/support";

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

  it("should open the finished session's detail from View session, as opened from the Train home", async () => {
    vi.setSystemTime(THURSDAY_1900);
    trainBackend.weekSessions = [
      mondayPush,
      tuesdayPull,
      { ...thursdayLegsOpen, ended_at: "2026-10-15T18:00:00+00:00" },
    ];
    renderRoute();

    await userEvent.click(await screen.findByRole("button", { name: "View session" }));

    expect(router.push).toHaveBeenCalledWith(`/train/history/${thursdayLegsOpen.id}?from=train`);
    expect(trainBackend.startedSessions).toHaveLength(0);
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

describe("the first-time card's Set your goal", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1755);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const setYourGoal = () => screen.findByRole("button", { name: TRAIN_FIRST_TIME.goalAction });

  it("should open the Goal page, told it came from Train, when there is no goal", async () => {
    const { queryClient } = renderRoute();
    const button = await setYourGoal();
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });

    await userEvent.click(button);

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/goal?from=train");
  });

  it("should open the Goal page when a goal was read", async () => {
    trainBackend.goal = storedGoalRow;
    const { queryClient } = renderRoute();
    const button = await setYourGoal();
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });

    await userEvent.click(button);

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/goal?from=train");
  });

  it("should open the Goal page, told it came from Train, while the goal is not yet known", async () => {
    trainBackend.goal = storedGoalRow;
    trainBackend.hangingReads.add("training_goals");
    renderRoute();

    await userEvent.click(await setYourGoal());

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/goal?from=train");
  });

  it("should open the Goal page, told it came from Train, when the goal could not be read", async () => {
    trainBackend.goal = storedGoalRow;
    trainBackend.failingReads.add("training_goals");
    const { queryClient } = renderRoute();
    const button = await setYourGoal();
    await waitFor(() => {
      expect(queryClient.isFetching()).toBe(0);
    });

    await userEvent.click(button);

    expect(router.push).toHaveBeenCalledExactlyOnceWith("/goal?from=train");
  });
});
