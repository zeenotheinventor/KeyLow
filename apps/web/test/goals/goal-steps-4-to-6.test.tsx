import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { goalsBackend, renderGoalFlow, resetGoalsBackend, storedGoalRow } from "./support";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  notFound: () => {
    throw new Error("not found");
  },
}));

const isChecked = (element: HTMLElement) => element.getAttribute("aria-checked") === "true";
const nextButton = () =>
  screen.findByRole<HTMLButtonElement>("button", { name: /^(Next|See your priorities)$/ });
const rule = "Enter minutes from 15 to 180.";

beforeEach(() => {
  resetGoalsBackend();
  goalsBackend.row = storedGoalRow;
  router.push.mockReset();
  router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe("the minutes question", () => {
  it("should ask how long a session is, with five presets and Other, and open on Other for minutes that are no preset", async () => {
    renderGoalFlow(router, "/goal/4");

    expect(
      await screen.findByRole("heading", { level: 1, name: "How long is a session?" }),
    ).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "How long is a session?" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((chip) => chip.textContent),
    ).toEqual(["30 min", "45 min", "60 min", "75 min", "90 min", "Other"]);
    expect(isChecked(within(group).getByRole("radio", { name: "Other" }))).toBe(true);
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Other (min)" }).value).toBe("50");
    expect(screen.getByText("Other takes 15 to 180 minutes.")).toBeTruthy();
  });

  it("should choose a preset and take the field away", async () => {
    renderGoalFlow(router, "/goal/4");

    await userEvent.click(await screen.findByRole("radio", { name: "60 min" }));

    expect(isChecked(screen.getByRole("radio", { name: "60 min" }))).toBe(true);
    expect(isChecked(screen.getByRole("radio", { name: "Other" }))).toBe(false);
    expect(screen.queryByRole("textbox")).toBeNull();
    expect((await nextButton()).disabled).toBe(false);
  });

  it("should open Other with the field empty and Next off until minutes are given", async () => {
    renderGoalFlow(router, "/goal/4");
    await userEvent.click(await screen.findByRole("radio", { name: "60 min" }));

    await userEvent.click(screen.getByRole("radio", { name: "Other" }));

    const field = screen.getByRole<HTMLInputElement>("textbox", { name: "Other (min)" });
    expect(field.value).toBe("");
    expect((await nextButton()).disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should show the rule as soon as minutes out of range are typed, and keep Next off", async () => {
    renderGoalFlow(router, "/goal/4");
    const field = await screen.findByRole<HTMLInputElement>("textbox", { name: "Other (min)" });

    await userEvent.clear(field);
    await userEvent.type(field, "200");

    expect(screen.getByRole("alert").textContent).toBe(rule);
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect((await nextButton()).disabled).toBe(true);
  });

  it("should show the rule under 15 too, and take it away once the minutes are in range", async () => {
    renderGoalFlow(router, "/goal/4");
    const field = await screen.findByRole<HTMLInputElement>("textbox", { name: "Other (min)" });

    await userEvent.clear(field);
    await userEvent.type(field, "14");
    expect(screen.getByRole("alert").textContent).toBe(rule);

    await userEvent.type(field, "0");

    expect(field.value).toBe("140");
    expect(screen.queryByRole("alert")).toBeNull();
    expect((await nextButton()).disabled).toBe(false);
  });

  it("should keep only digits, so text is never an answer and shows no rule", async () => {
    renderGoalFlow(router, "/goal/4");
    const field = await screen.findByRole<HTMLInputElement>("textbox", { name: "Other (min)" });

    await userEvent.clear(field);
    await userEvent.type(field, "ab-.");

    expect(field.value).toBe("");
    expect(screen.queryByRole("alert")).toBeNull();
    expect((await nextButton()).disabled).toBe(true);
  });

  it("should keep the minutes typed for Other when the question is left and came back to", async () => {
    renderGoalFlow(router, "/goal/4");
    const field = await screen.findByRole<HTMLInputElement>("textbox", { name: "Other (min)" });
    await userEvent.clear(field);
    await userEvent.type(field, "120");

    await userEvent.click(await nextButton());
    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(
      (await screen.findByRole<HTMLInputElement>("textbox", { name: "Other (min)" })).value,
    ).toBe("120");
  });
});

describe("the equipment question", () => {
  it("should offer Full gym first and the ten kinds as chips that can each be chosen", async () => {
    renderGoalFlow(router, "/goal/5");

    expect(
      await screen.findByRole("heading", { level: 1, name: "What can you use?" }),
    ).toBeTruthy();
    const group = screen.getByRole("group", { name: "What can you use?" });
    expect(
      within(group)
        .getAllByRole("checkbox")
        .map((chip) => chip.textContent),
    ).toEqual([
      "Full gym",
      "Barbell",
      "Dumbbell",
      "Kettlebell",
      "Cable",
      "Machine",
      "Smith machine",
      "EZ bar",
      "Band",
      "Bodyweight",
      "Other",
    ]);
    expect(screen.getByText("Full gym picks everything but Other.")).toBeTruthy();
  });

  it("should fill the stored kinds, and not Full gym", async () => {
    renderGoalFlow(router, "/goal/5");

    await screen.findByRole("checkbox", { name: "Dumbbell" });

    expect(
      screen
        .getAllByRole("checkbox")
        .filter(isChecked)
        .map((chip) => chip.textContent),
    ).toEqual(["Dumbbell", "Cable", "Other"]);
  });

  it("should pick the nine kinds but Other when Full gym is pressed", async () => {
    renderGoalFlow(router, "/goal/5");

    await userEvent.click(await screen.findByRole("checkbox", { name: "Full gym" }));

    const chosen = screen.getAllByRole("checkbox").filter(isChecked);
    expect(chosen).toHaveLength(10);
    expect(chosen.map((chip) => chip.textContent)).toContain("Full gym");
    expect(isChecked(screen.getByRole("checkbox", { name: "Other" }))).toBe(false);
    expect(isChecked(screen.getByRole("checkbox", { name: "Bodyweight" }))).toBe(true);
  });

  it("should clear every kind when Full gym is pressed again", async () => {
    renderGoalFlow(router, "/goal/5");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Full gym" }));

    await userEvent.click(screen.getByRole("checkbox", { name: "Full gym" }));

    expect(screen.getAllByRole("checkbox").filter(isChecked)).toEqual([]);
    expect((await nextButton()).disabled).toBe(true);
  });

  it("should take Full gym off when one of the nine is cleared, keeping the other eight", async () => {
    renderGoalFlow(router, "/goal/5");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Full gym" }));

    await userEvent.click(screen.getByRole("checkbox", { name: "Band" }));

    expect(isChecked(screen.getByRole("checkbox", { name: "Full gym" }))).toBe(false);
    expect(screen.getAllByRole("checkbox").filter(isChecked)).toHaveLength(8);
  });

  it("should draw Full gym as chosen when the nine are chosen one by one", async () => {
    renderGoalFlow(router, "/goal/5");
    await userEvent.click(await screen.findByRole("checkbox", { name: "Full gym" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "Band" }));

    await userEvent.click(screen.getByRole("checkbox", { name: "Band" }));

    expect(isChecked(screen.getByRole("checkbox", { name: "Full gym" }))).toBe(true);
  });

  it("should keep Next off until a kind is chosen", async () => {
    renderGoalFlow(router, "/goal/5");
    const next = await nextButton();
    expect(next.disabled).toBe(false);

    for (const name of ["Dumbbell", "Cable", "Other"]) {
      await userEvent.click(screen.getByRole("checkbox", { name }));
    }

    expect(next.disabled).toBe(true);
  });
});

describe("the experience question", () => {
  it("should ask how long the person has trained, with its help line, and fill the stored level", async () => {
    renderGoalFlow(router, "/goal/6");

    expect(
      await screen.findByRole("heading", { level: 1, name: "How long have you trained?" }),
    ).toBeTruthy();
    expect(
      screen.getByText("This sets how many sets Ki-Lo suggests for each exercise it adds."),
    ).toBeTruthy();
    expect(isChecked(screen.getByRole("radio", { name: /^Advanced/ }))).toBe(true);
    expect(screen.getAllByRole("radio").map((card) => card.textContent)).toEqual([
      "BeginnerUnder a year of steady training",
      "IntermediateOne to three years",
      "AdvancedMore than three years",
    ]);
  });

  it("should end on See your priorities, which opens the summary", async () => {
    renderGoalFlow(router, "/goal/6");

    await userEvent.click(await screen.findByRole("button", { name: "See your priorities" }));

    expect(router.push).toHaveBeenCalledWith("/goal/summary");
  });

  it("should choose another level", async () => {
    renderGoalFlow(router, "/goal/6");

    await userEvent.click(await screen.findByRole("radio", { name: /^Beginner/ }));

    expect(isChecked(screen.getByRole("radio", { name: /^Beginner/ }))).toBe(true);
    expect(isChecked(screen.getByRole("radio", { name: /^Advanced/ }))).toBe(false);
  });
});

describe("moving through the last three questions", () => {
  it.each([
    ["/goal/4", "How long is a session?", "/goal/5"],
    ["/goal/5", "What can you use?", "/goal/6"],
  ])("should go on from %s to the next question", async (startAt, title, nextPath) => {
    renderGoalFlow(router, startAt);
    await screen.findByRole("heading", { level: 1, name: title });

    await userEvent.click(await nextButton());

    expect(router.push).toHaveBeenCalledWith(nextPath);
  });

  it.each([
    ["/goal/4", "/goal/3"],
    ["/goal/5", "/goal/4"],
    ["/goal/6", "/goal/5"],
  ])("should return from %s to the question before it", async (startAt, previousPath) => {
    renderGoalFlow(router, startAt);

    await userEvent.click(await screen.findByRole("button", { name: "Back" }));

    expect(router.push).toHaveBeenCalledWith(previousPath);
  });

  it.each([
    ["/goal/4", "How long is a session?"],
    ["/goal/5", "What can you use?"],
    ["/goal/6", "How long have you trained?"],
  ])("should put focus on the title of %s", async (startAt, title) => {
    renderGoalFlow(router, startAt);

    const heading = await screen.findByRole("heading", { level: 1, name: title });

    expect(document.activeElement).toBe(heading);
  });

  it.each(["/goal/4", "/goal/5", "/goal/6"])(
    "should leave for the Goal page from %s with nothing changed, and ask first when something was",
    async (startAt) => {
      renderGoalFlow(router, startAt);

      await userEvent.click(await screen.findByRole("button", { name: "Cancel" }));
      expect(router.replace).toHaveBeenCalledWith("/goal");
      expect(screen.queryByRole("dialog")).toBeNull();
    },
  );

  it("should ask before Cancel leaves when an answer of the last three was changed", async () => {
    renderGoalFlow(router, "/goal/6");
    await userEvent.click(await screen.findByRole("radio", { name: /^Beginner/ }));

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(screen.getByRole("dialog", { name: "Your answers are not saved" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
