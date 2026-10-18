import { Platform } from "react-native";

import { createHealthConnectProvider } from "./healthConnectProvider";

import type { HealthProvider } from "./HealthProvider";

/** Health Connect on Android and nothing elsewhere. There is no Apple implementation. */
export function getHealthProvider(): HealthProvider | null {
  return Platform.OS === "android" ? createHealthConnectProvider({ now: () => new Date() }) : null;
}
