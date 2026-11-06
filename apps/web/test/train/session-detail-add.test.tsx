import {
  ADD_EXERCISE,
  CUSTOM_EXERCISE,
  HISTORY_DELETE_SESSION,
  SET_ENTRY,
  describeCreateExerciseRow,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PULL_SESSION_ID,
  detailBackend,
  goldenPullSession,
  renderWithDetail,
  resetDetailBackend,
} from "./sessionDetailBackend";

import { SessionDetailScreen } from "@/components/train/SessionDetailScreen";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const SIDE_LATERAL_RAISE_ID = "0000000e-0000-4000-8000-000000000001";
const sideLateralRaise = {
  id: SIDE_LATERAL_RAISE_ID,
  name: "Side lateral raise",
  equipment: "dumbbell",
  mechanic: "isolation",
  source: "free_exercise_db",
  exercise_muscles: [{ muscle_id: "delt_side", role: "primary", weight: 1 }],
};
const PULLDOWN_ID = "00000001-0000-4000-8000-000000000003";
const widegripLatPulldown = {
  id: PULLDOWN_ID,
  name: "Wide-grip lat pulldown",
  equipment: "cable",
  mechanic: "compound",
  source: "free_exercise_db",
  exercise_muscles: [{ muscle_id: "lats", role: "primary", weight: 1 }],
};

/** One working set of side lateral raise from the session before, as the last-time read returns it. */
const lastTimeSet = {
  id: "0000000c-0000-4000-8000-000000000001",
  session_id: "0000000d-0000-4000-8000-000000000001",
  exercise_id: SIDE_LATERAL_RAISE_ID,
  position: 0,
  set_type: "working",
  reps: 15,
  load_kg: 8,
  rir: 2,
  rpe: null,
  performed_at: "2026-10-06T18:10:00+01:00",
  deleted_at: null,
  workout_sessions: { local_date: "2026-10-06" },
};

// The golden Pull's last set is at 18:19 in London (17:19 UTC), so an added set follows it by a second.
const AFTER_THE_LAST_SET = "2026-10-13T17:19:01.000Z";
const LAST_SET_AND_END = "2026-10-13T17:19:00.000Z";

const renderDetail = () =>
  renderWithDetail(<SessionDetailScreen id={PULL_SESSION_ID} origin="history" />);

const card = (name: string) => screen.findByRole("region", { name });

const addSetOf = async (name: string) =>
  within(await card(name)).getByRole("button", { name: "Add set" });

const setOnline = (isOnline: boolean) => {
  act(() => {
    onlineManager.setOnline(isOnline);
  });
};

const inserts = () => detailBackend.writes.filter((write) => write.method === "POST");

/** Opens the entry for the next lat pulldown set, which the golden Pull holds five of. */
async function openAddPulldownSet() {
  await userEvent.click(await addSetOf("Wide-grip lat pulldown"));
  return screen.findByRole("dialog", { name: "Wide-grip lat pulldown" });
}

const logSet = (dialog: HTMLElement) =>
  within(dialog).getByRole("button", { name: SET_ENTRY.logSetAction });

