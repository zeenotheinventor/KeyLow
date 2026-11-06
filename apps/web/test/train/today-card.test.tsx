import { TRAIN_HOME, TRAIN_PICK_DAY } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { TodayCardWithSession } from "@keylow/core/copy";

import { SetsProgressBar, TodayCard } from "@/components/train/TodayCard";

const context = { localDate: "2026-10-15", nextExerciseName: null, recovery: null };

const inProgress = (setsLogged: number, setsPlanned: number): TodayCardWithSession => ({
  kind: "in_progress",
  dayName: "Legs",
  minutesSoFar: 30,
  setsLogged,
  setsPlanned,
  nextSet: null,
});

const planned = (exerciseCount: number): TodayCardWithSession => ({
  kind: "planned",
  routineName: "Push Pull Legs",
  dayName: "Legs",
  dayNumber: 3,
  dayCount: 4,
  exerciseCount,
  setCount: 16,
  estimatedMinutes: 50,
});

const sets = () => screen.getByRole("meter", { name: TRAIN_HOME.setsProgressName });

describe("SetsProgressBar", () => {
  afterEach(() => {
    cleanup();
  });

  it("should name the sets logged and the sets planned", () => {
    render(<SetsProgressBar setsLogged={8} setsPlanned={16} />);

    expect(sets().getAttribute("aria-valuemin")).toBe("0");
    expect(sets().getAttribute("aria-valuenow")).toBe("8");
    expect(sets().getAttribute("aria-valuemax")).toBe("16");
  });

  it("should not read more than the plan when more sets are logged than planned", () => {
    render(<SetsProgressBar setsLogged={20} setsPlanned={16} />);

    expect(sets().getAttribute("aria-valuenow")).toBe("16");
  });
});

describe("TodayCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("should draw the bar of the sets when the day plans some", () => {
    render(
      <TodayCard card={inProgress(8, 16)} context={context} isStartAndResumeDisabled={false} />,
    );

    expect(sets().getAttribute("aria-valuenow")).toBe("8");
  });

  it("should draw no bar when the day plans no sets", () => {
    render(
      <TodayCard card={inProgress(3, 0)} context={context} isStartAndResumeDisabled={false} />,
    );

    expect(screen.queryByRole("meter")).toBeNull();
  });

  it("should hold a row of space for each exercise of the plan while they load", () => {
    render(
      <TodayCard
        card={planned(5)}
        context={context}
        isLoadingExercises
        isStartAndResumeDisabled={false}
      />,
    );

    const holder = screen.getByRole("status", {
      name: TRAIN_HOME.exercisesLoadingName,
    }).parentElement;
    expect(holder?.style.getPropertyValue("--rows")).toBe("5");
  });

  it("should hold three rows when the plan names no exercises", () => {
    render(
      <TodayCard
        card={planned(0)}
        context={context}
        isLoadingExercises
        isStartAndResumeDisabled={false}
      />,
    );

    const holder = screen.getByRole("status", {
      name: TRAIN_HOME.exercisesLoadingName,
    }).parentElement;
    expect(holder?.style.getPropertyValue("--rows")).toBe("3");
  });

  it("should draw the exercises and no skeleton once they are given", () => {
    render(
      <TodayCard
        card={planned(1)}
        context={context}
        exercises={[{ id: "a", name: "Leg Press", target: "3 × 10 to 12 · RIR 1" }]}
        isStartAndResumeDisabled={false}
      />,
    );
    const card = screen.getByRole("region", { name: TRAIN_HOME.todaySectionName });

    expect(within(card).getAllByRole("listitem")).toHaveLength(1);
    expect(within(card).queryByRole("status")).toBeNull();
  });
});

describe("TodayCard's Pick day", () => {
  const done: TodayCardWithSession = {
    kind: "done",
    dayName: "Legs",
    minutes: 52,
    setsLogged: 16,
    setsPlanned: 16,
    next: null,
  };
  const rest: TodayCardWithSession = { kind: "rest", next: null };
  const pickDay = () => screen.getByRole("button", { name: TRAIN_PICK_DAY.action });

  afterEach(() => {
    cleanup();
  });

  it("should draw Pick day beside Start on the planned card and report a press", async () => {
    const onPickDay = vi.fn();
    render(
      <TodayCard
        card={planned(5)}
        context={context}
        isStartAndResumeDisabled={false}
        onPickDay={onPickDay}
        onStart={() => undefined}
      />,
    );

    await userEvent.click(pickDay());

    expect(onPickDay).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Start Legs" })).toBeTruthy();
  });

  it("should draw it as a secondary button, so Start stays the one primary action", () => {
    render(
      <TodayCard
        card={planned(5)}
        context={context}
        isStartAndResumeDisabled={false}
        onPickDay={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(pickDay().className).not.toBe(
      screen.getByRole("button", { name: "Start Legs" }).className,
    );
  });

  it("should draw it on the planned card when the day has no Start, as on a day the plan leaves open", () => {
    render(
      <TodayCard
        card={planned(5)}
        context={context}
        isStartAndResumeDisabled={false}
        onPickDay={() => undefined}
      />,
    );

    expect(pickDay()).toBeTruthy();
  });

  it("should draw no Pick day while no handler is given", () => {
    render(
      <TodayCard
        card={planned(5)}
        context={context}
        isStartAndResumeDisabled={false}
        onStart={() => undefined}
      />,
    );

    expect(screen.queryByRole("button", { name: TRAIN_PICK_DAY.action })).toBeNull();
  });

  it("should draw it on the rest card and the done card", () => {
    const { rerender } = render(
      <TodayCard
        card={rest}
        context={context}
        isStartAndResumeDisabled={false}
        onLogSession={() => undefined}
        onPickDay={() => undefined}
      />,
    );
    expect(pickDay()).toBeTruthy();

    rerender(
      <TodayCard
        card={done}
        context={context}
        isStartAndResumeDisabled={false}
        onLogAnother={() => undefined}
        onPickDay={() => undefined}
      />,
    );
    expect(pickDay()).toBeTruthy();
  });

  it("should dim it when starting is off, as Start is", () => {
    render(
      <TodayCard
        card={planned(5)}
        context={context}
        isStartAndResumeDisabled
        onPickDay={() => undefined}
        onStart={() => undefined}
      />,
    );

    expect(pickDay()).toHaveProperty("disabled", true);
  });

  it("should stop responding while a start is under way", () => {
    render(
      <TodayCard
        card={planned(5)}
        context={context}
        isStarting
        isStartAndResumeDisabled={false}
        onPickDay={() => undefined}
        onStart={() => undefined}
      />,
    );

    // The spinner replaces the label on the buttons of a start, as Start's does.
    const busy = screen.getAllByRole("button", { busy: true });
    expect(busy).toHaveLength(2);
    for (const button of busy) {
      expect(button).toHaveProperty("disabled", true);
    }
  });
});
