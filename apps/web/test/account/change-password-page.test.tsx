import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithRouter } from "../ui/appRouter";

import ChangePasswordPage from "@/app/(dashboard)/more/change-password/page";

const { getUser, redirect } = vi.hoisted(() => ({
  getUser: vi.fn(),
  redirect: vi.fn((path: string): never => {
    throw new Error(`redirected to ${path}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));
vi.mock("next/navigation", () => ({ redirect, useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@keylow/api-client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@keylow/api-client")>()),
  useUpdatePassword: () => ({ mutateAsync: vi.fn() }),
}));

describe("Change password page", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
  });

  afterEach(() => {
    cleanup();
  });

  it("should name the signed in person's email, read on the server", async () => {
    getUser.mockResolvedValue({ data: { user: { email: "ada@example.com" } }, error: null });

    renderWithRouter(await ChangePasswordPage());

    expect(screen.getByRole("heading", { level: 1, name: "Change password" })).toBeTruthy();
    expect(screen.getByText("For ada@example.com. Other devices will be signed out.")).toBeTruthy();
  });

  it("should send a request with no email to the login page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await expect(ChangePasswordPage()).rejects.toThrow("redirected to /login");
  });
});
