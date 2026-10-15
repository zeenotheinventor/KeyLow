import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { pagePaddingOf } from "../pagePadding";

import type { Targets } from "@keylow/api-client";

import TargetsPage from "@/app/(dashboard)/more/targets/page";

type TargetsQuery = {
  data: Targets | undefined;
  isError: boolean;
  refetch: () => Promise<unknown>;
};

const { useTargets, refetch } = vi.hoisted(() => ({
  useTargets: vi.fn<() => TargetsQuery>(),
  refetch: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useTargets,
  useUpdateTargets: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock("@/components/ui/Toast", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/components/ui/Toast")>()),
  useToast: () => ({ show: vi.fn() }),
}));

beforeEach(() => {
  vi.resetAllMocks();
  useTargets.mockReturnValue({
    data: { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 },
    isError: false,
    refetch,
  });
});

afterEach(() => {
  cleanup();
});

describe("the Targets page", () => {
  it("should be headed Targets, under a More / Targets breadcrumb that goes back to More", () => {
    render(<TargetsPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Targets" })).toBeTruthy();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(breadcrumb.textContent).toBe("More / Targets");
    expect(screen.getByRole("link", { name: "More" }).getAttribute("href")).toBe("/more");
  });

  it("should show the form once the stored targets are known", () => {
    render(<TargetsPage />);

    expect(screen.getByRole("textbox", { name: /^Calories/ })).toHaveProperty("value", "2200");
  });

  it("should wait for the stored targets with a loading state and no form", () => {
    useTargets.mockReturnValue({ data: undefined, isError: false, refetch });
    render(<TargetsPage />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  it("should say it could not load and offer to try again", () => {
    useTargets.mockReturnValue({ data: undefined, isError: true, refetch });
    render(<TargetsPage />);

    expect(screen.getByRole("heading", { name: "Something went wrong. Try again." })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(refetch).toHaveBeenCalledOnce();
  });

  it("should pad top and bottom as the web targets boards draw it", async () => {
    const { container } = render(<TargetsPage />);

    expect(await pagePaddingOf(container.firstElementChild)).toEqual({
      phone: [16, 16],
      desktop: [32, 32],
    });
  });
});
