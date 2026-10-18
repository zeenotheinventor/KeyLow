// Column order of the files in data/exercises. The importer (a later ticket) reads them by these names.
export const CURATED_COLUMNS = [
  "source_ref",
  "name",
  "equipment",
  "mechanic",
  "muscles",
  "override_note",
] as const;

export const EXCLUDED_COLUMNS = ["source_ref", "name", "category", "reason"] as const;

export const OVERRIDE_COLUMNS = ["source_ref", "action", "muscles", "note"] as const;

export const MECHANICS = ["compound", "isolation"] as const;

export type Mechanic = (typeof MECHANICS)[number];

/** The `equipment` enum of ADR 0005 Amendment 1, which the import writes into. */
export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "kettlebell",
  "cable",
  "machine",
  "smith_machine",
  "ez_bar",
  "band",
  "bodyweight",
  "other",
] as const;

export type Equipment = (typeof EQUIPMENT)[number];
