import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Targets } from "@keylow/api-client";

import { TargetsRow } from "@/app/(dashboard)/more/TargetsRow";

const { useTargets } = vi.hoisted(() => ({
  useTargets: vi.fn<() => { data: Targets | undefined }>(),
}));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useTargets,
}));

const own: Targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70, source: "manual" };

beforeEach(() => {
  vi.resetAllMocks();
});

afterEach(() => {
  cleanup();
});

describe("the Targets row of More", () => {
  it("should say the targets are set by you when no programme sets them", () => {
    useTargets.mockReturnValue({ data: own });
    render(<TargetsRow />);

    expect(screen.getByRole("link", { name: /Targets/ }).textContent).toBe(
      "TargetsSet by you2,200 kcal",
    );
  });

  it("should say the targets are from the programme while a programme sets them", () => {
    useTargets.mockReturnValue({
      data: {
        ...own,
        source: "engine",
        dowCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 2200, 2200],
      },
    });
    render(<TargetsRow />);

    expect(screen.getByRole("link", { name: /Targets/ }).textContent).toBe(
      "TargetsFrom your programme2,200 kcal",
    );
  });
});
