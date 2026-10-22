type NotificationsModule = typeof import("expo-notifications");

/**
 * The notifications library, or null on a build made before it was added. Loading it there throws,
 * because its native module is missing, and an over-the-air update must not crash such a build.
 * It is loaded on first use for that reason, so nothing imports it at the top of a file.
 */
export function loadNotifications(): NotificationsModule | null {
  try {
    // The cast is safe because require returns the module untyped. A top-level import would throw on a
    // build without the native module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("expo-notifications") as NotificationsModule;
  } catch {
    return null;
  }
}
