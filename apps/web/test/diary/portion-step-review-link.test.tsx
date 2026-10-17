import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { makeFood } from "../foods/support";

import type { PortionStepProps } from "@/components/diary/AddFoodDialog";

import { PortionStep } from "@/components/diary/AddFoodDialog";

const suspect = makeFood({ name: "Mystery stew", fat_g: null });

const draft: PortionStepProps["draft"] = {
  status: "ready",
  food: suspect,
  portions: [],
  unitOptions: [{ value: "g", label: "g" }],
  preview: { amount: null, hero: { caption: "For 100 g", values: null } },
  quantityText: "100",
  unitValue: "g",
  needsReview: true,
  setQuantityText: vi.fn(),
  setUnitValue: vi.fn(),
};

afterEach(cleanup);

describe("the Copy to your foods link of a food that needs review", () => {
  it("should stay in the same tab by default, as the diary has it", () => {
    render(
      <PortionStep
        draft={draft}
        time="12:00"
        isNow={false}
        onTimeChange={vi.fn()}
        onBack={vi.fn()}
      />,
    );

    const link = screen.getByRole("link", { name: "Copy to your foods" });

    expect(link.getAttribute("href")).toBe(`/foods/new?from=${suspect.id}`);
    expect(link.hasAttribute("target")).toBe(false);
  });

  it("should open in a new tab, and say so, when the screen behind has unsaved work", () => {
    render(<PortionStep draft={draft} opensReviewInNewTab onBack={vi.fn()} />);

    const link = screen.getByRole("link", { name: "Copy to your foods (opens in a new tab)" });

    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noreferrer");
  });
});
