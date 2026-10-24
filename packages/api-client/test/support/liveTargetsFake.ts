import { http } from "msw";

import { REST_URL, postgrestRows } from "./postgrest";

// A fake of the two tables the live targets read comes from. Each handler only filters the way the
// repo asks it to (`ended_on is null`, `effective_to is null`), so a read that forgets the filter sees
// the ended program or the closed row and a test notices.

export const ACTIVE_PROGRAM_ID = "44444444-4444-4444-8444-444444444444";

export type FakeProgram = { id: string; started_on: string; ended_on: string | null };

export type FakeTargetsRow = {
  program_id: string | null;
  calories_kcal: number;
  protein_g: number;
  fat_g: number;
  carbs_g: number;
  dow_calories_kcal: number[];
  effective_to: string | null;
};

export const ENDED_PROGRAM_ID = "55555555-5555-4555-8555-555555555555";

export const activeProgram: FakeProgram = {
  id: ACTIVE_PROGRAM_ID,
  started_on: "2026-10-01",
  ended_on: null,
};
export const endedProgram: FakeProgram = {
  id: ENDED_PROGRAM_ID,
  started_on: "2026-09-01",
  ended_on: "2026-10-20",
};

// Monday first. Saturday (index 5) is the low day, as a user who eats lighter at the weekend has.
export const engineRow: FakeTargetsRow = {
  program_id: ACTIVE_PROGRAM_ID,
  calories_kcal: 2140,
  protein_g: 126,
  fat_g: 73,
  carbs_g: 245,
  dow_calories_kcal: [2200, 2200, 2200, 2200, 2200, 1900, 2100],
  effective_to: null,
};

export const closedEngineRow: FakeTargetsRow = { ...engineRow, effective_to: "2026-10-19" };

export const profileTargetsRow = {
  target_kcal: 2200,
  target_protein_g: 160,
  target_carbs_g: 220,
  target_fat_g: 70,
};

const asksForOpenRows = (request: Request, column: string) =>
  new URL(request.url).searchParams.get(column) === "is.null";

export const programsRead = (rows: readonly FakeProgram[]) =>
  http.get(`${REST_URL}/programs`, ({ request }) =>
    postgrestRows(
      request,
      asksForOpenRows(request, "ended_on") ? rows.filter((row) => row.ended_on === null) : rows,
    ),
  );

export const targetsRead = (rows: readonly FakeTargetsRow[]) =>
  http.get(`${REST_URL}/targets`, ({ request }) =>
    postgrestRows(
      request,
      asksForOpenRows(request, "effective_to")
        ? rows.filter((row) => row.effective_to === null)
        : rows,
    ),
  );

export const profileTargetsRead = http.get(`${REST_URL}/profiles`, ({ request }) =>
  postgrestRows(request, [profileTargetsRow]),
);
