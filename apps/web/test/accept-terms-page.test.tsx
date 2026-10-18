import { TERMS_VERSION } from "@keylow/core/copy";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import AcceptTermsPage from "@/app/accept-terms/page";

const { getUser, maybeSingle, redirect, signOut } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  redirect: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () =>
    Promise.resolve({ auth: { getUser }, from: () => ({ select: () => ({ maybeSingle }) }) }),
}));

vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/(dashboard)/actions", () => ({ signOut }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ rpc: vi.fn() }) }));

const neverAccepted = { terms_accepted_at: null, terms_version: null };

describe("Accept-terms page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: neverAccepted, error: null });
    redirect.mockImplementation(() => {
      throw new Error("NEXT_REDIRECT");
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("should send a signed out visitor to the login page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(AcceptTermsPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("should send an account that already accepted the current Terms to the dashboard", async () => {
    maybeSingle.mockResolvedValue({
      data: { terms_accepted_at: "2026-10-15T09:00:00Z", terms_version: TERMS_VERSION },
      error: null,
    });

    await expect(AcceptTermsPage()).rejects.toThrow("NEXT_REDIRECT");

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/dashboard");
  });

  it("should head the page Accept to continue with one line of explanation", async () => {
    render(await AcceptTermsPage());

    expect(screen.getByRole("heading", { level: 1, name: "Accept to continue" })).toBeTruthy();
    expect(screen.getByText("To use Ki-Lo, accept the Terms and the Privacy Policy.")).toBeTruthy();
  });

  it("should still show the page when the acceptance cannot be read, so it can be recorded", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    maybeSingle.mockResolvedValue({ data: null, error: { message: "connection reset" } });

    render(await AcceptTermsPage());

    expect(screen.getByRole("button", { name: "Continue" })).toBeTruthy();
  });

  it("should neither redirect nor show the page when the read of the acceptance throws", async () => {
    maybeSingle.mockRejectedValue(new Error("connection reset"));

    const outcome = await AcceptTermsPage().then(
      () => "rendered",
      () => "blocked",
    );

    expect(outcome).toBe("blocked");
    expect(redirect).not.toHaveBeenCalledWith("/dashboard");
  });

  it("should offer the same unticked acceptance checkbox as sign-up, with the Terms links", async () => {
    render(await AcceptTermsPage());

    expect(
      screen.getByRole("checkbox", {
        name: "I accept the Terms and the Privacy Policy, including storing my weight, food diary, body stats and workouts to run the app.",
      }),
    ).toHaveProperty("checked", false);
    expect(screen.getByRole("link", { name: "Terms" }).getAttribute("href")).toBe("/terms");
    expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
      "/privacy",
    );
  });

  it("should offer Sign out", async () => {
    render(await AcceptTermsPage());

    expect(screen.getByRole("button", { name: "Sign out" }).getAttribute("type")).toBe("submit");
  });
});
