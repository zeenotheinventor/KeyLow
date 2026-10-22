import { loadNotifications } from "./loadNotifications";

import type { PermissionState } from "./types";

type SystemPermission = { status: string };

function toPermissionState(permission: SystemPermission): PermissionState {
  if (permission.status === "granted") {
    return "granted";
  }
  return permission.status === "denied" ? "denied" : "undetermined";
}

export async function getPermission(): Promise<PermissionState> {
  const notifications = loadNotifications();
  if (notifications === null) {
    return "unavailable";
  }
  return toPermissionState(await notifications.getPermissionsAsync());
}

/** Shows the system prompt when the person has not been asked yet. After a refusal the system shows nothing. */
export async function requestPermission(): Promise<PermissionState> {
  const notifications = loadNotifications();
  if (notifications === null) {
    return "unavailable";
  }
  return toPermissionState(await notifications.requestPermissionsAsync());
}
