/** The storage a Supabase client keeps its session in. */
type SessionStorage = {
  getItem: (key: string) => Promise<string | null>;
};

/**
 * The key supabase-js keeps the session under unless it is told another: `sb-` and the first label of the
 * project host. It is passed to the client explicitly, so reading the session back here and signing in
 * there cannot drift apart. The value is the same as the default, so no one is signed out by naming it.
 */
export function authStorageKey(supabaseUrl: string): string {
  return `sb-${new URL(supabaseUrl).hostname.split(".")[0]}-auth-token`;
}

function userIdOf(storedSession: string): string | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(storedSession);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || !("user" in parsed)) {
    return null;
  }
  const { user } = parsed;

  return typeof user === "object" && user !== null && "id" in user && typeof user.id === "string"
    ? user.id
    : null;
}

/**
 * Reads whose session is stored on the phone, from the storage alone. Unlike the client's `getSession`, it
 * does not wait on the network: with an access token that has expired and no connection, the client tries
 * the refresh for about 25 seconds and then answers with no session, though the person is still signed in.
 * It resolves to null when nothing is stored, and for anything it cannot read.
 */
export function createStoredUserIdReader(storage: SessionStorage, storageKey: string) {
  return async (): Promise<string | null> => {
    const storedSession = await storage.getItem(storageKey);

    return storedSession === null ? null : userIdOf(storedSession);
  };
}
