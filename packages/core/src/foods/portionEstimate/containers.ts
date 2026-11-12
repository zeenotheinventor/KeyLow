// Every figure in this file is an uncited editorial estimate, chosen like the ones in
// `estimatedPortion.ts`. None of them comes from a source, so none may be attributed to one. They are
// what a plate or bowl is taken to be when the person has not said its size.

export const PLATE_CONTAINERS = ["small_plate", "plate", "large_plate"] as const;
export const BOWL_CONTAINERS = ["small_bowl", "bowl", "large_bowl"] as const;
export const PORTION_ESTIMATE_CONTAINERS = [...PLATE_CONTAINERS, ...BOWL_CONTAINERS] as const;
export const PORTION_ESTIMATE_FILLS = ["half", "most", "full"] as const;

export type PlateContainer = (typeof PLATE_CONTAINERS)[number];
export type BowlContainer = (typeof BOWL_CONTAINERS)[number];
export type PortionEstimateContainer = (typeof PORTION_ESTIMATE_CONTAINERS)[number];
export type PortionEstimateFill = (typeof PORTION_ESTIMATE_FILLS)[number];

/** How much of a plate's radius food is taken to cover: the well, not the rim. */
export const PLATE_WELL_RADIUS_SHARE = 0.8;

/** Plate diameter bounds in cm, and the bowl's. A radius has the same bounds, halved. */
export const PLATE_DIAMETER_RANGE_CM = { min: 10, max: 40 } as const;
export const BOWL_DIAMETER_RANGE_CM = { min: 8, max: 30 } as const;
export const BOWL_DEPTH_RANGE_CM = { min: 2, max: 15 } as const;

export const FILL_SHARES: Record<PortionEstimateFill, number> = {
  half: 0.5,
  most: 0.75,
  full: 0.9,
};
export const DEFAULT_FILL: PortionEstimateFill = "most";

export const PLATE_DIAMETERS_CM: Record<PlateContainer, number> = {
  small_plate: 20,
  plate: 26,
  large_plate: 30,
};

export const BOWL_SIZES_CM: Record<BowlContainer, { diameter: number; depth: number }> = {
  small_bowl: { diameter: 12, depth: 5 },
  bowl: { diameter: 14, depth: 5.5 },
  large_bowl: { diameter: 18, depth: 7 },
};

/** The area food covers on a plate of this diameter, in cm2. */
export const plateWellArea = (diameterCm: number): number =>
  Math.PI * (PLATE_WELL_RADIUS_SHARE * (diameterCm / 2)) ** 2;

/** The volume of a bowl, in ml, as a spherical cap of this rim diameter and depth: V = pi h (3 a2 + h2) / 6. */
export const bowlVolume = (diameterCm: number, depthCm: number): number => {
  const rimRadius = diameterCm / 2;
  return (Math.PI * depthCm * (3 * rimRadius ** 2 + depthCm ** 2)) / 6;
};

export const isPlateContainer = (
  container: PortionEstimateContainer,
): container is PlateContainer =>
  container === "small_plate" || container === "plate" || container === "large_plate";

const wellAreaOf = (container: PlateContainer) => ({
  wellAreaSquareCm: plateWellArea(PLATE_DIAMETERS_CM[container]),
});
const volumeOf = (container: BowlContainer) => ({
  volumeMl: bowlVolume(BOWL_SIZES_CM[container].diameter, BOWL_SIZES_CM[container].depth),
});

/** The well area of each default plate, in cm2. */
export const PORTION_ESTIMATE_PLATES = {
  small_plate: wellAreaOf("small_plate"),
  plate: wellAreaOf("plate"),
  large_plate: wellAreaOf("large_plate"),
};

/** The volume of each default bowl, in ml. */
export const PORTION_ESTIMATE_BOWLS = {
  small_bowl: volumeOf("small_bowl"),
  bowl: volumeOf("bowl"),
  large_bowl: volumeOf("large_bowl"),
};