describe("the session detail, adding to a past session", () => {
  beforeEach(() => {
    resetDetailBackend();
    detailBackend.sessions = [goldenPullSession()];
    detailBackend.exercises = [sideLateralRaise, widegripLatPulldown];
    router.push.mockReset();
    router.replace.mockReset();
  });

  afterEach(() => {
    cleanup();
    setOnline(true);
  });

  describe("the controls", () => {
    it("should offer Add set under each of the five exercises and Add exercise once", async () => {
      renderDetail();

      await card("Pullups");
      expect(screen.getAllByRole("button", { name: "Add set" })).toHaveLength(5);
      expect(screen.getAllByRole("button", { name: ADD_EXERCISE.title })).toHaveLength(1);
    });

    it("should turn both off offline, with the page's line that says why", async () => {
      renderDetail();
      await card("Pullups");

      setOnline(false);

      const line = await screen.findByText(HISTORY_DELETE_SESSION.offline);
      const add = await addSetOf("Pullups");
      expect(add).toHaveProperty("disabled", true);
      const lineId = add.getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(lineId)?.contains(line)).toBe(true);
      const addExercise = screen.getByRole("button", { name: ADD_EXERCISE.title });
      expect(addExercise).toHaveProperty("disabled", true);
      expect(addExercise.getAttribute("aria-describedby")).toBe(lineId);
    });
  });

  describe("Add set", () => {
    it("should open the entry for the next set, filled from the last set of that exercise in the session", async () => {
      renderDetail();

      const dialog = await openAddPulldownSet();

      expect(within(dialog).getByText("Set 6")).toBeTruthy();
      expect(within(dialog).getByRole("textbox", { name: "Load, kg" })).toHaveProperty(
        "value",
        "60",
      );
      expect(within(dialog).getByRole("textbox", { name: "Reps" })).toHaveProperty("value", "9");
      expect(within(dialog).getByRole("radio", { name: "1" }).getAttribute("aria-checked")).toBe(
        "true",
      );
      expect(
        within(dialog).getByText("Filled from your last set: 60 kg × 9 at RIR 1."),
      ).toBeTruthy();
      expect(document.activeElement).toBe(within(dialog).getByRole("textbox", { name: "Reps" }));
    });

    it("should put the filled-from line above the RIR chips, as the phone does", async () => {
      renderDetail();

      const dialog = await openAddPulldownSet();

      const line = within(dialog).getByText(/^Filled from your last set/);
      const chips = within(dialog).getByRole("radiogroup", { name: SET_ENTRY.rirHeading });
      expect(line.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should store the set after the last set of the session, add it to the detail and give focus back to Add set", async () => {
      renderDetail();
      const dialog = await openAddPulldownSet();

      await userEvent.click(logSet(dialog));

      const added = await within(await card("Wide-grip lat pulldown")).findByRole("button", {
        name: "Set 6, 60 kg by 9, RIR 1, edit",
      });
      expect(added).toBeTruthy();
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(inserts()).toHaveLength(1);
      expect(inserts()[0]?.body).toMatchObject({
        session_id: PULL_SESSION_ID,
        exercise_id: PULLDOWN_ID,
        set_type: "working",
        load_kg: 60,
        reps: 9,
        rir: 1,
        performed_at: AFTER_THE_LAST_SET,
      });
      expect(document.activeElement).toBe(await addSetOf("Wide-grip lat pulldown"));
    });

    it("should stamp the set at the end of the session when the session ended with its last set", async () => {
      detailBackend.sessions = [goldenPullSession({ ended_at: "2026-10-13T18:19:00+01:00" })];
      renderDetail();
      const dialog = await openAddPulldownSet();

      await userEvent.click(logSet(dialog));

      await waitFor(() => {
        expect(inserts()).toHaveLength(1);
      });
      expect(inserts()[0]?.body["performed_at"]).toBe(LAST_SET_AND_END);
    });

    it("should store what was typed, in kilograms for someone who trains in pounds", async () => {
      detailBackend.weightUnit = "lb";
      renderDetail();
      const dialog = await openAddPulldownSet();
      const load = within(dialog).getByRole("textbox", { name: "Load, lb" });
      expect(load).toHaveProperty("value", "132.3");

      await userEvent.clear(load);
      await userEvent.type(load, "135");
      await userEvent.click(logSet(dialog));

      await waitFor(() => {
        expect(inserts()).toHaveLength(1);
      });
      expect(inserts()[0]?.body["load_kg"]).toBe(61.235);
    });

    it("should store a load left as it was filled exactly, not as the pounds it was shown in", async () => {
      detailBackend.weightUnit = "lb";
      renderDetail();
      const dialog = await openAddPulldownSet();

      await userEvent.click(logSet(dialog));

      await waitFor(() => {
        expect(inserts()).toHaveLength(1);
      });
      expect(inserts()[0]?.body["load_kg"]).toBe(60);
    });

    it("should keep Log set off while the reps break a rule, and say which", async () => {
      renderDetail();
      const dialog = await openAddPulldownSet();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });

      await userEvent.clear(reps);
      await userEvent.type(reps, "0");

      expect(within(dialog).getByRole("alert").textContent).toBe("Enter whole reps from 1 to 100.");
      expect(logSet(dialog)).toHaveProperty("disabled", true);
    });

    it("should close on Escape, write nothing and give focus back to Add set", async () => {
      renderDetail();
      await openAddPulldownSet();

      await userEvent.keyboard("{Escape}");

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(detailBackend.writes).toEqual([]);
      expect(document.activeElement).toBe(await addSetOf("Wide-grip lat pulldown"));
    });

    it("should keep the dialog and its numbers when the write fails, say so without a value, and log at the next try", async () => {
      renderDetail();
      const dialog = await openAddPulldownSet();
      const reps = within(dialog).getByRole("textbox", { name: "Reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "12");
      detailBackend.failingWrites = true;

      await userEvent.click(logSet(dialog));

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(screen.getByRole("dialog", { name: "Wide-grip lat pulldown" })).toBeTruthy();
      expect(reps).toHaveProperty("value", "12");
      expect(document.body.textContent).not.toContain("raw database text");

      detailBackend.failingWrites = false;
      await userEvent.click(logSet(dialog));

      expect(
        await within(await card("Wide-grip lat pulldown")).findByRole("button", {
          name: "Set 6, 60 kg by 12, RIR 1, edit",
        }),
      ).toBeTruthy();
    });

    it("should refuse a full session with its own sentence", async () => {
      detailBackend.liveSetCount = 200;
      renderDetail();
      const dialog = await openAddPulldownSet();

      await userEvent.click(logSet(dialog));

      expect(await screen.findByText(SET_ENTRY.sessionFull)).toBeTruthy();
      expect(screen.getByRole("dialog", { name: "Wide-grip lat pulldown" })).toBeTruthy();
      expect(inserts()).toHaveLength(0);
    });

    it("should add one set when the form is submitted twice before the first is answered", async () => {
      renderDetail();
      const dialog = await openAddPulldownSet();
      let release: () => void = () => undefined;
      detailBackend.writeGate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const form = within(dialog).getByRole("form", { name: "Wide-grip lat pulldown, set 6" });

      fireEvent.submit(form);
      fireEvent.submit(form);
      await waitFor(() => {
        expect(inserts()).toHaveLength(1);
      });
      release();

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).toBeNull();
      });
      expect(inserts()).toHaveLength(1);
    });

    it("should turn Log set off with a line that says why when the connection goes, and write nothing", async () => {
      renderDetail();
      const dialog = await openAddPulldownSet();

      setOnline(false);

      const line = await within(dialog).findByText(SET_ENTRY.offline);
      expect(logSet(dialog)).toHaveProperty("disabled", true);
      const lineId = logSet(dialog).getAttribute("aria-describedby") ?? "";
      expect(document.getElementById(lineId)?.contains(line)).toBe(true);
      fireEvent.submit(within(dialog).getByRole("form", { name: "Wide-grip lat pulldown, set 6" }));
      await act(() => Promise.resolve());
      expect(screen.queryByText(SET_ENTRY.saveFailed)).toBeNull();
      expect(detailBackend.writes).toEqual([]);
      expect(screen.getByRole("dialog", { name: "Wide-grip lat pulldown" })).toBeTruthy();
    });
  });

  describe("Add exercise", () => {
    async function pickSideLateralRaise() {
      await userEvent.click(screen.getByRole("button", { name: ADD_EXERCISE.title }));
      const picker = await screen.findByRole("dialog", { name: ADD_EXERCISE.title });
      await userEvent.type(
        within(picker).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lateral",
      );
      await userEvent.click(
        await within(picker).findByRole("button", { name: /^Add Side lateral raise/ }),
      );
      return screen.findByRole("dialog", { name: "Side lateral raise" });
    }

    it("should open the entry for the first set filled from the last time it was done", async () => {
      detailBackend.lastTime = [lastTimeSet];
      renderDetail();
      await card("Pullups");

      const dialog = await pickSideLateralRaise();

      expect(within(dialog).getByText("Set 1")).toBeTruthy();
      expect(within(dialog).getByRole("textbox", { name: "Load, kg" })).toHaveProperty(
        "value",
        "8",
      );
      expect(within(dialog).getByRole("textbox", { name: "Reps" })).toHaveProperty("value", "15");
      expect(within(dialog).getByText("Filled from last time: 8 kg × 15 at RIR 2.")).toBeTruthy();
    });

    it("should offer to create an exercise that is not found, in the form that adds it to this session", async () => {
      renderDetail();
      await card("Pullups");
      await userEvent.click(screen.getByRole("button", { name: ADD_EXERCISE.title }));
      const picker = await screen.findByRole("dialog", { name: ADD_EXERCISE.title });
      await userEvent.type(
        within(picker).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
        "lateral",
      );

      await userEvent.click(
        await within(picker).findByRole("button", {
          name: describeCreateExerciseRow("lateral").title,
        }),
      );

      expect(await screen.findByRole("dialog", { name: CUSTOM_EXERCISE.title })).toBeTruthy();
    });

    it("should open the entry blank when the last time cannot be read", async () => {
      detailBackend.lastTime = [lastTimeSet];
      detailBackend.failingLastTime = true;
      renderDetail();
      await card("Pullups");

      const dialog = await pickSideLateralRaise();

      expect(within(dialog).getByRole("textbox", { name: "Reps" })).toHaveProperty("value", "");
      expect(within(dialog).getByText(SET_ENTRY.noHistory)).toBeTruthy();
      expect(logSet(dialog)).toHaveProperty("disabled", true);
    });

    it("should log the first set inside the session, show the exercise and give focus back to Add exercise", async () => {
      detailBackend.lastTime = [lastTimeSet];
      renderDetail();
      await card("Pullups");
      const dialog = await pickSideLateralRaise();

      await userEvent.click(logSet(dialog));

      const added = await card("Side lateral raise");
      expect(
        within(added).getByRole("button", { name: "Set 1, 8 kg by 15, RIR 2, edit" }),
      ).toBeTruthy();
      expect(inserts()).toHaveLength(1);
      expect(inserts()[0]?.body).toMatchObject({
        exercise_id: SIDE_LATERAL_RAISE_ID,
        performed_at: AFTER_THE_LAST_SET,
      });
      expect(document.activeElement).toBe(screen.getByRole("button", { name: ADD_EXERCISE.title }));
    });
  });
});
