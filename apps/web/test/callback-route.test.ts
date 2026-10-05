// @vitest-environment node
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/callback/route";

const { exchangeCodeForSession, verifyOtp } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve({ auth: { exchangeCodeForSession, verifyOtp } }),
}));

async function redirectLocation(search: string) {
  const response = await GET(new NextRequest(`http://localhost:3000/auth/callback${search}`));
  return response.headers.get("location");
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
  });

  describe("PKCE code", () => {
    it("should exchange the code and redirect to the diary by default", async () => {
      const location = await redirectLocation("?code=abc");

      expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
      expect(location).toBe("http://localhost:3000/diary");
    });

    it("should redirect to the next path when it is a local path", async () => {
      const location = await redirectLocation("?code=abc&next=/weight");

      expect(location).toBe("http://localhost:3000/weight");
    });

    it("should keep a query string that looks like a host", async () => {
      const location = await redirectLocation(
        `?code=abc&next=${encodeURIComponent("/diary?x=//evil")}`,
      );

      expect(location).toBe("http://localhost:3000/diary?x=//evil");
    });

    it.each([
      "//evil.example",
      "https://evil.example",
      "/\\evil.example",
      "weight",
      "/\t/evil.example",
      "/\n/evil.example",
      "/\r/evil.example",
    ])("should ignore the next value %s and redirect to the diary", async (next) => {
      const location = await redirectLocation(`?code=abc&next=${encodeURIComponent(next)}`);

      expect(location).toBe("http://localhost:3000/diary");
    });

    it("should redirect to the login page with an error when the exchange fails", async () => {
      exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });

      const location = await redirectLocation("?code=abc");

      expect(location).toBe("http://localhost:3000/login?error=callback");
    });
  });

  describe("email links", () => {
    it("should verify the token hash and redirect to the diary", async () => {
      const location = await redirectLocation("?token_hash=hash123&type=signup");

      expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "hash123" });
      expect(location).toBe("http://localhost:3000/diary");
    });

    it("should redirect to the login page with an error when verification fails", async () => {
      verifyOtp.mockResolvedValue({ error: { message: "expired" } });

      const location = await redirectLocation("?token_hash=hash123&type=signup");

      expect(location).toBe("http://localhost:3000/login?error=callback");
    });

    it("should not verify an unknown link type", async () => {
      const location = await redirectLocation("?token_hash=hash123&type=bogus");

      expect(verifyOtp).not.toHaveBeenCalled();
      expect(location).toBe("http://localhost:3000/login?error=callback");
    });
  });

  it("should redirect to the login page with an error when there is nothing to verify", async () => {
    const location = await redirectLocation("");

    expect(location).toBe("http://localhost:3000/login?error=callback");
  });
});
