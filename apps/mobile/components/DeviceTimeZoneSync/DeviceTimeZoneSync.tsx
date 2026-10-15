import { useDeviceTimeZoneSync } from "../../lib/useDeviceTimeZoneSync";

/** Draws nothing. Syncs the phone's time zone to the signed in user's profile (`useDeviceTimeZoneSync`). */
export function DeviceTimeZoneSync() {
  useDeviceTimeZoneSync();

  return null;
}
