import { SET_ENTRY } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { exerciseIdOf, goldenLegsOpen, legsRoutine, previousThursday } from "./sessionGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { SessionScreen } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const renderSession = () =>
  renderWithTrain(
    <ToastProvider>
      <SessionScreen />
    </ToastProvider>,
  );

const card = (name: string) => screen.findByRole("region", { name });

const SET_2_MARK = "Set type, leg press set 2";
const SET_3_MARK = "Set type, leg press set 3";

/** The option of the open dialog, found as a person finds it: by its name and what it says it counts as. */
const typeOption = (name: RegExp) => screen.findByRole("radio", { name });

describe("the set types on the session page", () => {
  beforeEach(() => {
    resetTrainBackend();
    router.push.mockReset();
    router.replace.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T18:00:00Z"));
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
    trainBackend.lastPerformance = previousThursday;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("before a set is logged", () => {
    it("should log the next set as a warm-up that does not count toward the sets done", async () => {
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(within(legPress).getByRole("button", { name: SET_3_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(
        within(legPress).getByRole("button", { name: "Log warm-up set, 180 kilograms, 11 reps" }),
      ).toBeTruthy();
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log warm-up set, 180 kilograms, 11 reps" }),
      );

      expect(
        await within(legPress).findByRole("button", {
          name: "Warm-up set logged, 180 kilograms, 11 reps, RIR 1, undo",
        }),
      ).toBeTruthy();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeTruthy();
      await waitFor(() => {
        expect(trainBackend.insertedSets).toHaveLength(1);
      });
      expect(trainBackend.insertedSets[0]).toMatchObject({
        exercise_id: exerciseIdOf("legPress"),
        set_type: "warmup",
      });
    });

    it("should keep the type with the numbers typed in the row", async () => {
      renderSession();
      const legPress = await card("Leg press");
      const reps = within(legPress).getByRole("textbox", { name: "Leg press, set 3, reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "9");

      await userEvent.click(within(legPress).getByRole("button", { name: SET_3_MARK }));
      await userEvent.click(await typeOption(/^Drop\./));

      expect(
        within(legPress).getByRole<HTMLInputElement>("textbox", {
          name: /Leg press, drop set, reps/,
        }).value,
      ).toBe("9");
    });

    it("should write nothing while the type is only chosen", async () => {
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(within(legPress).getByRole("button", { name: SET_3_MARK }));
      await userEvent.click(await typeOption(/^Failure\./));

      expect(trainBackend.writes).toEqual([]);
    });

    it("should bring the next set back as a working set once a warm-up has been logged from it", async () => {
      renderSession();
      const legPress = await card("Leg press");
      await userEvent.click(within(legPress).getByRole("button", { name: SET_3_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log warm-up set, 180 kilograms, 11 reps" }),
      );

      expect(await within(legPress).findByRole("button", { name: SET_3_MARK })).toBeTruthy();
      expect(
        within(legPress).getByRole("button", { name: /^Log set 3, 180 kilograms, 11 reps/ }),
      ).toBeTruthy();
    });
  });

  describe("a warm-up that is not stored", () => {
    const markNextAsWarmUpWithNineReps = async (legPress: HTMLElement) => {
      const reps = within(legPress).getByRole("textbox", { name: "Leg press, set 3, reps" });
      await userEvent.clear(reps);
      await userEvent.type(reps, "9");
      await userEvent.click(within(legPress).getByRole("button", { name: SET_3_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));
    };

    const expectRowKeptAsTyped = (legPress: HTMLElement) => {
      expect(
        within(legPress).getByRole<HTMLInputElement>("textbox", {
          name: "Leg press, warm-up set, reps",
        }).value,
      ).toBe("9");
      expect(
        within(legPress).getByRole("button", { name: "Log warm-up set, 180 kilograms, 9 reps" }),
      ).toBeTruthy();
    };

    it("should keep the type and what was typed when there is no connection", async () => {
      renderSession();
      const legPress = await card("Leg press");
      await markNextAsWarmUpWithNineReps(legPress);
      act(() => {
        onlineManager.setOnline(false);
      });

      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log warm-up set, 180 kilograms, 9 reps" }),
      );

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(trainBackend.writes).toEqual([]);
      expectRowKeptAsTyped(legPress);
    });

    it("should keep the type and what was typed when the write fails", async () => {
      trainBackend.failingWrites = true;
      renderSession();
      const legPress = await card("Leg press");
      await markNextAsWarmUpWithNineReps(legPress);

      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log warm-up set, 180 kilograms, 9 reps" }),
      );

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expectRowKeptAsTyped(legPress);
    });
  });

  describe("the number on the Working option", () => {
    const workingTile = async () => (await typeOption(/^Working\./)).textContent;

    it("should read 1 for the second warm-up of the squat, before any working set", async () => {
      renderSession();
      const squat = await card("Barbell squat");

      const [, secondWarmUp] = within(squat).getAllByRole("button", {
        name: "Set type, barbell squat warm-up set",
      });
      if (secondWarmUp === undefined) {
        throw new Error("The golden squat has two warm-ups");
      }
      await userEvent.click(secondWarmUp);

      expect(await workingTile()).toMatch(/^1Working/);
    });

    it("should read the number of the row for a row marked as a warm-up before it is logged", async () => {
      renderSession();
      const legPress = await card("Leg press");
      await userEvent.click(within(legPress).getByRole("button", { name: SET_3_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));

      await userEvent.click(
        within(legPress).getByRole("button", { name: "Set type, leg press warm-up set" }),
      );

      expect(await workingTile()).toMatch(/^3Working/);
    });

    it("should read the number the added row would have, not 0, once it is marked as a warm-up", async () => {
      renderSession();
      const legPress = await card("Leg press");
      await userEvent.click(within(legPress).getByRole("button", { name: "Add set" }));
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Set type, leg press set 4" }),
      );
      await userEvent.click(await typeOption(/^Warm-up\./));

      await userEvent.click(
        within(legPress).getByRole("button", { name: "Set type, leg press warm-up set" }),
      );

      expect(await workingTile()).toMatch(/^4Working/);
    });
  });

  describe("after a set is logged", () => {
    it("should change a logged working set to a warm-up that stops counting at once", async () => {
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(within(legPress).getByRole("button", { name: SET_2_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));

      await waitFor(() => {
        expect(screen.getByText("30:00 · 7 of 16 sets")).toBeTruthy();
      });
      expect(trainBackend.updatedSets).toEqual([{ set_type: "warmup" }]);
      expect(
        within(legPress).getByRole("button", {
          name: "Warm-up set logged, 180 kilograms, 11 reps, RIR 1, undo",
        }),
      ).toBeTruthy();
    });

    it("should write nothing when the type chosen is the one the set has", async () => {
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(within(legPress).getByRole("button", { name: SET_2_MARK }));
      await userEvent.click(await typeOption(/^Working\./));

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(trainBackend.writes).toEqual([]);
    });

    it("should keep the old type and say the set did not save when the write fails", async () => {
      trainBackend.failingWrites = true;
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(within(legPress).getByRole("button", { name: SET_2_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(screen.getByText("30:00 · 8 of 16 sets")).toBeTruthy();
      expect(
        within(legPress).getByRole("button", {
          name: "Set 2 logged, 180 kilograms, 11 reps, RIR 1, undo",
        }),
      ).toBeTruthy();
    });

    it("should write nothing and say so when there is no connection", async () => {
      renderSession();
      const legPress = await card("Leg press");
      act(() => {
        onlineManager.setOnline(false);
      });

      await userEvent.click(within(legPress).getByRole("button", { name: SET_2_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));

      expect(await screen.findByText(SET_ENTRY.saveFailed)).toBeTruthy();
      expect(trainBackend.writes).toEqual([]);
    });

    it("should leave the mark inert while the change is on its way", async () => {
      let open: () => void = () => undefined;
      trainBackend.updateGate = new Promise<void>((resolve) => {
        open = resolve;
      });
      renderSession();
      const legPress = await card("Leg press");
      await userEvent.click(within(legPress).getByRole("button", { name: SET_2_MARK }));
      await userEvent.click(await typeOption(/^Warm-up\./));

      const mark = await within(legPress).findByRole("button", { name: SET_2_MARK });
      await waitFor(() => {
        expect(mark.getAttribute("aria-disabled")).toBe("true");
      });
      await userEvent.click(mark);
      expect(screen.queryByRole("dialog")).toBeNull();

      open();
      await waitFor(() => {
        expect(mark.getAttribute("aria-disabled")).toBeNull();
      });
    });

    it("should leave the mark of a set that is still being saved inert", async () => {
      trainBackend.hangingSetWrites = true;
      renderSession();
      const legPress = await card("Leg press");
      await userEvent.click(
        within(legPress).getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      );

      const mark = await within(legPress).findByRole("button", { name: SET_3_MARK });
      expect(mark.getAttribute("aria-disabled")).toBe("true");
      await userEvent.click(mark);
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  describe("the dialog", () => {
    it("should name the set and the four types, with the current one checked", async () => {
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(within(legPress).getByRole("button", { name: SET_2_MARK }));

      const dialog = await screen.findByRole("dialog", { name: "Set type" });
      expect(
        within(dialog).getByText("Leg press · set 2 · tap the set number to change it"),
      ).toBeTruthy();
      const group = within(dialog).getByRole("radiogroup", { name: "Set type" });
      expect(
        within(group)
          .getAllByRole("radio")
          .map((radio) => [radio.getAttribute("aria-label"), radio.getAttribute("aria-checked")]),
      ).toEqual([
        ["Warm-up. Never counts toward heat or weekly sets.", "false"],
        ["Working. Counts by its effort. Left without RIR, it counts as hard.", "true"],
        ["Drop. A lighter set straight after. Counts like a working set.", "false"],
        ["Failure. Taken to failure. Counts like a working set.", "false"],
      ]);
    });

    it("should open from the keyboard on Enter and choose on Space, with focus back on the mark", async () => {
      renderSession();
      const legPress = await card("Leg press");
      const mark = within(legPress).getByRole("button", { name: SET_2_MARK });
      mark.focus();

      await userEvent.keyboard("{Enter}");
      const dialog = await screen.findByRole("dialog", { name: "Set type" });
      expect(document.activeElement).toBe(
        within(dialog).getByRole("radio", { name: /^Working\./ }),
      );
      await userEvent.tab();
      expect(document.activeElement).toBe(within(dialog).getByRole("radio", { name: /^Drop\./ }));
      await userEvent.keyboard(" ");

      await waitFor(() => {
        expect(trainBackend.updatedSets).toEqual([{ set_type: "drop" }]);
      });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(mark);
    });

    it("should keep Tab inside the dialog", async () => {
      renderSession();
      const legPress = await card("Leg press");
      await userEvent.click(within(legPress).getByRole("button", { name: SET_2_MARK }));
      const dialog = await screen.findByRole("dialog", { name: "Set type" });

      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });
      await userEvent.tab({ shift: true });

      expect(dialog.contains(document.activeElement)).toBe(true);
    });

    it("should close on Escape without writing, with focus back on the mark", async () => {
      renderSession();
      const legPress = await card("Leg press");
      const mark = within(legPress).getByRole("button", { name: SET_2_MARK });
      await userEvent.click(mark);
      await screen.findByRole("dialog", { name: "Set type" });

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(mark);
      expect(trainBackend.writes).toEqual([]);
    });
  });
});
