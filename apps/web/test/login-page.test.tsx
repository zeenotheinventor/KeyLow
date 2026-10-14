import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import LoginPage from "@/app/login/page";

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {} }) }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));

async function renderPage(error?: string) {
  render(await LoginPage({ searchParams: Promise.resolve(error === undefined ? {} : { error }) }));
}

describe("Login page", () => {
  afterEach(() => {
    cleanup();
  });

  it("should greet the user under the Ki-Lo name", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "Sign in to Ki-Lo" })).toBeTruthy();
  });

  it("should show no error when the user arrives normally", async () => {
    await renderPage();

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should show the fixed link-error sentence whatever the error parameter says", async () => {
    await renderPage("otp_expired: token has expired or is invalid");

    expect(screen.getByRole("alert").textContent).toBe(
      "That sign-in link could not be verified. Sign in again, or request a new link.",
    );
    expect(document.body.textContent).not.toContain("otp_expired");
  });
});
