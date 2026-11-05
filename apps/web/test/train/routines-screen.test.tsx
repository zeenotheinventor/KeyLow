import {
  GENERIC_ERROR,
  RETRY_LABEL,
  ROUTINES_ARCHIVED,
  ROUTINES_EMPTY,
  ROUTINES_SCREEN,
  TRAIN_LOADING_NAME,
  describeActiveRoutine,
  describeArchivedRoutinesLink,
  describeOtherRoutineMeta,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  PUSH_PULL_LEGS_ID,
  UPPER_LOWER_ID,
  fullBody,
  pushPullLegs,
  renderWithRoutines,
  resetRoutinesBackend,
  routinesBackend,
  startingStrength,
  upperLower,
} from "./routinesBackend";

import { ArchivedRoutinesScreen } from "@/components/train/ArchivedRoutinesScreen";
import { RoutinesScreen } from "@/components/train/RoutinesScreen";

const goldenLibrary = () => {
  routinesBackend.routines = [pushPullLegs, upperLower, fullBody, startingStrength];
};

const pushPullLegsCard = {
  name: "Push Pull Legs",
  days: [
    { name: "Push", weekday: 0 },
    { name: "Pull", weekday: 1 },
    { name: "Legs", weekday: 3 },
    { name: "Push", weekday: 5 },
  ],
  setsPerWeek: 63,
  activeFrom: "2026-09-21",
};

