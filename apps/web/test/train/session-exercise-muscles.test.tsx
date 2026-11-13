import {
  ADD_EXERCISE,
  EXERCISE_MUSCLES,
  SESSION_ACTIVE,
  describeExerciseMusclesButton,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lateralRaiseResults } from "./addExerciseGolden";
import { freshLegsOpen, goldenLegsOpen, legsRoutine, previousThursday } from "./sessionGolden";
import { readsOf, renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { SessionScreen } from "@/components/train";
import { ToastProvider } from "@/components/ui/Toast";
import { resetBodyFigureForTests } from "@/lib/bodyFigure/testing";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const renderSession = () =>
  renderWithTrain(
    <ToastProvider>
      <SessionScreen />
    </ToastProvider>,
  );

const card = (name: string) => screen.findByRole("region", { name });

const musclesButton = (exercise: string) =>
  screen.findByRole("button", { name: describeExerciseMusclesButton(exercise) });

/** The dialog that opened, named for the exercise it shows. */
const musclesDialog = (exercise: string) => screen.findByRole("dialog", { name: exercise });

const figureOf = (dialog: HTMLElement, exercise: string, side: "front" | "back") =>
  within(dialog).getByRole("img", { name: `${exercise}, muscles it works, ${side}` });

/** Adds the first search result to the page as a new card, the way a person does from Add exercise. */
const addSideLateralRaise = async () => {
  await userEvent.click(screen.getByRole("button", { name: SESSION_ACTIVE.addExerciseAction }));
  const picker = screen.getByRole("dialog", { name: ADD_EXERCISE.title });
  await userEvent.type(
    within(picker).getByRole("searchbox", { name: ADD_EXERCISE.searchName }),
    "lateral raise",
  );
  await userEvent.click(
    await within(picker).findByRole("button", { name: "Add Side lateral raise" }),
  );
  await card("Side lateral raise");
};

describe("the Muscles it works dialog on the session page", () => {
  beforeEach(() => {
    resetTrainBackend();
    resetBodyFigureForTests();
    router.push.mockReset();
    router.replace.mockReset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-15T18:00:00Z"));
    trainBackend.routine = legsRoutine;
    trainBackend.lastPerformance = previousThursday;
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("for an exercise with sets saved in this session", () => {
    beforeEach(() => {
      trainBackend.activeSession = goldenLegsOpen(undefined, [], "legs");
    });

    it("should tell the muscles by role in words, one row for each role", async () => {
      renderSession();
      await userEvent.click(await musclesButton("Leg press"));

      const dialog = await musclesDialog("Leg press");
      const list = within(dialog).getByRole("list", { name: EXERCISE_MUSCLES.listLabel });
      expect(
        within(list)
          .getAllByRole("listitem")
          .map((row) => row.getAttribute("aria-label")),
      ).toEqual([
        "Quads, Primary · counts 1 set",
        "Glutes, Hamstrings, Secondary · counts half",
        "Calves, Assisting · counts a fifth",
      ]);
      expect(within(dialog).getByText(EXERCISE_MUSCLES.explanation)).toBeTruthy();
      expect(within(dialog).getByText(EXERCISE_MUSCLES.caption)).toBeTruthy();
    });

    it("should colour both figures by role", async () => {
      renderSession();
      await userEvent.click(await musclesButton("Leg press"));

      const dialog = await musclesDialog("Leg press");
      const front = figureOf(dialog, "Leg press", "front").innerHTML;
      const back = figureOf(dialog, "Leg press", "back").innerHTML;
      // The quads are on the front only, and the glutes, hamstrings and calves on the back only.
      expect(front.includes("fill-role-primary")).toBe(true);
      expect(front.includes("fill-role-secondary")).toBe(false);
      expect(front.includes("fill-role-assist")).toBe(false);
      expect(back.includes("fill-role-secondary")).toBe(true);
      expect(back.includes("fill-role-assist")).toBe(true);
      expect(back.includes("fill-role-primary")).toBe(false);
    });

    it("should draw the figures as plain images with no muscle to press", async () => {
      renderSession();
      await userEvent.click(await musclesButton("Leg press"));

      const dialog = await musclesDialog("Leg press");
      expect(within(dialog).getAllByRole("img")).toHaveLength(2);
      expect(within(dialog).queryByRole("group")).toBeNull();
      expect(within(dialog).queryByRole("button", { name: /Quads/ })).toBeNull();
    });

    it("should use the map saved with the sets and make no request for the exercise", async () => {
      renderSession();
      await userEvent.click(await musclesButton("Leg press"));
      await musclesDialog("Leg press");

      expect(readsOf("exercise")).toBe(0);
    });

    it("should open from the exercise name as well", async () => {
      renderSession();
      const legPress = await card("Leg press");

      await userEvent.click(within(legPress).getByRole("button", { name: "Leg press" }));

      expect(await musclesDialog("Leg press")).toBeTruthy();
    });

    it("should colour each role's swatch with its role token", async () => {
      renderSession();
      await userEvent.click(await musclesButton("Leg press"));

      const dialog = await musclesDialog("Leg press");
      const swatches = within(dialog)
        .getAllByRole("listitem")
        .map((row) => row.firstElementChild?.getAttribute("class") ?? "");
      expect(swatches[0]).toContain("bg-role-primary");
      expect(swatches[1]).toContain("bg-role-secondary");
      expect(swatches[2]).toContain("bg-role-assist");
    });

    it("should leave the name button out of the tab order, the icon button being the keyboard route", async () => {
      renderSession();
      const legPress = await card("Leg press");

      expect(within(legPress).getByRole("button", { name: "Leg press" }).tabIndex).toBe(-1);
      expect(
        within(legPress).getByRole("button", { name: describeExerciseMusclesButton("Leg press") })
          .tabIndex,
      ).toBe(0);
    });

    it("should keep the exercise name a heading", async () => {
      renderSession();
      const legPress = await card("Leg press");

      expect(within(legPress).getByRole("heading", { level: 2, name: "Leg press" })).toBeTruthy();
    });

    it("should close with Escape and give focus back to the button that opened it", async () => {
      renderSession();
      const opener = await musclesButton("Leg press");
      // A click that does not focus the button, as Safari's does not, so focus must be given back by the dialog.
      fireEvent.click(opener);
      await musclesDialog("Leg press");

      await userEvent.keyboard("{Escape}");

      expect(screen.queryByRole("dialog", { name: "Leg press" })).toBeNull();
      expect(document.activeElement).toBe(opener);
    });
  });

  describe("for an exercise of the plan with no set saved yet", () => {
    it("should show the active routine's map without reading the exercise", async () => {
      trainBackend.activeSession = freshLegsOpen("2026-10-15T18:30:00+01:00");
      renderSession();
      await userEvent.click(await musclesButton("Barbell squat"));

      const dialog = await musclesDialog("Barbell squat");
      expect(
        within(dialog).getByRole("listitem", { name: "Quads, Primary · counts 1 set" }),
      ).toBeTruthy();
      expect(readsOf("exercise")).toBe(0);
    });
  });

  describe("for an exercise added to this session with no set saved", () => {
    beforeEach(() => {
      trainBackend.activeSession = goldenLegsOpen();
      trainBackend.searchableExercises = lateralRaiseResults;
    });

    it("should read its map when the dialog opens, not before", async () => {
      renderSession();
      await card("Barbell squat");
      await addSideLateralRaise();
      expect(readsOf("exercise")).toBe(0);

      await userEvent.click(await musclesButton("Side lateral raise"));

      const dialog = await musclesDialog("Side lateral raise");
      expect(
        await within(dialog).findByRole("listitem", { name: "Side delts, Primary · counts 1 set" }),
      ).toBeTruthy();
      expect(readsOf("exercise")).toBe(1);
    });

    it("should show loading rows while the map is read", async () => {
      renderSession();
      await card("Barbell squat");
      await addSideLateralRaise();
      trainBackend.hangingReads.add("exercise");

      await userEvent.click(await musclesButton("Side lateral raise"));

      const dialog = await musclesDialog("Side lateral raise");
      expect(
        within(dialog).getByRole("status", { name: EXERCISE_MUSCLES.loadingName }),
      ).toBeTruthy();
      expect(within(dialog).queryByRole("list")).toBeNull();
    });

    it("should say the muscles are not available offline, with the figures at rest, and not load for ever", async () => {
      renderSession();
      await card("Barbell squat");
      await addSideLateralRaise();
      act(() => {
        onlineManager.setOnline(false);
      });

      await userEvent.click(await musclesButton("Side lateral raise"));

      const dialog = await musclesDialog("Side lateral raise");
      expect(await within(dialog).findByText(EXERCISE_MUSCLES.offline)).toBeTruthy();
      expect(
        within(dialog).queryByRole("status", { name: EXERCISE_MUSCLES.loadingName }),
      ).toBeNull();
      expect(within(dialog).queryByRole("list")).toBeNull();
      for (const side of ["front", "back"] as const) {
        const figure = figureOf(dialog, "Side lateral raise", side).innerHTML;
        expect(figure.includes("fill-heat-0")).toBe(true);
        expect(figure.includes("fill-role-")).toBe(false);
      }
    });

    it("should say the muscles could not be loaded when the read fails", async () => {
      renderSession();
      await card("Barbell squat");
      await addSideLateralRaise();
      trainBackend.failingReads.add("exercise");

      await userEvent.click(await musclesButton("Side lateral raise"));

      const dialog = await musclesDialog("Side lateral raise");
      await waitFor(() => {
        expect(within(dialog).getByText(EXERCISE_MUSCLES.failed)).toBeTruthy();
      });
      expect(within(dialog).queryByRole("list")).toBeNull();
    });
  });
});
