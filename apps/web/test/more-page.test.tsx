import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import MorePage from "@/app/(dashboard)/more/page";

const { getUser, signOut } = vi.hoisted(() => ({ getUser: vi.fn(), signOut: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));

vi.mock("@/app/(dashboard)/actions", () => ({ signOut }));

async function renderPage() {
  render(await MorePage());
}

describe("More page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    getUser.mockResolvedValue({ data: { user: { email: "ada@example.com" } }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("should be titled More", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { level: 1, name: "More" })).toBeTruthy();
  });

  it("should reach Weight and Settings", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: /Weight/ }).getAttribute("href")).toBe("/weight");
    expect(screen.getByRole("link", { name: /Settings/ }).getAttribute("href")).toBe("/settings");
    expect(screen.queryByText("Coming soon")).toBeNull();
  });

  it("should show who is signed in under the Sign out button", async () => {
    await renderPage();

    expect(screen.getByRole("button", { name: /Sign out/ }).textContent).toContain(
      "ada@example.com",
    );
  });

  it("should run the sign out action when Sign out is pressed", async () => {
    await renderPage();

    screen.getByRole("button", { name: /Sign out/ }).click();

    await waitFor(() => {
      expect(signOut).toHaveBeenCalledOnce();
    });
  });
});
