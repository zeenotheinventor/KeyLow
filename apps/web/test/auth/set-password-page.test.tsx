import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SetPasswordPage from "@/app/set-password/page";

const { getUser, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`redirected to ${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));
vi.mock("next/navigation", () => ({
  redirect,
  useRouter: () => ({ replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

describe("Set a new password page", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("should name the signed in person's email in the caption, read on the server", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "ada@example.com" } }, error: null });

    render(await SetPasswordPage());

    expect(screen.getByText("For ada@example.com. Other devices will be signed out.")).toBeTruthy();
  });

  it("should send a request with no signed in person to the login page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(SetPasswordPage()).rejects.toThrow("redirected to /login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("should send a person with no email to the login page, as there is nobody to name", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    await expect(SetPasswordPage()).rejects.toThrow("redirected to /login");
  });
});
