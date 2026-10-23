import type { HealthAvailability, HealthProvider } from "../../lib/health";

/** What the device has: whether Health Connect is there, and whether Ki-Lo may read weight from it. */
export type HealthConnectionReading = Readonly<{
  availability: HealthAvailability;
  hasPermission: boolean;
}>;

/** Reads the provider's availability and, where it is available, whether permission is held. It never prompts. */
export async function readHealthConnection(
  provider: HealthProvider,
): Promise<HealthConnectionReading> {
  try {
    const availability = await provider.availability();
    const hasPermission =
      availability === "available" ? await provider.hasPermission().catch(() => false) : false;
    return { availability, hasPermission };
  } catch {
    // A device that cannot say what it has is treated as one with no Health Connect.
    return { availability: "unsupported", hasPermission: false };
  }
}
