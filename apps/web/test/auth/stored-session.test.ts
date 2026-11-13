import { afterEach, describe, expect, it, vi } from "vitest";

import {
  describeClearedSessionCookies,
  removeStoredSession,
  sessionCookieKeyOf,
} from "@/lib/auth/storedSession";

describe("sessionCookieKeyOf", () => {
  it("should name the cookie after the first label of the Supabase host, as the Supabase client does", () => {
    expect(sessionCookieKeyOf("https://abcdefgh.supabase.co")).toBe("sb-abcdefgh-auth-token");
    expect(sessionCookieKeyOf("http://127.0.0.1:54321")).toBe("sb-127-auth-token");
  });
});

describe("describeClearedSessionCookies", () => {
  const key = "sb-abc-auth-token";

  it("should expire the session cookie, its chunks and the sign-in code verifier", () => {
    const header = `${key}.0=aaa; ${key}.1=bbb; ${key}-code-verifier=ccc; ${key}=ddd`;

    expect(describeClearedSessionCookies(header, key)).toEqual([
      `${key}.0=; path=/; max-age=0; SameSite=Lax`,
      `${key}.1=; path=/; max-age=0; SameSite=Lax`,
      `${key}-code-verifier=; path=/; max-age=0; SameSite=Lax`,
      `${key}=; path=/; max-age=0; SameSite=Lax`,
    ]);
  });

  it("should expire the per-flow code verifiers and their index", () => {
    const header = `${key}-flow-abc123-code-verifier=a; ${key}-flows-code-verifier=b`;

    expect(describeClearedSessionCookies(header, key)).toEqual([
      `${key}-flow-abc123-code-verifier=; path=/; max-age=0; SameSite=Lax`,
      `${key}-flows-code-verifier=; path=/; max-age=0; SameSite=Lax`,
    ]);
  });

  it("should leave another project's per-flow verifiers alone", () => {
    const header =
      "sb-other-auth-token-flow-abc-code-verifier=a; sb-other-auth-token-flows-code-verifier=b";

    expect(describeClearedSessionCookies(header, key)).toEqual([]);
  });

  it("should leave other cookies alone, including another project's session", () => {
    const header = `kl-theme=dark; sb-other-auth-token=x; ${key}-extra=y; ${key}=z`;

    expect(describeClearedSessionCookies(header, key)).toEqual([
      `${key}=; path=/; max-age=0; SameSite=Lax`,
    ]);
  });

  it("should have nothing to clear when there is no session", () => {
    expect(describeClearedSessionCookies("", key)).toEqual([]);
  });
});

describe("removeStoredSession", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    document.cookie = "sb-abc-auth-token=; path=/; max-age=0";
    document.cookie = "sb-abc-auth-token.0=; path=/; max-age=0";
    document.cookie = "kl-theme=; path=/; max-age=0";
  });

  it("should remove the session cookies of this browser and keep the rest", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abc.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    document.cookie = "sb-abc-auth-token.0=aaa; path=/";
    document.cookie = "sb-abc-auth-token=bbb; path=/";
    document.cookie = "kl-theme=dark; path=/";

    removeStoredSession();

    expect(document.cookie).toBe("kl-theme=dark");
  });
});