describe("the routines page", () => {
  beforeEach(() => {
    resetRoutinesBackend();
  });

  afterEach(cleanup);

  describe("with an active routine, another routine and an archived one", () => {
    beforeEach(goldenLibrary);

    it("should show the active routine as a card that reads the days, the sets and the date it plans from", async () => {
      renderWithRoutines(<RoutinesScreen />);

      const copy = describeActiveRoutine(pushPullLegsCard);
      const card = await screen.findByRole("region", { name: copy.readName });
      expect(within(card).getByRole("heading", { name: "Push Pull Legs" })).toBeTruthy();
      expect(within(card).getByText("Active")).toBeTruthy();
      expect(within(card).getByText("4 days · 63 sets a week · since Mon 21 Sep")).toBeTruthy();
    });

    it("should list the routines that are not active, each with its days, weekdays and sets", async () => {
      renderWithRoutines(<RoutinesScreen />);

      const others = await screen.findByRole("region", { name: ROUTINES_SCREEN.otherSectionName });
      const rows = within(others).getAllByRole("listitem");
      expect(rows).toHaveLength(2);
      expect(rows[0]?.textContent).toContain("Full body");
      expect(rows[0]?.textContent).toContain(
        describeOtherRoutineMeta({
          days: [
            { name: "A", weekday: 0 },
            { name: "B", weekday: 2 },
            { name: "C", weekday: 4 },
          ],
          setsPerWeek: 45,
        }),
      );
      expect(rows[1]?.textContent).toContain("Upper Lower");
      expect(rows[1]?.textContent).toContain("4 days · Mon, Tue, Thu, Fri · 60 sets a week");
    });

    it("should not list the archived routine among the others", async () => {
      renderWithRoutines(<RoutinesScreen />);

      await screen.findByRole("region", { name: ROUTINES_SCREEN.otherSectionName });
      expect(screen.queryByText("Starting strength")).toBeNull();
    });

    it("should link to the archived routines with how many there are", async () => {
      renderWithRoutines(<RoutinesScreen />);

      const link = await screen.findByRole("link", { name: describeArchivedRoutinesLink(1) });
      expect(link.getAttribute("href")).toBe("/train/routines/archived");
    });

    it("should link back to Train", async () => {
      renderWithRoutines(<RoutinesScreen />);

      const link = await screen.findByRole("link", { name: ROUTINES_SCREEN.backLabel });
      expect(link.getAttribute("href")).toBe("/train");
    });

    it("should draw no button, since no handler is given", async () => {
      renderWithRoutines(<RoutinesScreen />);

      await screen.findByRole("heading", { name: ROUTINES_SCREEN.title, level: 1 });
      await screen.findByRole("region", { name: ROUTINES_SCREEN.otherSectionName });
      expect(screen.queryAllByRole("button")).toEqual([]);
    });

    it("should make the cards open the editor, and draw New routine, when handlers are given", async () => {
      const onEditRoutine = vi.fn();
      const onCreateRoutine = vi.fn();
      renderWithRoutines(
        <RoutinesScreen onCreateRoutine={onCreateRoutine} onEditRoutine={onEditRoutine} />,
      );

      await userEvent.click(
        await screen.findByRole("button", {
          name: describeActiveRoutine(pushPullLegsCard).accessibleName,
        }),
      );
      expect(onEditRoutine).toHaveBeenLastCalledWith({
        id: PUSH_PULL_LEGS_ID,
        name: "Push Pull Legs",
      });

      await userEvent.click(screen.getByRole("button", { name: /^Upper Lower/ }));
      expect(onEditRoutine).toHaveBeenLastCalledWith({ id: UPPER_LOWER_ID, name: "Upper Lower" });

      await userEvent.click(screen.getByRole("button", { name: ROUTINES_SCREEN.newRoutineLabel }));
      expect(onCreateRoutine).toHaveBeenCalledTimes(1);
    });

    it("should read the date it plans from in the profile's time zone", async () => {
      routinesBackend.timeZone = "Pacific/Auckland";
      routinesBackend.routines = [
        { ...pushPullLegs, activated_at: "2026-09-20T20:00:00+00:00" },
        startingStrength,
      ];
      renderWithRoutines(<RoutinesScreen />);

      expect(await screen.findByText("4 days · 63 sets a week · since Mon 21 Sep")).toBeTruthy();
    });
  });

  describe("with no routine", () => {
    it("should show the empty state without a Create routine button when no handler is given", async () => {
      renderWithRoutines(<RoutinesScreen />);

      expect(await screen.findByRole("heading", { name: ROUTINES_EMPTY.title })).toBeTruthy();
      expect(screen.getByText(ROUTINES_EMPTY.body)).toBeTruthy();
      expect(screen.queryAllByRole("button")).toEqual([]);
    });

    it("should show Create routine, and no New routine beside the title, when a handler is given", async () => {
      const onCreateRoutine = vi.fn();
      renderWithRoutines(<RoutinesScreen onCreateRoutine={onCreateRoutine} />);

      await userEvent.click(await screen.findByRole("button", { name: ROUTINES_EMPTY.action }));
      expect(onCreateRoutine).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole("button", { name: ROUTINES_SCREEN.newRoutineLabel })).toBeNull();
    });

    it("should show only the archived link when every routine is archived", async () => {
      routinesBackend.routines = [startingStrength];
      renderWithRoutines(<RoutinesScreen />);

      expect(
        await screen.findByRole("link", { name: describeArchivedRoutinesLink(1) }),
      ).toBeTruthy();
      expect(screen.getByRole("heading", { name: ROUTINES_EMPTY.title })).toBeTruthy();
    });
  });

  it("should draw no archived link when nothing is archived", async () => {
    routinesBackend.routines = [pushPullLegs];
    renderWithRoutines(<RoutinesScreen />);

    await screen.findByRole("region", { name: /Push Pull Legs, active/ });
    expect(screen.queryByRole("link", { name: /^Archived/ })).toBeNull();
    expect(screen.queryByRole("region", { name: ROUTINES_SCREEN.otherSectionName })).toBeNull();
  });

  it("should read the archived routines with the live ones in one request", async () => {
    goldenLibrary();
    renderWithRoutines(<RoutinesScreen />);

    await screen.findByRole("region", { name: ROUTINES_SCREEN.otherSectionName });
    expect(routinesBackend.archivedAsked).toEqual([true]);
  });

  it("should show a loading status while the routines load", async () => {
    routinesBackend.hangingReads.add("routines");
    renderWithRoutines(<RoutinesScreen />);

    expect(await screen.findByRole("status", { name: TRAIN_LOADING_NAME })).toBeTruthy();
  });

  it("should show the error with Try again, and read again when it is pressed", async () => {
    goldenLibrary();
    routinesBackend.failingReads.add("routines");
    renderWithRoutines(<RoutinesScreen />);

    expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
    routinesBackend.failingReads.clear();
    await userEvent.click(screen.getByRole("button", { name: RETRY_LABEL }));

    expect(await screen.findByRole("region", { name: /Push Pull Legs, active/ })).toBeTruthy();
  });
});

