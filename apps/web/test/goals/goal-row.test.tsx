import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { goalsBackend, renderWithGoals, resetGoalsBackend, storedGoalRow } from "./support";

import type { QueryClient } from "@tanstack/react-query";

import { GoalRow } from "@/app/(dashboard)/more/GoalRow";

/** Waits until a read has ended in `status`, so a check that follows it is not made before the answer came. */
async function waitForARead(queryClient: QueryClient, status: "success" | "error") {
  await waitFor(() => {
    expect(
      queryClient
        .getQueryCache()
        .getAll()
        .some((query) => query.state.status === status),
    ).toBe(true);
  });
}

const withoutGoalSubtitle = "Tell Ki-Lo what you are training for";

beforeEach(() => {
  resetGoalsBackend();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the Goal row of More", () => {
  it("should open the questionnaire, as a link that goes somewhere", async () => {
    renderWithGoals(<GoalRow />);

    const link = await screen.findByRole("link", { name: /^Goal/ });

    expect(link.getAttribute("href")).toBe("/goal");
    expect(link.getAttribute("aria-disabled")).toBeNull();
  });

  it("should invite the person to say what they train for when there is no goal", async () => {
    renderWithGoals(<GoalRow />);

    expect(await screen.findByText(withoutGoalSubtitle)).toBeTruthy();
  });

  it("should say when the goal was set", async () => {
    goalsBackend.row = storedGoalRow;
    renderWithGoals(<GoalRow />);

    expect(await screen.findByText("Set on Mon 21 Sep")).toBeTruthy();
    expect(screen.queryByText(withoutGoalSubtitle)).toBeNull();
  });

  it("should date the goal in the profile's time zone", async () => {
    goalsBackend.row = { ...storedGoalRow, effective_from: "2026-09-21T23:30:00+00:00" };
    goalsBackend.timeZone = "Pacific/Auckland";
    renderWithGoals(<GoalRow />);

    expect(await screen.findByText("Set on Tue 22 Sep")).toBeTruthy();
  });

  it("should date the goal in UTC when the profile has no time zone", async () => {
    goalsBackend.row = { ...storedGoalRow, effective_from: "2026-09-21T23:30:00+00:00" };
    goalsBackend.timeZone = null;
    renderWithGoals(<GoalRow />);

    expect(await screen.findByText("Set on Mon 21 Sep")).toBeTruthy();
  });

  it("should say nothing under its title while the goal is being read", async () => {
    goalsBackend.status = "pending";
    renderWithGoals(<GoalRow />);

    await waitFor(() => {
      expect(goalsBackend.reads).toBe(1);
    });

    expect(screen.getByRole("link", { name: "Goal" })).toBeTruthy();
  });

  it("should say nothing under its title while the time zone the goal is dated in is being read", async () => {
    goalsBackend.row = storedGoalRow;
    goalsBackend.timeZoneStatus = "pending";
    const { queryClient } = renderWithGoals(<GoalRow />);

    await waitForARead(queryClient, "success");

    expect(screen.getByRole("link", { name: "Goal" })).toBeTruthy();
  });

  it("should say nothing under its title when the goal cannot be read, as it does not know there is none", async () => {
    goalsBackend.status = "error";
    const { queryClient } = renderWithGoals(<GoalRow />);

    await waitForARead(queryClient, "error");

    expect(screen.getByRole("link", { name: "Goal" })).toBeTruthy();
    expect(screen.queryByText(withoutGoalSubtitle)).toBeNull();
  });

  it("should still show and open when offline with nothing stored, with no skeleton waiting", () => {
    onlineManager.setOnline(false);
    renderWithGoals(<GoalRow />);

    const link = screen.getByRole("link", { name: "Goal" });

    expect(link.getAttribute("href")).toBe("/goal");
    expect(goalsBackend.reads).toBe(0);
    expect(screen.queryByRole("status")).toBeNull();
    expect(document.querySelector("[aria-busy='true']")).toBeNull();
  });
});
