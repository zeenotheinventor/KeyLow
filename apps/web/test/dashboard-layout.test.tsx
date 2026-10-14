import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./ui/compileUtilities";

import DashboardLayout from "@/app/(dashboard)/layout";

const { getUser, redirect } = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("@/app/(dashboard)/DashboardNav", () => ({ DashboardNav: () => <nav /> }));

vi.mock("@/app/(dashboard)/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("should send a signed-out visitor to the login page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });

    await expect(DashboardLayout({ children: <p>Page content</p> })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("should put the page in the main landmark", async () => {
    render(await DashboardLayout({ children: <p>Page content</p> }));

    expect(screen.getByRole("main").textContent).toBe("Page content");
  });

  it("should leave the top and bottom padding to each page family and keep the sides", async () => {
    render(await DashboardLayout({ children: <p>Page content</p> }));
    const css = await compileUtilities(screen.getByRole("main").getAttribute("class") ?? "");

    expect(css).toContain("padding-left: 16px");
    expect(css).toContain("padding-left: 32px");
    expect(css).not.toContain("padding-top");
    expect(css).not.toContain("padding-bottom");
  });
});
