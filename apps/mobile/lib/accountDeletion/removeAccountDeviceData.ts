import { deviceStorage } from "./deviceStorage";

async function removeEntries(
  accountId: string,
  isWanted: (entry: { isKeyedByAccount?: true }) => boolean,
): Promise<void> {
  const removals = Object.values(deviceStorage).flatMap((entry) =>
    entry.class === "removedOnDeletion" && "remove" in entry && isWanted(entry)
      ? [entry.remove]
      : [],
  );

  await Promise.allSettled(removals.map(async (remove) => remove(accountId)));
}

/**
 * Removes from this phone what the deleted account and its person left, which is every `removedOnDeletion`
 * key of `deviceStorage`. Each removal runs on its own, so one that fails leaves the others done, and none
 * is raised: a deletion's clean-up has no one to tell.
 */
export function removeAccountDeviceData(accountId: string): Promise<void> {
  return removeEntries(accountId, () => true);
}

/**
 * Removes only what is stored under the account's id (its notified badges and its health import state).
 * For a marker that names another account than the one signed in now: that person deleted nothing, so their
 * settings and everything not keyed by an id stay.
 */
export function removeAccountKeyedData(accountId: string): Promise<void> {
  return removeEntries(accountId, (entry) => entry.isKeyedByAccount === true);
}
