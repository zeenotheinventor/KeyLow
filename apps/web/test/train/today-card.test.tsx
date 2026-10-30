import { TRAIN_HOME } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import type { TodayCardWithSession } from "@keylow/core/copy";

import { SetsProgressBar, TodayCard } from "@/components/train";

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
