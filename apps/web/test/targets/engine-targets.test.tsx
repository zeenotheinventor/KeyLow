import { PROGRAM_TARGETS_SCREEN } from "@keylow/core/copy";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../ui/appRouter";

import type { Targets } from "@keylow/api-client";

import { EngineTargets } from "@/components/targets/EngineTargets";

// The golden week: 2,140 kcal with 126 g protein, 245 g carbohydrate and 73 g fat, set on Friday 23 October.
const GOLDEN: Targets = {
  kcal: 2140,
  protein_g: 126,
  carbs_g: 245,
  fat_g: 73,
  source: "engine",
  dowCaloriesKcal: [2140, 2140, 2140, 2140, 2140, 2140, 2140],
};

function renderEngineTargets(overrides: Partial<React.ComponentProps<typeof EngineTargets>> = {}) {
  const onSetOwnTargets = vi.fn();
  const rendered = renderWithRouter(
    <EngineTargets
      targets={GOLDEN}
      since="2026-10-23"
      isOnline
      onSetOwnTargets={onSetOwnTargets}
      {...overrides}
    />,
  );
  return { ...rendered, onSetOwnTargets };
}

afterEach(() => {
  cleanup();
});

describe("EngineTargets", () => {
  it("should read the golden figures, each with its unit, in the order of the phone", () => {
    renderEngineTargets();

    const rows = within(
      screen.getByRole("region", { name: PROGRAM_TARGETS_SCREEN.thisWeekList }),
    ).getAllByRole("listitem");

    expect(rows.map((row) => row.textContent)).toEqual([
      "Calories2,140kcal",
      "Protein126g",
      "Carbohydrate245g",
      "Fat73g",
    ]);
  });

  it("should offer nothing to edit in the figures", () => {
    renderEngineTargets();

    const figures = screen.getByRole("region", { name: PROGRAM_TARGETS_SCREEN.thisWeekList });

    expect(within(figures).queryByRole("textbox")).toBeNull();
    expect(within(figures).queryByRole("button")).toBeNull();
    expect(within(figures).queryByRole("link")).toBeNull();
  });

  it("should leave a figure the programme has not set without a value or a unit", () => {
    renderEngineTargets({ targets: { ...GOLDEN, protein_g: null, fat_g: null } });

    const rows = within(
      screen.getByRole("region", { name: PROGRAM_TARGETS_SCREEN.thisWeekList }),
    ).getAllByRole("listitem");

    expect(rows.map((row) => row.textContent)).toEqual([
      "Calories2,140kcal",
      "Protein",
      "Carbohydrate245g",
      "Fat",
    ]);
  });

  it("should head the figures with This week and say when they began", () => {
    renderEngineTargets();

    expect(screen.getByRole("heading", { level: 2, name: "This week" })).toBeTruthy();
    expect(screen.getByText("Since Friday 23 October")).toBeTruthy();
  });

  it("should say nothing of when they began until that is known", () => {
    renderEngineTargets({ since: undefined });

    expect(screen.getByRole("heading", { level: 2, name: "This week" })).toBeTruthy();
    expect(screen.queryByText(/^Since /)).toBeNull();
  });

  it("should link to the Programme page", () => {
    renderEngineTargets();

    const link = screen.getByRole("link", { name: /^Programme/ });

    expect(link.getAttribute("href")).toBe("/more/program");
    expect(link.textContent).toContain(PROGRAM_TARGETS_SCREEN.programRow.subtitle);
  });

  it("should explain that the programme sets the figures and that setting your own stops the check-in", () => {
    renderEngineTargets();

    expect(screen.getByText(PROGRAM_TARGETS_SCREEN.engineNote)).toBeTruthy();
  });

  it("should leave out Estimate my targets, which lands with the web wizard", () => {
    renderEngineTargets();

    expect(screen.queryByText("Estimate my targets")).toBeNull();
  });

  describe("Set my own targets", () => {
    it("should ask to open the form when pressed", () => {
      const { onSetOwnTargets } = renderEngineTargets();

      fireEvent.click(screen.getByRole("button", { name: "Set my own targets" }));

      expect(onSetOwnTargets).toHaveBeenCalledOnce();
    });

    it("should come last in the column, after the note", () => {
      renderEngineTargets();

      const note = screen.getByText(PROGRAM_TARGETS_SCREEN.engineNote);
      const button = screen.getByRole("button", { name: "Set my own targets" });

      expect(note.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should sit to the right of the column from the medium width, and fill it, large, below", () => {
      renderEngineTargets();

      const button = screen.getByRole("button", { name: "Set my own targets" });

      expect(button.parentElement?.className).toContain("md:justify-end");
      expect(button.className).toContain("w-full");
      expect(button.className).toContain("md:w-auto");
      expect(button.className).toContain("max-md:h-control-lg");
    });

    it("should be off with no connection, and do nothing when pressed", () => {
      const { onSetOwnTargets } = renderEngineTargets({ isOnline: false });

      const button = screen.getByRole("button", { name: "Set my own targets" });
      fireEvent.click(button);

      expect(button).toHaveProperty("disabled", true);
      expect(onSetOwnTargets).not.toHaveBeenCalled();
    });

    it("should keep the figures as read while it is off", () => {
      renderEngineTargets({ isOnline: false });

      expect(screen.getByText("2,140")).toBeTruthy();
      expect(screen.getByText("Since Friday 23 October")).toBeTruthy();
    });
  });
});
