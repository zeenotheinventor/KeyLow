import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import ExportPage from "@/app/(dashboard)/more/export/page";

vi.mock("@/components/account", () => ({
  ExportMyDataScreen: () => <h1>Export my data</h1>,
}));

describe("Export my data page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should draw the export screen", () => {
    render(<ExportPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Export my data" })).toBeTruthy();
  });

  it("should pad top and bottom as the shell boards draw it", async () => {
    const { container } = render(<ExportPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [24, 24],
      desktop: [40, 40],
    });
  });
});
