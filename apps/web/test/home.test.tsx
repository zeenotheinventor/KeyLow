import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));

describe("Home page", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  afterEach(() => {
    cleanup();
  });

  it("renders the KeyLow heading", async () => {
    render(await Home());

    expect(screen.getByRole("heading", { name: "KeyLow" })).toBeTruthy();
  });

  it("links to the login page when signed out", async () => {
    render(await Home());

    expect(screen.getByRole("link", { name: "Sign in" }).getAttribute("href")).toBe("/login");
  });

  it("links to the dashboard when signed in", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    render(await Home());

    expect(screen.getByRole("link", { name: "Open the dashboard" }).getAttribute("href")).toBe(
      "/diary",
    );
  });
});
