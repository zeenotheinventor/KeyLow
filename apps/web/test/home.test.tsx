import { beforeEach, describe, expect, it, vi } from "vitest";

import Home from "@/app/page";

const { getUser, redirect } = vi.hoisted(() => ({ getUser: vi.fn(), redirect: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { getUser } }),
}));

vi.mock("next/navigation", () => ({ redirect }));

describe("Home page", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("should send a signed-out visitor to the login page", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    await Home();

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/login");
  });

  it("should send a signed-in user to the diary", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } }, error: null });

    await Home();

    expect(redirect).toHaveBeenCalledExactlyOnceWith("/diary");
  });
});
