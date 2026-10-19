import { onlineManager } from "@tanstack/react-query";

/**
 * Runs a write that needs a connection. Offline it does not ask the database at all, because the training
 * writes are never held back to run when the phone is back online. A write that fails is caught, and
 * `onFailed` tells the person: neither the error nor what was being written is passed on, since a routine's
 * name is health data.
 */
export async function writeWhenOnline(
  write: () => Promise<unknown>,
  onFailed: () => void,
): Promise<void> {
  if (!onlineManager.isOnline()) {
    onFailed();
    return;
  }
  try {
    await write();
  } catch {
    onFailed();
  }
}
