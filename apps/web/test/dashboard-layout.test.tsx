import { TERMS_VERSION } from "@keylow/core/copy";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./ui/compileUtilities";

import DashboardLayout from "@/app/(dashboard)/layout";

const { getUser, maybeSingle, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({ auth: { getUser }, from: () => ({ select: () => ({ maybeSingle }) }) }),
}));

vi.mock("next/navigation", () => ({ redirect }));

vi.mock("@/components/monitoring/SentryUser", () => ({
  SentryUser: ({ userId }: { userId: string }) => <p>Sentry user {userId}</p>,
}));

vi.mock("@/app/(dashboard)/DashboardNav", () => ({ DashboardNav: () => <nav /> }));

vi.mock("@/app/(dashboard)/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => children,
}));

describe("DashboardLayout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    maybeSingle.mockResolvedValue({
      data: { terms_accepted_at: "2026-10-15T09:00:00Z", terms_version: TERMS_VERSION },
      error: null,
    });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should send a signed-out visitor to the login page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(DashboardLayout({ children: <p>Page content</p> })).rejects.toThrow(
      "NEXT_REDIRECT",
    );

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });

  describe("accepting the Terms", () => {
    it("should let an account with the current acceptance through", async () => {
      render(await DashboardLayout({ children: <p>Page content</p> }));

      expect(redirect).not.toHaveBeenCalled();
      expect(screen.getByText("Page content")).toBeTruthy();
    });

    it.each([
      ["has no profile row", null],
      ["never accepted", { terms_accepted_at: null, terms_version: null }],
      [
        "accepted an older version",
        { terms_accepted_at: "2026-01-01T09:00:00Z", terms_version: "2026-01-01" },
      ],
    ])("should send an account that %s to accept the Terms", async (_case, row) => {
      maybeSingle.mockResolvedValue({ data: row, error: null });

      await expect(DashboardLayout({ children: <p>Page content</p> })).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect).toHaveBeenCalledExactlyOnceWith("/accept-terms");
    });

    it("should send the account to accept the Terms when the acceptance cannot be read", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      maybeSingle.mockResolvedValue({
        data: { terms_accepted_at: "2026-10-15T09:00:00Z", terms_version: TERMS_VERSION },
        error: { message: "permission denied for table profiles" },
      });

      await expect(DashboardLayout({ children: <p>Page content</p> })).rejects.toThrow(
        "NEXT_REDIRECT",
      );

      expect(redirect).toHaveBeenCalledExactlyOnceWith("/accept-terms");
    });

    it("should not render the page when the read of the acceptance throws", async () => {
      maybeSingle.mockRejectedValue(new Error("connection reset"));

      const outcome = await DashboardLayout({ children: <p>Page content</p> }).then(
        () => "rendered",
        () => "blocked",
      );

      expect(outcome).toBe("blocked");
    });
  });

  it("should tell Sentry which account is signed in", async () => {
    render(await DashboardLayout({ children: <p>Page content</p> }));

    expect(screen.getByText("Sentry user user-1")).toBeTruthy();
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
