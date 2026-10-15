// @vitest-environment node
import { TERMS_VERSION } from "@keylow/core/copy";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/auth/callback/route";

const { exchangeCodeForSession, verifyOtp, rpc } = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  verifyOtp: vi.fn(),
  rpc: vi.fn(),
}));

const serverClient = { auth: { exchangeCodeForSession, verifyOtp }, rpc };

vi.mock("@/lib/supabase/server", () => ({
  createClient: () => Promise.resolve(serverClient),
}));

async function callback(search: string, cookie?: string) {
  return GET(
    new NextRequest(`http://localhost:3000/auth/callback${search}`, {
      headers: cookie === undefined ? {} : { cookie },
    }),
  );
}

async function redirectLocation(search: string) {
  return (await callback(search)).headers.get("location");
}

const TERMS_PENDING = `kl-terms-pending=${TERMS_VERSION}`;
const setCookies = (response: Response) => response.headers.getSetCookie().join("\n");

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    exchangeCodeForSession.mockResolvedValue({ error: null });
    verifyOtp.mockResolvedValue({ error: null });
    rpc.mockResolvedValue({ error: null });
  });

  describe("PKCE code", () => {
    it("should exchange the code and redirect to the dashboard by default", async () => {
      const location = await redirectLocation("?code=abc");

      expect(exchangeCodeForSession).toHaveBeenCalledWith("abc");
      expect(location).toBe("http://localhost:3000/dashboard");
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
    ])("should ignore the next value %s and redirect to the dashboard", async (next) => {
      const location = await redirectLocation(`?code=abc&next=${encodeURIComponent(next)}`);

      expect(location).toBe("http://localhost:3000/dashboard");
    });

    it("should redirect to the login page with an error when the exchange fails", async () => {
      exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });

      const location = await redirectLocation("?code=abc");

      expect(location).toBe("http://localhost:3000/login?error=callback");
    });
  });

  describe("email links", () => {
    it("should verify the token hash and redirect to the dashboard", async () => {
      const location = await redirectLocation("?token_hash=hash123&type=signup");

      expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "hash123" });
      expect(location).toBe("http://localhost:3000/dashboard");
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

  describe("accepting the Terms after a Google sign-up", () => {
    it("should record the accepted version for the person who has just signed in", async () => {
      const response = await callback("?code=abc", TERMS_PENDING);

      expect(rpc).toHaveBeenCalledTimes(1);
      expect(rpc).toHaveBeenCalledWith("accept_terms", { p_version: TERMS_VERSION });
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it("should record the acceptance only after the session exists", async () => {
      const order: string[] = [];
      exchangeCodeForSession.mockImplementation(() => {
        order.push("exchange");
        return Promise.resolve({ error: null });
      });
      rpc.mockImplementation(() => {
        order.push("accept");
        return Promise.resolve({ error: null });
      });

      await callback("?code=abc", TERMS_PENDING);

      expect(order).toEqual(["exchange", "accept"]);
    });

    it("should clear the cookie once it has been used", async () => {
      const response = await callback("?code=abc", TERMS_PENDING);

      expect(setCookies(response)).toMatch(/kl-terms-pending=;/);
      expect(setCookies(response)).toMatch(/Path=\//);
      expect(setCookies(response)).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
    });

    it("should record nothing when the cookie is missing, as for a plain sign in", async () => {
      const response = await callback("?code=abc");

      expect(rpc).not.toHaveBeenCalled();
      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
    });

    it.each(["1999-01-01", "", `${TERMS_VERSION}x`, "latest"])(
      "should record nothing for the forged version %j, and still clear the cookie",
      async (version) => {
        const response = await callback("?code=abc", `kl-terms-pending=${version}`);

        expect(rpc).not.toHaveBeenCalled();
        expect(setCookies(response)).toMatch(/kl-terms-pending=;/);
        expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
      },
    );

    it("should record nothing and clear the cookie when the exchange fails", async () => {
      exchangeCodeForSession.mockResolvedValue({ error: { message: "bad code" } });

      const response = await callback("?code=abc", TERMS_PENDING);

      expect(rpc).not.toHaveBeenCalled();
      expect(setCookies(response)).toMatch(/kl-terms-pending=;/);
      expect(response.headers.get("location")).toBe("http://localhost:3000/login?error=callback");
    });

    it("should still sign the person in, and log the problem, when the database refuses", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const failure = { code: "P0002", message: "no profile" };
      rpc.mockResolvedValue({ error: failure });

      const response = await callback("?code=abc&next=/weight", TERMS_PENDING);

      expect(response.headers.get("location")).toBe("http://localhost:3000/weight");
      expect(setCookies(response)).toMatch(/kl-terms-pending=;/);
      expect(logged).toHaveBeenCalledWith("Could not record the Terms acceptance", failure);
      logged.mockRestore();
    });

    it("should still sign the person in, and log the problem, when the request throws", async () => {
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const failure = new Error("connection reset");
      rpc.mockRejectedValue(failure);

      const response = await callback("?code=abc", TERMS_PENDING);

      expect(response.headers.get("location")).toBe("http://localhost:3000/dashboard");
      expect(logged).toHaveBeenCalledWith("Could not record the Terms acceptance", failure);
      logged.mockRestore();
    });

    it("should not record anything for an email link", async () => {
      const response = await callback("?token_hash=hash123&type=signup", TERMS_PENDING);

      expect(rpc).not.toHaveBeenCalled();
      expect(setCookies(response)).toMatch(/kl-terms-pending=;/);
    });
  });
});
