import {
  HISTORY_ERROR,
  HISTORY_SCREEN,
  HISTORY_SESSION_DETAIL,
  HISTORY_SESSION_LOADING_NAME,
  HISTORY_SESSION_NOT_FOUND,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PULL_SESSION_ID,
  detailBackend,
  goldenPullSession,
  renderWithDetail,
  resetDetailBackend,
} from "./sessionDetailBackend";

import TrainSessionDetailPage from "@/app/(dashboard)/train/history/[id]/page";
import { SessionDetailScreen } from "@/components/train/SessionDetailScreen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const renderDetail = (id: string = PULL_SESSION_ID, origin: "history" | "train" = "history") =>
  renderWithDetail(<SessionDetailScreen id={id} origin={origin} />);

const card = (name: string) => screen.findByRole("region", { name });

describe("the session detail", () => {
  beforeEach(() => {
    resetDetailBackend();
    detailBackend.sessions = [goldenPullSession()];
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("with the golden Tuesday Pull", () => {
    it("should name the session and say when it was", async () => {
      renderDetail();

      expect(await screen.findByRole("heading", { level: 1, name: "Pull" })).toBeTruthy();
      expect(screen.getByText("Tuesday 13 October · 18:00 to 18:51")).toBeTruthy();
    });

    it("should show Time, Sets and Exercises as the three cards", async () => {
      renderDetail();

      const time = await screen.findByRole("group", { name: "Time" });
      expect(within(time).getByText("51 min")).toBeTruthy();
      const sets = screen.getByRole("group", { name: "Sets" });
      expect(within(sets).getByText("17")).toBeTruthy();
      expect(within(sets).getByText("and 1 warm-up")).toBeTruthy();
      const exercises = screen.getByRole("group", { name: "Exercises" });
      expect(within(exercises).getByText("5")).toBeTruthy();
    });

    it("should say nothing of a plan, since the session is shown as it was done", async () => {
      renderDetail();

      await screen.findByRole("group", { name: "Time" });
      expect(document.body.textContent).not.toMatch(/\bplan|sets over|more than/i);
    });

    it("should not read the routine, so changing it cannot change what the detail shows", async () => {
      renderDetail();

      await screen.findByRole("group", { name: "Time" });
      expect(detailBackend.reads).not.toContain("routines");
      expect(detailBackend.reads).not.toContain("routine_days");
    });

    it("should draw a card for each exercise, in the order they were first logged", async () => {
      renderDetail();

      await screen.findByRole("group", { name: "Time" });
      expect(
        screen.getAllByRole("region").map((region) => region.getAttribute("aria-label")),
      ).toEqual([
        "Pullups",
        "Bent over barbell row",
        "Wide-grip lat pulldown",
        "Face pull",
        "Barbell curl",
      ]);
    });

    it("should note a bodyweight exercise and give its sets in reps", async () => {
      renderDetail();

      const pullups = await card("Pullups");
      expect(within(pullups).getByText("Bodyweight")).toBeTruthy();
      expect(within(pullups).getByRole("row", { name: "Set 1, 10 reps, RIR 2" }).textContent).toBe(
        "110 repsRIR 2",
      );
    });

    it("should mark the warm-up W and list its sets as what was done", async () => {
      renderDetail();

      const rowCard = await card("Bent over barbell row");
      const sets = within(rowCard).getByRole("table", {
        name: HISTORY_SESSION_DETAIL.setsListName,
      });
      expect(
        within(sets)
          .getAllByRole("row")
          .map((row) => row.textContent),
      ).toEqual(["W40 kg × 10No RIR", "170 kg × 10RIR 2", "270 kg × 9RIR 2", "370 kg × 8RIR 2"]);
    });

    it("should show the load in pounds for someone who trains in them", async () => {
      detailBackend.weightUnit = "lb";
      renderDetail();

      const rowCard = await card("Bent over barbell row");
      expect(within(rowCard).getByRole("row", { name: /^Set 1, 154.3 lb by 10/ })).toBeTruthy();
    });

    it("should draw each set as a row to press, with nothing to type into or check", async () => {
      renderDetail();

      const rowCard = await card("Bent over barbell row");
      expect(within(rowCard).getAllByRole("button")).toHaveLength(4);
      expect(within(rowCard).queryByRole("textbox")).toBeNull();
      expect(within(rowCard).queryByRole("checkbox")).toBeNull();
      expect(within(rowCard).queryByRole("columnheader")).toBeNull();
    });
  });

  describe("the way back", () => {
    it("should go back to the history when it was opened from there", async () => {
      renderDetail(PULL_SESSION_ID, "history");

      const back = await screen.findByRole("link", { name: HISTORY_SESSION_DETAIL.backLabel });
      expect(back.getAttribute("href")).toBe("/train/history");
    });

    it("should go back to the Train home when it was opened from there", async () => {
      renderDetail(PULL_SESSION_ID, "train");

      const back = await screen.findByRole("link", { name: HISTORY_SCREEN.backLabel });
      expect(back.getAttribute("href")).toBe("/train");
    });
  });

  describe("a session that cannot be found", () => {
    it("should read the same for a session that is not there, is deleted or is another person's", async () => {
      detailBackend.sessions = [goldenPullSession({ deleted_at: "2026-10-14T09:00:00+00:00" })];
      renderDetail();

      expect(
        await screen.findByRole("heading", { name: HISTORY_SESSION_NOT_FOUND.title }),
      ).toBeTruthy();
      expect(screen.getByText(HISTORY_SESSION_NOT_FOUND.body)).toBeTruthy();
    });

    it("should lead back to the history", async () => {
      renderDetail("00000004-0000-4000-8000-0000000000ee");

      const open = await screen.findByRole("link", { name: HISTORY_SESSION_NOT_FOUND.action });
      expect(open.getAttribute("href")).toBe("/train/history");
    });

    it("should treat an address that is not an id as not found, without asking", async () => {
      renderDetail("pull");

      expect(
        await screen.findByRole("heading", { name: HISTORY_SESSION_NOT_FOUND.title }),
      ).toBeTruthy();
      expect(detailBackend.reads).not.toContain("workout_sessions");
    });
  });

  describe("while it loads and when it fails", () => {
    it("should show a named skeleton while the session is read", async () => {
      detailBackend.hung = true;
      renderDetail();

      expect(
        await screen.findByRole("status", { name: HISTORY_SESSION_LOADING_NAME }),
      ).toBeTruthy();
    });

    it("should show the error state, and Try again reads it once more", async () => {
      detailBackend.failing = true;
      // The session read is tried three more times before it gives up, a second longer each time.
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      renderDetail();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });
      vi.useRealTimers();

      expect(await screen.findByRole("heading", { name: HISTORY_ERROR.title })).toBeTruthy();
      detailBackend.failing = false;
      await userEvent.click(screen.getByRole("button", { name: HISTORY_ERROR.action }));

      expect(await screen.findByRole("heading", { level: 1, name: "Pull" })).toBeTruthy();
    });

    it("should show the error state with no Try again, and no skeleton, offline with nothing saved", async () => {
      act(() => {
        onlineManager.setOnline(false);
      });
      renderDetail();

      expect(await screen.findByRole("heading", { name: HISTORY_ERROR.title })).toBeTruthy();
      expect(screen.queryByRole("button", { name: HISTORY_ERROR.action })).toBeNull();
      expect(screen.queryByRole("status", { name: HISTORY_SESSION_LOADING_NAME })).toBeNull();
    });

    it("should read the session by itself when the connection comes back", async () => {
      act(() => {
        onlineManager.setOnline(false);
      });
      renderDetail();
      await screen.findByRole("heading", { name: HISTORY_ERROR.title });

      act(() => {
        onlineManager.setOnline(true);
      });

      await waitFor(() => {
        expect(screen.getByRole("heading", { level: 1, name: "Pull" })).toBeTruthy();
      });
    });
  });
});

describe("the session detail page", () => {
  beforeEach(() => {
    resetDetailBackend();
    detailBackend.sessions = [goldenPullSession()];
  });

  afterEach(() => {
    cleanup();
  });

  const renderPage = async (from?: string) => {
    const page = await TrainSessionDetailPage({
      params: Promise.resolve({ id: PULL_SESSION_ID }),
      searchParams: Promise.resolve(from === undefined ? {} : { from }),
    });
    return renderWithDetail(page);
  };

  it("should open the session named in the address", async () => {
    await renderPage();

    expect(await screen.findByRole("heading", { level: 1, name: "Pull" })).toBeTruthy();
    expect(screen.getByRole("link", { name: HISTORY_SESSION_DETAIL.backLabel })).toBeTruthy();
  });

  it("should go back to the Train home when the address says it came from there", async () => {
    await renderPage("train");

    expect(await screen.findByRole("link", { name: HISTORY_SCREEN.backLabel })).toBeTruthy();
  });

  it("should go back to the history for any other origin", async () => {
    await renderPage("elsewhere");

    expect(
      await screen.findByRole("link", { name: HISTORY_SESSION_DETAIL.backLabel }),
    ).toBeTruthy();
  });
});
