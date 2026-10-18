import { checkCurated } from "./checkCurated";
import { isEquipment, isMechanic } from "./columns";
import { isMuscleId, isRole } from "./muscles";
import { parseMuscleShares } from "./muscleShares";
import { parseCsv } from "../cofid/csv";

import type { ImportExercise } from "./importExercise";

/**
 * Reads the curated CSV into exercises, after the checker has passed it. A failing file is refused
 * with the rule and the line of each problem and nothing else, because the checker's own messages
 * quote names, muscles and weights and the import never writes those into an error or a log line.
 */
export function readCuratedExercises(csv: string): ImportExercise[] {
  const problems = checkCurated(csv);
  if (problems.length > 0) {
    const details = problems.map(
      ({ rule, line }) => `  ${line === undefined ? "the file" : `line ${line}`}: ${rule}`,
    );
    throw new Error(
      `The curated CSV fails ${problems.length} checks, so nothing was written:\n${details.join("\n")}`,
    );
  }

  const [, ...rows] = parseCsv(csv);
  return rows.map(([sourceRef = "", name = "", equipment = "", mechanic = "", muscles = ""]) => {
    if (!isEquipment(equipment) || !isMechanic(mechanic)) {
      throw new Error("The checker passed a row whose equipment or mechanic is not in its list");
    }
    return {
      sourceRef,
      name,
      equipment,
      mechanic,
      muscles: parseMuscleShares(muscles).map(({ muscle, role, weight }) => {
        if (!isMuscleId(muscle) || !isRole(role)) {
          throw new Error("The checker passed a row whose muscle or role is not in its list");
        }
        return { muscleId: muscle, role, weight: Number(weight) };
      }),
    };
  });
}
