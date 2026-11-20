import AsyncStorage from "@react-native-async-storage/async-storage";

const notifiedBadgesStorageKeyPrefix = "kl-notified-badges";

/** One saved list per account, so nothing has to be cleared when the signed in account changes. */
export const notifiedBadgesStorageKey = (accountId: string): string =>
  `${notifiedBadgesStorageKeyPrefix}:${accountId}`;

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

async function readSavedIds(accountId: string): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(notifiedBadgesStorageKey(accountId));
    const saved: unknown = raw === null ? [] : JSON.parse(raw);
    return isIdList(saved) ? saved : [];
  } catch {
    return [];
  }
}

async function writeSavedIds(accountId: string, ids: readonly string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(notifiedBadgesStorageKey(accountId), JSON.stringify(ids));
  } catch {
    // Nothing to do: the badge is toasted once more and then marked seen.
  }
}

// Every read and write goes through this one chain, so two changes never read the same list and then
// overwrite each other.
let queue: Promise<unknown> = Promise.resolve();

/**
 * Changes the account's saved list of notified badge ids: `change` gets the saved ids and returns the ids to
 * keep, which are written and returned. These are the badges this device sent an unlock notification for
 * that the person has not seen on the Achievements screen yet. They are saved because the celebration queue
 * is not: after a restart such a badge is a held, unseen row again, and this list keeps it from also being
 * toasted. Nothing is saved but badge ids. A write that fails only means one more toast after a restart.
 */
export function updateNotifiedIds(
  accountId: string,
  change: (saved: readonly string[]) => readonly string[],
): Promise<string[]> {
  const run = queue.then(async () => {
    const saved = await readSavedIds(accountId);
    const next = [...change(saved)];
    if (next.length !== saved.length || next.some((id, index) => id !== saved[index])) {
      await writeSavedIds(accountId, next);
    }
    return next;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Adds the ids to the account's saved ones, each once. */
export async function rememberNotifiedIds(
  accountId: string,
  ids: readonly string[],
): Promise<void> {
  await updateNotifiedIds(accountId, (saved) => [...new Set([...saved, ...ids])]);
}

/** The account's saved ids, after any change already waiting. */
export const readNotifiedIds = (accountId: string): Promise<string[]> =>
  updateNotifiedIds(accountId, (saved) => saved);
