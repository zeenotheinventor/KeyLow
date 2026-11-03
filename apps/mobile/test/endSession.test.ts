import { AuthRetryableFetchError } from "@supabase/supabase-js";
import { onlineManager } from "@tanstack/react-query";

import { endSession } from "../lib/endSession";

import type { AuthError, SignOut } from "@supabase/supabase-js";

function createAuth(error: AuthError | null) {
  const signOut = jest.fn((_options?: SignOut) => Promise.resolve({ error }));

  return { auth: { signOut }, signOut };
}

const lostConnection = () => new AuthRetryableFetchError("Network request failed", 0);

describe("endSession", () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it("should only sign out through Supabase when that works", async () => {
    const { auth, signOut } = createAuth(null);
    const removeStoredSession = jest.fn(() => Promise.resolve());

    await endSession(auth, removeStoredSession);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith();
    expect(removeStoredSession).not.toHaveBeenCalled();
  });

  it("should remove the stored session and sign out locally when Supabase returns an error", async () => {
    const { auth, signOut } = createAuth(lostConnection());
    const removeStoredSession = jest.fn(() => Promise.resolve());

    await endSession(auth, removeStoredSession);

    expect(removeStoredSession).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenLastCalledWith({ scope: "local" });
    // The stored session goes before the local sign out reads it, or the read would try a refresh again.
    expect(removeStoredSession.mock.invocationCallOrder[0]).toBeLessThan(
      signOut.mock.invocationCallOrder[1] ?? 0,
    );
  });

  it("should not wait for Supabase when the app is offline", async () => {
    onlineManager.setOnline(false);
    const { auth, signOut } = createAuth(lostConnection());
    const removeStoredSession = jest.fn(() => Promise.resolve());

    await endSession(auth, removeStoredSession);

    expect(removeStoredSession).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  describe("the widgets", () => {
    it("should delete the snapshot and the pending-undo record before signing out", async () => {
      const { auth, signOut } = createAuth(null);
      const clearWidgets = jest.fn(() => Promise.resolve());

      await endSession(
        auth,
        jest.fn(() => Promise.resolve()),
        clearWidgets,
      );

      expect(clearWidgets).toHaveBeenCalledTimes(1);
      expect(clearWidgets.mock.invocationCallOrder[0]).toBeLessThan(
        signOut.mock.invocationCallOrder[0] ?? 0,
      );
    });

    it("should delete the widget data offline too", async () => {
      onlineManager.setOnline(false);
      const { auth } = createAuth(lostConnection());
      const clearWidgets = jest.fn(() => Promise.resolve());

      await endSession(
        auth,
        jest.fn(() => Promise.resolve()),
        clearWidgets,
      );

      expect(clearWidgets).toHaveBeenCalledTimes(1);
    });

    it("should still sign out when the widget data cannot be deleted", async () => {
      const { auth, signOut } = createAuth(null);

      await endSession(
        auth,
        jest.fn(() => Promise.resolve()),
        () => Promise.reject(new Error("storage failed")),
      );

      expect(signOut).toHaveBeenCalledTimes(1);
    });
  });
});
