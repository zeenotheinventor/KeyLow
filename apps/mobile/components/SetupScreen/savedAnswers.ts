import { SEXES } from "@keylow/core/engine";
import { DIET_STYLES, PROTEIN_G_PER_KG, PROTEIN_PRESETS } from "@keylow/core/setup";

import type { SetupState } from "@keylow/api-client";
import type { SetupDraft } from "@keylow/core/setup";

// The database keeps the sex and the diet as plain text, so a value is looked up in the wizard's own list and
// so comes back with the list's type, or not at all when the wizard does not offer it. The activity and the
// goal are database enums that already have the wizard's values.
const listed = <Item extends string>(
  items: readonly Item[],
  stored: string | null,
): Item | undefined => items.find((item) => item === stored);

/**
 * What the wizard starts from: the sex, birth date, height and activity on the profile, and the active
 * program's goal, rate, protein and diet. The weight and the units are the body step's. A fresh account has
 * none of them, so nothing is chosen.
 */
export function savedAnswersOf({ stats, program }: SetupState): SetupDraft {
  const sex = listed(SEXES, stats.sex);
  const dietStyle = listed(DIET_STYLES, program?.splitPreset ?? null);
  const proteinPreset = PROTEIN_PRESETS.find(
    (preset) => PROTEIN_G_PER_KG[preset] === program?.proteinGPerKg,
  );

  return {
    ...(sex === undefined ? {} : { sex }),
    ...(stats.birthDate === null ? {} : { birthDate: stats.birthDate }),
    ...(stats.heightCm === null ? {} : { heightCm: stats.heightCm }),
    ...(stats.activity === null ? {} : { activity: stats.activity }),
    ...(program === null ? {} : { goal: program.goal, ratePctPerWeek: program.ratePctPerWeek }),
    ...(proteinPreset === undefined ? {} : { proteinPreset }),
    ...(dietStyle === undefined ? {} : { dietStyle }),
  };
}
