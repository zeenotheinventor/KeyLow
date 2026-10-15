import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./ui/compileUtilities";

import SignUpPage from "@/app/sign-up/page";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {} }) }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

describe("Sign-up page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should head the page Create account", () => {
    render(<SignUpPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Create account" })).toBeTruthy();
  });

  it("should say what Ki-Lo does under the heading", () => {
    render(<SignUpPage />);

    expect(
      screen.getByText("Track intake and weigh-ins. The engine estimates the rest."),
    ).toBeTruthy();
  });

  it("should link back to the sign-in page for someone with an account", () => {
    render(<SignUpPage />);

    expect(screen.getByText(/Already have an account\?/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });

  it("should draw the links in the accent in dark and in primary text in light", async () => {
    render(<SignUpPage />);
    const css = await compileUtilities(
      screen.getByRole("link", { name: "Terms" }).getAttribute("class") ?? "",
    );

    expect(css).toContain("text-decoration-line: underline");
    expect(css).toContain(".light-theme\\:text-text-primary");
    expect(css).toContain(".text-accent");
  });

  it("should leave room for the footer instead of filling the whole viewport", async () => {
    render(<SignUpPage />);
    const css = await compileUtilities(screen.getByRole("main").getAttribute("class") ?? "");

    expect(css).not.toContain("min-height: 100dvh");
    expect(css).toContain("flex: 1 1 0%");
  });
});
