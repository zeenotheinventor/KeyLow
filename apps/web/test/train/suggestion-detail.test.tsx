import { SUGGESTION_ACCEPTED, SUGGESTION_DETAIL, SUGGESTION_FAILED } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { installGoldenSuggestionBackend, suggestionBackend } from "./suggestionBackend";
import {
  LEGS_DAY_ID,
  THURSDAY_1755,
  WEDNESDAY_1200,
  renderWithTrain,
  resetTrainBackend,
  trainBackend,
} from "./support";

import { TrainRoute } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";
import { SUGGESTION_DISMISSED_KEY } from "@/lib/suggestionDismissed";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const renderRoute = () =>
  renderWithTrain(
    <ToastProvider>
      <TrainRoute />
    </ToastProvider>,
  );

const FRIDAY_1200 = new Date("2026-10-16T11:00:00Z");

const wednesdayLink = "Suggested for Thursday: Legs, plus incline dumbbell press. See why";
const todayLink = "Suggested for today: Legs, plus incline dumbbell press. See why";

const openerOf = (name: string) => screen.findByRole("button", { name });
const dialog = (name: string) => screen.findByRole("dialog", { name });
const isDisabled = (button: HTMLElement) => button.hasAttribute("disabled");

const openWednesdayDetail = async () => {
  await userEvent.click(await openerOf(wednesdayLink));
  return dialog("Suggested for Thursday");
};

const openTodayDetail = async () => {
  await userEvent.click(await openerOf(todayLink));
  return dialog("Suggested for today");
};

