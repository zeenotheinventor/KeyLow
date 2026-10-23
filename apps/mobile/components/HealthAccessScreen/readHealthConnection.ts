import type { BodyCompositionAccess, HealthAvailability, HealthProvider } from "../../lib/health";

const noBodyComposition: BodyCompositionAccess = { bodyFat: false, leanMass: false };

/**
 * What the device has: whether Health Connect is there, whether Ki-Lo may read weight from it, and which of
 * body fat and lean mass it may read.
 */
export type HealthConnectionReading = Readonly<{
  availability: HealthAvailability;
  hasPermission: boolean;
  bodyCompositionAccess: BodyCompositionAccess;
}>;

/**
 * Reads the provider's availability and, where it is available, what permission is held. It never prompts.
 * Weight is what connected means, so the body types are read for the flow's sake and do not change `hasPermission`.
 */
export async function readHealthConnection(
  provider: HealthProvider,
): Promise<HealthConnectionReading> {
  try {
    const availability = await provider.availability();
    const isAvailable = availability === "available";
    const hasPermission = isAvailable ? await provider.hasPermission().catch(() => false) : false;
    const bodyCompositionAccess = isAvailable
      ? await provider.bodyCompositionAccess().catch(() => noBodyComposition)
      : noBodyComposition;
    return { availability, hasPermission, bodyCompositionAccess };
  } catch {
    // A device that cannot say what it has is treated as one with no Health Connect.
    return {
      availability: "unsupported",
      hasPermission: false,
      bodyCompositionAccess: noBodyComposition,
    };
  }
}
