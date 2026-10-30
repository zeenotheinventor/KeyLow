import { ADD_EXERCISE, describeAddExerciseName } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { lateralRaiseResults } from "./addExerciseGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";

import { AddExerciseDialog } from "@/components/train/AddExerciseDialog";

const onAddToSession = vi.fn();
const onChoose = vi.fn();
const onClose = vi.fn();
const onCreate = vi.fn();

const renderSessionDialog = (extra: { onCreate?: typeof onCreate } = {}) =>
  renderWithTrain(
    <AddExerciseDialog
      open
      mode="session"
      onAddToSession={onAddToSession}
      onClose={onClose}
      {...extra}
    />,
  );

const searchBox = () =>
  screen.getByRole<HTMLInputElement>("searchbox", { name: ADD_EXERCISE.searchName });

const searchFor = async (words: string) => {
  await userEvent.type(searchBox(), words);
};

describe("the add exercise dialog", () => {
  beforeEach(() => {
    resetTrainBackend();
    trainBackend.searchableExercises = lateralRaiseResults;
    onAddToSession.mockReset();
    onChoose.mockReset();
    onClose.mockReset();
    onCreate.mockReset();
  });

  afterEach(() => {
    cleanup();
    act(() => {
      onlineManager.setOnline(true);
    });
  });

  describe("opening", () => {
    it("should be a dialog named Add exercise with the search field focused", () => {
      renderSessionDialog();

      expect(screen.getByRole("dialog", { name: ADD_EXERCISE.title })).toBeTruthy();
      expect(document.activeElement).toBe(searchBox());
    });

    it("should draw nothing at all while closed", () => {
      renderWithTrain(
        <AddExerciseDialog
          open={false}
          mode="session"
          onAddToSession={vi.fn()}
          onClose={vi.fn()}
        />,
      );

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should close on Escape", async () => {
      renderSessionDialog();

      await userEvent.keyboard("{Escape}");

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should close from its Close button", async () => {
      renderSessionDialog();

      await userEvent.click(screen.getByRole("button", { name: ADD_EXERCISE.closeName }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should start each time with an empty search", async () => {
      function Reopenable() {
        const [isOpen, setIsOpen] = useState(true);
        return (
          <>
            <button
              type="button"
              onClick={() => {
                setIsOpen(true);
              }}
            >
              Reopen
            </button>
            <AddExerciseDialog
              open={isOpen}
              mode="session"
              onAddToSession={vi.fn()}
              onClose={() => {
                setIsOpen(false);
              }}
            />
          </>
        );
      }
      renderWithTrain(<Reopenable />);
      await searchFor("lateral raise");
      expect(await screen.findByRole("region", { name: "Library · 4" })).toBeTruthy();
      await userEvent.keyboard("{Escape}");

      await userEvent.click(screen.getByRole("button", { name: "Reopen" }));

      expect(searchBox().value).toBe("");
      expect(screen.queryByRole("region", { name: "Library · 4" })).toBeNull();
    });
  });

  describe("searching", () => {
    it("should list nothing and ask nothing under two characters", async () => {
      renderSessionDialog();

      await searchFor("l");
      await new Promise((resolve) => setTimeout(resolve, 400));

      expect(trainBackend.searchedNames).toEqual([]);
      expect(screen.queryByRole("region")).toBeNull();
      expect(screen.queryByText(ADD_EXERCISE.noResults)).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });

    it("should ask the database for the words typed, trimmed, once typing has settled", async () => {
      renderSessionDialog();

      await searchFor("  lateral raise ");
      await screen.findByRole("region", { name: "Library · 4" });

      expect(trainBackend.searchedNames).toEqual(["lateral raise"]);
    });

    it("should show the loading skeleton, and no result or message, while the search is pending", async () => {
      trainBackend.hangingSearches = true;
      renderSessionDialog();

      await searchFor("lateral raise");

      expect(await screen.findByRole("status", { name: "Loading" })).toBeTruthy();
      await waitFor(() => {
        expect(trainBackend.searchedNames).toEqual(["lateral raise"]);
      });
      expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
      expect(screen.queryByRole("region")).toBeNull();
      expect(screen.queryByText(ADD_EXERCISE.noResults)).toBeNull();
      expect(screen.queryByText(ADD_EXERCISE.exerciseSearchFailed)).toBeNull();
    });

    it("should list the person's own exercise first, then the library, each under its count", async () => {
      renderSessionDialog();

      await searchFor("lateral raise");

      const yours = await screen.findByRole("region", { name: "Your exercises · 1" });
      const library = await screen.findByRole("region", { name: "Library · 4" });
      expect(within(yours).getAllByRole("listitem")).toHaveLength(1);
      expect(within(yours).getByText("Lean-away cable raise")).toBeTruthy();
      expect(within(yours).getByText("Custom")).toBeTruthy();
      expect(
        within(library)
          .getAllByRole("listitem")
          .map((row) => within(row).getAllByRole("button")[0]?.getAttribute("aria-label")),
      ).toEqual([
        describeAddExerciseName("Side lateral raise"),
        describeAddExerciseName("Cable lateral raise"),
        describeAddExerciseName("Upright barbell row"),
        describeAddExerciseName("Power partials"),
      ]);
      expect(
        yours.compareDocumentPosition(library) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });

    it("should leave out the group that has no exercise", async () => {
      trainBackend.searchableExercises = lateralRaiseResults.slice(1);
      renderSessionDialog();

      await searchFor("lateral raise");

      expect(await screen.findByRole("region", { name: "Library · 4" })).toBeTruthy();
      expect(screen.queryByRole("region", { name: /^Your exercises/ })).toBeNull();
    });

    it("should say so when no exercise matches", async () => {
      trainBackend.searchableExercises = [];
      renderSessionDialog();

      await searchFor("lateral raise");

      expect(await screen.findByText(ADD_EXERCISE.noResults)).toBeTruthy();
    });

    it("should say the search did not load, which is not the same as no match", async () => {
      trainBackend.failingSearches = true;
      renderSessionDialog();

      await searchFor("lateral raise");

      expect(await screen.findByText(ADD_EXERCISE.exerciseSearchFailed)).toBeTruthy();
      expect(screen.queryByText(ADD_EXERCISE.noResults)).toBeNull();
    });

    it("should say searching needs a connection while offline, and ask nothing", async () => {
      act(() => {
        onlineManager.setOnline(false);
      });
      renderSessionDialog();

      await searchFor("lateral raise");

      expect(screen.getByText(ADD_EXERCISE.exerciseSearchOffline)).toBeTruthy();
      expect(trainBackend.searchedNames).toEqual([]);
    });

    it("should empty the search from its Clear search button", async () => {
      renderSessionDialog();
      await searchFor("lateral raise");
      await screen.findByRole("region", { name: "Library · 4" });

      await userEvent.click(screen.getByRole("button", { name: ADD_EXERCISE.clearSearchName }));

      await waitFor(() => {
        expect(screen.queryByRole("region", { name: "Library · 4" })).toBeNull();
      });
      expect(searchBox().value).toBe("");
    });
  });

  describe("choosing", () => {
    it("should add to the session the exercise whose button was pressed, then close", async () => {
      renderSessionDialog();
      await searchFor("lateral raise");

      await userEvent.click(
        await screen.findByRole("button", { name: describeAddExerciseName("Side lateral raise") }),
      );

      expect(onAddToSession).toHaveBeenCalledTimes(1);
      expect(onAddToSession.mock.calls[0]?.[0]).toMatchObject({
        name: "Side lateral raise",
        equipment: "dumbbell",
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it("should add an exercise once when its button is pressed twice", async () => {
      renderSessionDialog();
      await searchFor("lateral raise");
      const add = await screen.findByRole("button", {
        name: describeAddExerciseName("Side lateral raise"),
      });

      await userEvent.dblClick(add);

      expect(onAddToSession).toHaveBeenCalledTimes(1);
    });

    it("should be reachable by keyboard: Tab from the search to a result, Enter to add it", async () => {
      renderSessionDialog();
      await searchFor("lateral raise");
      await screen.findByRole("button", { name: describeAddExerciseName("Side lateral raise") });

      await userEvent.tab();
      await userEvent.tab();
      expect(document.activeElement?.getAttribute("aria-label")).toBe(
        describeAddExerciseName("Lean-away cable raise"),
      );
      await userEvent.keyboard("{Enter}");

      expect(onAddToSession.mock.calls[0]?.[0]).toMatchObject({ name: "Lean-away cable raise" });
    });

    it("should hand the exercise back in routine mode and add nothing to a session", async () => {
      renderWithTrain(
        <AddExerciseDialog open mode="routine" onChoose={onChoose} onClose={onClose} />,
      );
      await searchFor("lateral raise");

      await userEvent.click(
        await screen.findByRole("button", { name: describeAddExerciseName("Cable lateral raise") }),
      );

      expect(onChoose).toHaveBeenCalledTimes(1);
      expect(onChoose.mock.calls[0]?.[0]).toMatchObject({ name: "Cable lateral raise" });
      expect(onAddToSession).not.toHaveBeenCalled();
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe("creating", () => {
    it("should draw no Create row when nothing can create the exercise", async () => {
      renderSessionDialog();

      await searchFor("lateral raise");
      await screen.findByRole("region", { name: "Library · 4" });

      expect(screen.queryByRole("button", { name: /^Create/ })).toBeNull();
    });

    it("should offer Create for the words searched for when a handler is given", async () => {
      renderSessionDialog({ onCreate });
      await searchFor("  lateral raise ");
      await screen.findByRole("region", { name: "Library · 4" });

      await userEvent.click(screen.getByRole("button", { name: 'Create "lateral raise"' }));

      expect(onCreate).toHaveBeenCalledWith("lateral raise");
    });

    it("should not offer Create before anything is searched", () => {
      renderSessionDialog({ onCreate });

      expect(screen.queryByRole("button", { name: /^Create/ })).toBeNull();
    });
  });
});