describe("the routines pages without a connection", () => {
  beforeEach(() => {
    resetRoutinesBackend();
    goldenLibrary();
    onlineManager.setOnline(false);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  it("should say the routines could not be read, with no Try again, on a first visit to the list", () => {
    renderWithRoutines(<RoutinesScreen />);

    expect(screen.getByText(GENERIC_ERROR)).toBeTruthy();
    expect(screen.queryByRole("button", { name: RETRY_LABEL })).toBeNull();
    expect(screen.queryByRole("status", { name: TRAIN_LOADING_NAME })).toBeNull();
  });

  it("should say the routines could not be read, with no Try again, on a first visit to the archived list", () => {
    renderWithRoutines(<ArchivedRoutinesScreen />);

    expect(screen.getByText(GENERIC_ERROR)).toBeTruthy();
    expect(screen.queryByRole("button", { name: RETRY_LABEL })).toBeNull();
    expect(screen.queryByRole("status", { name: TRAIN_LOADING_NAME })).toBeNull();
  });
});

describe("the active routine's heading", () => {
  beforeEach(() => {
    resetRoutinesBackend();
    routinesBackend.routines = [pushPullLegs];
  });

  afterEach(cleanup);

  it("should not wrap the card's own region in a region of its own", async () => {
    renderWithRoutines(<RoutinesScreen />);

    await screen.findByRole("region", { name: /Push Pull Legs, active/ });
    expect(screen.getByRole("heading", { name: ROUTINES_SCREEN.activeLabel })).toBeTruthy();
    expect(screen.queryByRole("region", { name: ROUTINES_SCREEN.activeLabel })).toBeNull();
  });

  it("should not name a region Active around the card when the card is a button", async () => {
    renderWithRoutines(<RoutinesScreen onEditRoutine={vi.fn()} />);

    await screen.findByRole("button", { name: /Push Pull Legs/ });
    expect(screen.queryByRole("region", { name: ROUTINES_SCREEN.activeLabel })).toBeNull();
  });
});

describe("the archived routines page", () => {
  beforeEach(() => {
    resetRoutinesBackend();
    goldenLibrary();
  });

  afterEach(cleanup);

  it("should list the archived routines with their days and the note, and none of the live ones", async () => {
    renderWithRoutines(<ArchivedRoutinesScreen />);

    expect(
      await screen.findByRole("heading", { name: ROUTINES_ARCHIVED.title, level: 1 }),
    ).toBeTruthy();
    const rows = await screen.findAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]?.textContent).toContain("Starting strength");
    expect(rows[0]?.textContent).toContain("3 days");
    expect(screen.getByText(ROUTINES_ARCHIVED.note)).toBeTruthy();
    expect(screen.queryByText("Push Pull Legs")).toBeNull();
  });

  it("should link back to the routines, and draw no Restore without a handler", async () => {
    renderWithRoutines(<ArchivedRoutinesScreen />);

    const back = await screen.findByRole("link", { name: ROUTINES_ARCHIVED.backLabel });
    expect(back.getAttribute("href")).toBe("/train/routines");
    await screen.findAllByRole("listitem");
    expect(screen.queryAllByRole("button")).toEqual([]);
  });

  it("should show the error with Try again", async () => {
    routinesBackend.failingReads.add("routines");
    renderWithRoutines(<ArchivedRoutinesScreen />);

    expect(await screen.findByText(GENERIC_ERROR)).toBeTruthy();
    expect(screen.getByRole("button", { name: RETRY_LABEL })).toBeTruthy();
  });
});
