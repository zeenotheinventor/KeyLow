import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AuthError, SignOut } from "@supabase/supabase-js";

import { endSession } from "@/lib/auth/endSession";

function createAuth(error: AuthError | null) {
  const signOut = vi.fn((_options?: SignOut) => Promise.resolve({ error }));

  return { auth: { signOut }, signOut };
}

const lostConnection = () => new AuthRetryableFetchError("Failed to fetch", 0);

describe("endSession", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("should only sign out through Supabase when that works", async () => {
    const { auth, signOut } = createAuth(null);
    const removeStoredSession = vi.fn();

    await endSession(auth, removeStoredSession);

    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
    expect(removeStoredSession).not.toHaveBeenCalled();
  });

  it("should remove the stored session and sign out locally when Supabase returns an error", async () => {
    const { auth, signOut } = createAuth(lostConnection());
    const removeStoredSession = vi.fn();

    await endSession(auth, removeStoredSession);

    expect(removeStoredSession).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledTimes(2);
    expect(signOut).toHaveBeenLastCalledWith({ scope: "local" });
    // The stored session goes before the local sign out reads it, or the read would try a refresh again.
    expect(removeStoredSession.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[1] ?? 0,
    );
  });

  it("should not call the network when the browser is offline", async () => {
    onlineManager.setOnline(false);
    const { auth, signOut } = createAuth(lostConnection());
    const removeStoredSession = vi.fn();

    await endSession(auth, removeStoredSession);

    expect(removeStoredSession).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledExactlyOnceWith({ scope: "local" });
  });
});
