import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { proxy } from "@/proxy";

const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseEnv: () => ({ url: "http://localhost:54321", anonKey: "anon" }),
}));

const signedOut = { data: { user: null } };
const signedIn = { data: { user: { id: "user-1" } } };

function requestFor(path: string) {
  return new NextRequest(`http://localhost:3000${path}`);
}

describe("proxy", () => {
  beforeEach(() => {
    getUser.mockResolvedValue(signedOut);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it.each(["/dashboard", "/diary", "/recipes", "/more", "/weight", "/settings", "/foods"])(
    "should send a signed out request for %s to the login page",
    async (path) => {
      const response = await proxy(requestFor(path));

      expect(response.status).toBe(307);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    },
  );

  it.each(["/foods/new", "/foods/22222222-2222-4222-8222-222222222222", "/foods?scope=own"])(
    "should send a signed out request for %s to the login page",
    async (path) => {
      const response = await proxy(requestFor(path));

      expect(response.headers.get("location")).toBe("http://localhost:3000/login");
    },
  );

  it("should let a signed in request for the foods page through", async () => {
    getUser.mockResolvedValue(signedIn);

    const response = await proxy(requestFor("/foods"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("should not treat a path that only starts with the same letters as the foods page", async () => {
    const response = await proxy(requestFor("/foodstuffs"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("should let a signed out request for the login page through", async () => {
    const response = await proxy(requestFor("/login"));

    expect(response.headers.get("location")).toBeNull();
  });
});
