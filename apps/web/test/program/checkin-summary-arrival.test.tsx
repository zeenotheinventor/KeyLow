import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { compileUtilities } from "../ui/compileUtilities";

import type { CheckinSummaryView } from "@keylow/core/program";

import { CheckinSummary } from "@/components/program/CheckinSummaryCard/CheckinSummary";

const VIEW: CheckinSummaryView = {
  name: "Last check-in, Friday 23 October, measured",
  dateText: "Friday 23 October",
  isMeasured: true,
  rows: [
    { label: "Expenditure", value: "2,580 kcal", name: "Expenditure: 2,580 kcal" },
    { label: "Calorie target", value: "2,140 kcal", name: "Calorie target: 2,140 kcal" },
  ],
  lines: [],
};

afterEach(() => {
  cleanup();
});

describe("the last check-in card when the check-in has just arrived", () => {
  it("should sit at rest when no check-in has arrived", () => {
    render(<CheckinSummary view={VIEW} isArriving={false} />);

    expect(screen.getByRole("group", { name: VIEW.name }).className).not.toContain("animate-");
  });

  it("should cut in from the side, once, when a check-in has arrived", async () => {
    render(<CheckinSummary view={VIEW} isArriving />);
    const classes = screen.getByRole("group", { name: VIEW.name }).getAttribute("class") ?? "";

    const css = await compileUtilities(classes);

    expect(css).toContain("animation: kl-cut-in 220ms");
  });

  it("should only fade under reduced motion, moving nothing", async () => {
    render(<CheckinSummary view={VIEW} isArriving />);
    const classes = screen.getByRole("group", { name: VIEW.name }).getAttribute("class") ?? "";

    const css = await compileUtilities(classes);
    const reduced = css.split("@media (prefers-reduced-motion: reduce)")[1] ?? "";

    expect(reduced).toContain("animation: kl-fade-in 160ms");
  });

  it("should still be named by its date and measured badge", () => {
    render(<CheckinSummary view={VIEW} isArriving />);

    expect(screen.getByRole("group", { name: VIEW.name })).toBeTruthy();
  });
});
