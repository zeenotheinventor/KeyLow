import { TRAIN_PICK_DAY, TRAIN_START_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEGS_DAY_ID,
  THURSDAY_1755,
  THURSDAY_1900,
  WEDNESDAY_1200,
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

const PULL_DAY_ID = "00000003-0000-4000-8000-000000000002";

const renderRoute = () =>
  renderWithTrain(
    <ToastProvider>
      <TrainRoute />
    </ToastProvider>,
  );

const pickDayButton = () => screen.findByRole("button", { name: TRAIN_PICK_DAY.action });
const dialog = () => screen.findByRole("dialog", { name: TRAIN_PICK_DAY.sheetTitle });
const dayButton = (name: RegExp) =>
  within(screen.getByRole("dialog")).getByRole("button", { name });
const pullRow = /^Pull/;
const legsRow = /^Legs/;

const openDialog = async () => {
  await userEvent.click(await pickDayButton());
  await dialog();
};

describe("Pick day on the Train page", () => {
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
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("on the golden Thursday before Legs", () => {
    it("should draw Pick day beside Start Legs", async () => {
      renderRoute();

      const card = await screen.findByRole("region", { name: "Today" });
      expect(await within(card).findByRole("button", { name: "Start Legs" })).toBeTruthy();
      expect(within(card).getByRole("button", { name: TRAIN_PICK_DAY.action })).toBeTruthy();
    });

    it("should open a dialog listing every routine day in routine order, with its load and weekday", async () => {
      renderRoute();

      await openDialog();

      const rows = within(screen.getByRole("dialog")).getAllByRole("listitem");
      expect(rows.map((row) => row.textContent)).toEqual([
        "Push1 exercise · 3 setsMonday",
        "Pull1 exercise · 3 setsTuesday",
        "Legs5 exercises · 16 setsThursday",
        "Push1 exercise · 3 setsSaturday",
      ]);
    });

    it("should start a session for the picked day, not today's, and open the session page", async () => {
      renderRoute();
      await openDialog();

      await userEvent.click(dayButton(pullRow));

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith("/train/session");
      });
      expect(trainBackend.startedSessions).toHaveLength(1);
      expect(trainBackend.startedSessions[0]).toMatchObject({
        routine_day_id: PULL_DAY_ID,
        local_date: "2026-10-15",
        tz: "Europe/London",
      });
    });

    it("should leave one open session when the same day is pressed twice in the same moment", async () => {
      renderRoute();
      await openDialog();
      const pull = dayButton(pullRow);

      act(() => {
        fireEvent.click(pull);
        fireEvent.click(pull);
      });

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledTimes(1);
      });
      expect(trainBackend.startedSessions).toHaveLength(1);
    });

    it("should keep the start and the spinner on the first day when two days are pressed in the same moment", async () => {
      let release: () => void = () => undefined;
      trainBackend.extraRoute = (request) =>
        request.method === "POST" && new URL(request.url).pathname.endsWith("/workout_sessions")
          ? new Promise<Response>((resolve) => {
              release = () => {
                trainBackend.extraRoute = null;
                resolve(new Response(null, { status: 503 }));
              };
            })
          : null;
      renderRoute();
      await openDialog();
      const pull = dayButton(pullRow);
      const legs = dayButton(legsRow);

      act(() => {
        fireEvent.click(pull);
        fireEvent.click(legs);
      });

      expect(
        await within(screen.getByRole("dialog")).findByRole("button", {
          name: pullRow,
          busy: true,
        }),
      ).toBeTruthy();
      expect(
        within(screen.getByRole("dialog")).queryByRole("button", { name: legsRow, busy: true }),
      ).toBeNull();
      release();
    });

    it("should show the pressed day busy and the others dimmed while the start is under way", async () => {
      let release: () => void = () => undefined;
      trainBackend.extraRoute = (request) =>
        request.method === "POST" && new URL(request.url).pathname.endsWith("/workout_sessions")
          ? new Promise<Response>((resolve) => {
              release = () => {
                trainBackend.extraRoute = null;
                resolve(new Response(null, { status: 503 }));
              };
            })
          : null;
      renderRoute();
      await openDialog();

      await userEvent.click(dayButton(pullRow));

      expect(
        await within(screen.getByRole("dialog")).findByRole("button", {
          name: pullRow,
          busy: true,
        }),
      ).toBeTruthy();
      expect(dayButton(legsRow)).toHaveProperty("disabled", true);
      // The pressed row stays enabled and keeps focus, so a keyboard user is not dropped.
      expect(dayButton(/^Pull/)).toHaveProperty("disabled", false);
      expect(document.activeElement).toBe(dayButton(/^Pull/));
      release();
    });

    it("should say the session did not start, keep the dialog open and let a day be pressed again", async () => {
      trainBackend.failingWrites = true;
      renderRoute();
      await openDialog();

      await userEvent.click(dayButton(pullRow));

      expect(await screen.findByText(TRAIN_START_FAILED)).toBeTruthy();
      expect(router.push).not.toHaveBeenCalled();
      const open = screen.getByRole("dialog", { name: TRAIN_PICK_DAY.sheetTitle });
      await waitFor(() => {
        expect(within(open).queryByRole("img", { name: "Loading" })).toBeNull();
      });

      trainBackend.failingWrites = false;
      await userEvent.click(dayButton(pullRow));
      await waitFor(() => {
        expect(router.push).toHaveBeenCalledTimes(1);
      });
    });

    it("should close the dialog once the session is started, since the card then reads Resume", async () => {
      renderRoute();
      await openDialog();

      await userEvent.click(dayButton(pullRow));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      const card = await screen.findByRole("region", { name: "Today" });
      expect(await within(card).findByRole("button", { name: "Resume Pull" })).toBeTruthy();
      expect(within(card).queryByRole("button", { name: TRAIN_PICK_DAY.action })).toBeNull();
    });

    it("should close from its Close control without starting anything", async () => {
      renderRoute();
      await openDialog();

      await userEvent.click(screen.getByRole("button", { name: TRAIN_PICK_DAY.closeName }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trainBackend.startedSessions).toEqual([]);
    });

    it("should close on Escape and return focus to Pick day", async () => {
      renderRoute();
      const opener = await pickDayButton();
      await userEvent.click(opener);
      await dialog();

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(opener);
    });

    it("should dim Pick day and open nothing while offline", async () => {
      renderRoute();
      await pickDayButton();

      act(() => {
        onlineManager.setOnline(false);
      });
      await userEvent.click(screen.getByRole("button", { name: TRAIN_PICK_DAY.action }));

      expect(screen.getByRole("button", { name: TRAIN_PICK_DAY.action })).toHaveProperty(
        "disabled",
        true,
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should dim the days when the connection goes while the dialog is open", async () => {
      renderRoute();
      await openDialog();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(dayButton(pullRow)).toHaveProperty("disabled", true);
    });
  });

  describe("on the other cards", () => {
    it("should draw Pick day beside Log a session on a rest day", async () => {
      vi.setSystemTime(WEDNESDAY_1200);
      renderRoute();

      expect(await screen.findByRole("button", { name: "Log a session" })).toBeTruthy();
      expect(screen.getByRole("button", { name: TRAIN_PICK_DAY.action })).toBeTruthy();
    });

    it("should draw Pick day beside Log another session once the day's session is done", async () => {
      vi.setSystemTime(THURSDAY_1900);
      trainBackend.weekSessions = [
        mondayPush,
        tuesdayPull,
        { ...thursdayLegsOpen, ended_at: "2026-10-15T18:00:00+00:00" },
      ];
      renderRoute();

      expect(await screen.findByRole("button", { name: "Log another session" })).toBeTruthy();
      expect(screen.getByRole("button", { name: TRAIN_PICK_DAY.action })).toBeTruthy();
    });

    it("should draw no Pick day while a session is open, and keep Resume", async () => {
      vi.setSystemTime(THURSDAY_1900);
      trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsOpen];
      trainBackend.activeSession = thursdayLegsOpen;
      renderRoute();

      expect(await screen.findByRole("button", { name: "Resume Legs" })).toBeTruthy();
      expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).toBeNull();
    });

    it("should draw no Pick day with no routine", async () => {
      trainBackend.routine = null;
      renderRoute();

      expect(await screen.findByRole("button", { name: /^Log a session/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).toBeNull();
    });

    it("should draw no Pick day on the first visit", async () => {
      trainBackend.routine = null;
      trainBackend.everLogged = false;
      trainBackend.weekSessions = [];
      renderRoute();

      expect(await screen.findByRole("button", { name: /^Log a session/ })).toBeTruthy();
      expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).toBeNull();
    });
  });

  it("should draw no Pick day on a routine with no days", async () => {
    trainBackend.routine = { ...goldenRoutine, routine_days: [] };
    trainBackend.weekSessions = [];
    renderRoute();

    await screen.findByRole("heading", { name: "Train" });
    await waitFor(() => {
      expect(screen.getByRole("region", { name: "Today" })).toBeTruthy();
    });
    expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).toBeNull();
  });

  it("should move focus to Resume when a session is opened elsewhere while the dialog is open", async () => {
    const { queryClient } = renderRoute();
    await openDialog();

    trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsOpen];
    trainBackend.activeSession = thursdayLegsOpen;
    await act(async () => {
      await queryClient.invalidateQueries();
    });

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    const resume = await screen.findByRole("button", { name: "Resume Legs" });
    expect(document.activeElement).toBe(resume);
  });

  it("should leave focus off Resume on a page loaded with a session in progress", async () => {
    vi.setSystemTime(THURSDAY_1900);
    trainBackend.weekSessions = [mondayPush, tuesdayPull, thursdayLegsOpen];
    trainBackend.activeSession = thursdayLegsOpen;
    // The page is left and came back to, so its reads are cached and Resume is drawn on the first render.
    function LeaveAndReturn() {
      const [isShown, setIsShown] = useState(true);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setIsShown((shown) => !shown);
            }}
          >
            Toggle page
          </button>
          {isShown ? <TrainRoute /> : null}
        </>
      );
    }
    renderWithTrain(
      <ToastProvider>
        <LeaveAndReturn />
      </ToastProvider>,
    );
    await screen.findByRole("button", { name: "Resume Legs" });
    await userEvent.click(screen.getByRole("button", { name: "Toggle page" }));
    expect(screen.queryByRole("button", { name: "Resume Legs" })).toBeNull();

    await userEvent.click(screen.getByRole("button", { name: "Toggle page" }));

    const resume = screen.getByRole("button", { name: "Resume Legs" });
    expect(document.activeElement).not.toBe(resume);
  });

  it("should leave focus alone when the dialog is closed from its own controls", async () => {
    renderRoute();
    const opener = await pickDayButton();
    await userEvent.click(opener);
    await dialog();

    await userEvent.click(screen.getByRole("button", { name: TRAIN_PICK_DAY.closeName }));

    expect(document.activeElement).toBe(opener);
  });

  it("should start Legs from the dialog the same as from Start Legs", async () => {
    renderRoute();
    await openDialog();

    await userEvent.click(dayButton(legsRow));

    await waitFor(() => {
      expect(trainBackend.startedSessions).toHaveLength(1);
    });
    expect(trainBackend.startedSessions[0]).toMatchObject({ routine_day_id: LEGS_DAY_ID });
  });
});