describe("the suggestion detail on the Train page, on the golden Wednesday at 12:00", () => {
  beforeEach(() => {
    resetTrainBackend();
    installGoldenSuggestionBackend();
    router.push.mockReset();
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(WEDNESDAY_1200);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("opening it", () => {
    it("should open from a button in the card, named with core's See why words", async () => {
      renderRoute();
      const card = await screen.findByRole("region", { name: "Suggestion for Thursday" });

      expect(within(card).getByRole("button", { name: wednesdayLink })).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should show the whole session, a row for each of the six exercises, with its target and where it came from", async () => {
      renderRoute();

      const panel = await openWednesdayDetail();

      expect(within(panel).getByText("Thursday 15 October · your planned Legs")).toBeTruthy();
      expect(
        within(panel).getByRole("heading", { name: "Legs, plus incline dumbbell press" }),
      ).toBeTruthy();
      expect(within(panel).getByText("6 exercises · 19 sets · about 60 min")).toBeTruthy();
      const rows = within(
        within(panel).getByRole("list", { name: "Exercises for Thursday" }),
      ).getAllByRole("listitem");
      expect(rows).toHaveLength(6);
      expect(rows.map((row) => row.textContent)).toEqual([
        "Barbell squat3 × 5 to 8 · RIR 2From your plan",
        "Romanian deadlift3 × 8 to 10 · RIR 2From your plan",
        "Leg press3 × 10 to 12 · RIR 1From your plan",
        "Seated leg curl3 × 10 to 12 · RIR 1From your plan",
        "Standing calf raises4 × 10 to 15 · RIR 1From your plan",
        "Incline dumbbell press3 × 8 to 10 · RIR 2Added. Upper chest is a V-taper priority, at 4.8 of 10 sets in the last 7 days, and ready now at heat 13 %. Side delts would not fit your 60 minutes.",
      ]);
      expect(
        within(panel).getByText(
          "Ki-Lo keeps your plan and adds what your week is short of. Muscles still hot are left out.",
        ),
      ).toBeTruthy();
    });

    it("should draw Not now and Add to Thursday as the card does", async () => {
      renderRoute();

      const panel = await openWednesdayDetail();

      expect(
        within(panel).getByRole("button", { name: "Not now for Thursday's suggestion" }),
      ).toBeTruthy();
      expect(within(panel).getByRole("button", { name: "Add to Thursday" })).toBeTruthy();
    });

    it("should draw no way into the detail when the routine's rep ranges cannot be read, and keep the offer", async () => {
      trainBackend.failingReads.add("routine_detail");
      renderRoute();

      const card = await screen.findByRole("region", { name: "Suggestion for Thursday" });

      expect(within(card).queryByRole("button", { name: /See why$/ })).toBeNull();
      expect(within(card).getByRole("button", { name: "Add to Thursday" })).toBeTruthy();
    });
  });

  describe("closing it", () => {
    it("should close on Escape and give focus back to the button that opened it", async () => {
      renderRoute();
      const opener = await openerOf(wednesdayLink);
      opener.focus();
      await userEvent.keyboard("{Enter}");
      await dialog("Suggested for Thursday");

      await userEvent.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(document.activeElement).toBe(opener);
    });

    it("should close from Back to Train and write nothing", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();

      await userEvent.click(within(panel).getByRole("button", { name: "Back to Train" }));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(suggestionBackend.inserted).toHaveLength(0);
    });
  });

  describe("Add to Thursday from the detail", () => {
    it("should store the suggestion once, close the detail and show the accepted card with its toast", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();

      await userEvent.click(within(panel).getByRole("button", { name: "Add to Thursday" }));

      expect(await screen.findByRole("region", { name: "Thursday" })).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(suggestionBackend.inserted).toHaveLength(1);
      expect(suggestionBackend.inserted[0]).toMatchObject({
        local_date: "2026-10-15",
        routine_day_id: LEGS_DAY_ID,
      });
      expect(await screen.findByText(/^Added to Thursday/)).toBeTruthy();
    });

    it("should keep the keyboard route: focus goes to Undo and, once Undo is pressed, back to Add on the card", async () => {
      renderRoute();
      const opener = await openerOf(wednesdayLink);
      opener.focus();
      await userEvent.keyboard("{Enter}");
      const panel = await dialog("Suggested for Thursday");
      within(panel).getByRole("button", { name: "Add to Thursday" }).focus();

      await userEvent.keyboard("{Enter}");

      const undo = await screen.findByRole("button", { name: SUGGESTION_ACCEPTED.undoAction });
      await waitFor(() => {
        expect(document.activeElement).toBe(undo);
      });
      await userEvent.keyboard("{Enter}");
      const add = await screen.findByRole("button", { name: "Add to Thursday" });
      await waitFor(() => {
        expect(document.activeElement).toBe(add);
      });
    });

    it("should leave the offer and its focus in place, and say it was not saved, when the write fails", async () => {
      suggestionBackend.failingWrites = true;
      renderRoute();
      const opener = await openerOf(wednesdayLink);
      opener.focus();
      await userEvent.keyboard("{Enter}");
      const panel = await dialog("Suggested for Thursday");
      within(panel).getByRole("button", { name: "Add to Thursday" }).focus();

      await userEvent.keyboard("{Enter}");

      expect(await screen.findByText(SUGGESTION_FAILED.acceptFailed)).toBeTruthy();
      expect(screen.getByRole("region", { name: "Suggestion for Thursday" })).toBeTruthy();
      expect(document.activeElement).toBe(await openerOf(wednesdayLink));
    });
  });

  describe("Not now from the detail", () => {
    it("should put the day off, close the detail and remove the card", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();

      await userEvent.click(
        within(panel).getByRole("button", { name: "Not now for Thursday's suggestion" }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(window.localStorage.getItem(SUGGESTION_DISMISSED_KEY)).toContain("2026-10-15");
    });

    it("should leave focus on a control of the page, not on the page itself, from the keyboard", async () => {
      renderRoute();
      const opener = await openerOf(wednesdayLink);
      opener.focus();
      await userEvent.keyboard("{Enter}");
      const panel = await dialog("Suggested for Thursday");
      within(panel).getByRole("button", { name: "Not now for Thursday's suggestion" }).focus();

      await userEvent.keyboard("{Enter}");

      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      });
      // The control after the card, which is the week strip's first day.
      expect(document.activeElement).toBe(screen.getByRole("link", { name: /^Monday 12 October/ }));
    });

    it("should leave focus on a control of the page after a press with the pointer too", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();

      await userEvent.click(
        within(panel).getByRole("button", { name: "Not now for Thursday's suggestion" }),
      );

      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Suggestion for Thursday" })).toBeNull();
      });
      // A pointer has no control after the card to go to, so it is the first control of the page.
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "History" }));
    });
  });

  describe("when the connection goes with the detail open", () => {
    it("should keep the detail open with Add off and say why, and write nothing when it is pressed", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();

      act(() => {
        onlineManager.setOnline(false);
      });

      const add = within(panel).getByRole("button", { name: "Add to Thursday" });
      await waitFor(() => {
        expect(isDisabled(add)).toBe(true);
      });
      const line = within(panel).getByText(SUGGESTION_DETAIL.offline);
      expect(add.getAttribute("aria-describedby")).toBe(line.closest("[id]")?.id);
      fireEvent.click(add);
      expect(suggestionBackend.inserted).toHaveLength(0);
      expect(screen.getByRole("dialog", { name: "Suggested for Thursday" })).toBeTruthy();
    });

    it("should take the line away and turn Add back on when the connection returns", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();
      act(() => {
        onlineManager.setOnline(false);
      });
      await within(panel).findByText(SUGGESTION_DETAIL.offline);

      act(() => {
        onlineManager.setOnline(true);
      });

      await waitFor(() => {
        expect(within(panel).queryByText(SUGGESTION_DETAIL.offline)).toBeNull();
      });
      const add = within(panel).getByRole("button", { name: "Add to Thursday" });
      expect(isDisabled(add)).toBe(false);
      expect(add.hasAttribute("aria-describedby")).toBe(false);
    });

    it("should keep Not now on, since it only writes this browser, and leave focus on a control when it is pressed", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();
      act(() => {
        onlineManager.setOnline(false);
      });
      const notNow = within(panel).getByRole("button", {
        name: "Not now for Thursday's suggestion",
      });
      await within(panel).findByText(SUGGESTION_DETAIL.offline);
      expect(isDisabled(notNow)).toBe(false);

      await userEvent.click(notNow);

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(window.localStorage.getItem(SUGGESTION_DISMISSED_KEY)).toContain("2026-10-15");
      // The card is hidden offline, so the opener is gone and focus goes to the first control of the page.
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "History" }));
    });

    it("should let it close, leave focus on a control, and show the offer again when the connection returns", async () => {
      renderRoute();
      const panel = await openWednesdayDetail();
      act(() => {
        onlineManager.setOnline(false);
      });
      await within(panel).findByText(SUGGESTION_DETAIL.offline);

      await userEvent.click(within(panel).getByRole("button", { name: "Back to Train" }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(screen.getByRole("link", { name: "History" }));
      act(() => {
        onlineManager.setOnline(true);
      });

      expect(await screen.findByRole("button", { name: "Add to Thursday" })).toHaveProperty(
        "disabled",
        false,
      );
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("when the day moves on with the detail open", () => {
    it("should close it, and not open it again on the offer for the new day", async () => {
      vi.useRealTimers();
      // The page's clock ticks once a minute with an interval, which is faked here to move it on.
      vi.useFakeTimers({ toFake: ["Date", "setInterval", "clearInterval"] });
      vi.setSystemTime(WEDNESDAY_1200);
      renderRoute();
      await openWednesdayDetail();

      vi.setSystemTime(FRIDAY_1200);
      act(() => {
        vi.advanceTimersByTime(60_000);
      });

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      });
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});

describe("Start on a suggestion for today, on Thursday before Legs", () => {
  beforeEach(() => {
    resetTrainBackend();
    installGoldenSuggestionBackend();
    // Thursday's session is the one still to come.
    trainBackend.weekSessions = trainBackend.weekSessions.filter(
      (session) => session["local_date"] !== "2026-10-15",
    );
    router.push.mockReset();
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(THURSDAY_1755);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const startOnCard = async () => {
    const card = await screen.findByRole("region", { name: "Suggestion for today" });
    return within(card).getByRole("button", { name: "Start Legs with the added exercise" });
  };

  it("should draw Start on the card in place of Add", async () => {
    renderRoute();

    const start = await startOnCard();

    expect(start.textContent).toBe("Start");
    expect(screen.queryByRole("button", { name: /^Add to/ })).toBeNull();
  });

  it("should store the suggestion and then start the planned Legs, with no Added toast", async () => {
    renderRoute();

    await userEvent.click(await startOnCard());

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/train/session");
    });
    expect(suggestionBackend.inserted).toHaveLength(1);
    expect(suggestionBackend.inserted[0]).toMatchObject({
      local_date: "2026-10-15",
      routine_day_id: LEGS_DAY_ID,
    });
    expect(trainBackend.startedSessions).toHaveLength(1);
    expect(trainBackend.startedSessions[0]).toMatchObject({ routine_day_id: LEGS_DAY_ID });
    expect(screen.queryByText(/^Added to/)).toBeNull();
  });

  it("should make one session for a double press", async () => {
    renderRoute();
    const start = await startOnCard();

    fireEvent.click(start);
    fireEvent.click(start);

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/train/session");
    });
    expect(suggestionBackend.inserted).toHaveLength(1);
    expect(trainBackend.startedSessions).toHaveLength(1);
  });

  it("should start nothing, say it was not saved and keep the offer when the store fails", async () => {
    suggestionBackend.failingWrites = true;
    renderRoute();

    await userEvent.click(await startOnCard());

    expect(await screen.findByText(SUGGESTION_FAILED.acceptFailed)).toBeTruthy();
    expect(router.push).not.toHaveBeenCalled();
    expect(trainBackend.startedSessions).toHaveLength(0);
    expect(await startOnCard()).toBeTruthy();
  });

  it("should leave the accepted card with its own Start when the store works and the start fails", async () => {
    renderRoute();
    const start = await startOnCard();
    trainBackend.failingWrites = true;

    await userEvent.click(start);

    const acceptedStart = await screen.findByRole("button", {
      name: "Start Legs with the added exercise",
    });
    trainBackend.failingWrites = false;

    await userEvent.click(acceptedStart);

    await waitFor(() => {
      expect(router.push).toHaveBeenCalledWith("/train/session");
    });
    expect(suggestionBackend.inserted).toHaveLength(1);
    expect(trainBackend.startedSessions).toHaveLength(1);
  });

  describe("from the detail", () => {
    it("should draw Start in place of Add, and starting closes it and opens the session", async () => {
      renderRoute();
      const panel = await openTodayDetail();

      await userEvent.click(
        within(panel).getByRole("button", { name: "Start Legs with the added exercise" }),
      );

      await waitFor(() => {
        expect(router.push).toHaveBeenCalledWith("/train/session");
      });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(within(panel).queryByRole("button", { name: /^Add to/ })).toBeNull();
      expect(suggestionBackend.inserted).toHaveLength(1);
      expect(trainBackend.startedSessions).toHaveLength(1);
    });

    it("should turn Start off with the connection, and start nothing when it is pressed", async () => {
      renderRoute();
      const panel = await openTodayDetail();

      act(() => {
        onlineManager.setOnline(false);
      });

      const start = within(panel).getByRole("button", {
        name: "Start Legs with the added exercise",
      });
      await waitFor(() => {
        expect(isDisabled(start)).toBe(true);
      });
      fireEvent.click(start);
      expect(suggestionBackend.inserted).toHaveLength(0);
      expect(router.push).not.toHaveBeenCalled();
      expect(within(panel).getByText(SUGGESTION_DETAIL.offline)).toBeTruthy();
      act(() => {
        onlineManager.setOnline(true);
      });
    });

    it("should show Start busy and off while a session start is under way", async () => {
      renderRoute();
      const panel = await openTodayDetail();
      // The start never answers, so the page's start stays under way. Today's own Start begins it.
      const answerRest = trainBackend.extraRoute;
      trainBackend.extraRoute = (request, url) =>
        url.pathname.endsWith("/workout_sessions") && request.method === "POST"
          ? new Promise<Response>(() => undefined)
          : (answerRest?.(request, url) ?? null);
      fireEvent.click(screen.getByRole("button", { name: "Start Legs" }));

      const start = within(panel).getByRole("button", {
        name: "Start Legs with the added exercise",
      });

      await waitFor(() => {
        expect(start.getAttribute("aria-busy")).toBe("true");
      });
      expect(isDisabled(start)).toBe(true);
    });
  });
});
