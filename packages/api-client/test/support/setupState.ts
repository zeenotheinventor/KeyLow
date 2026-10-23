import { http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";

import type { Database } from "../../src/database.types";
import type { SetupServer } from "msw/node";

/** A weight no test would pick by chance, to look for in an error message and in the console. */
export const RECOGNISABLE_SETUP_WEIGHT = 83.417;
export const RECOGNISABLE_SETUP_HEIGHT = 183.4;
export const RECOGNISABLE_SETUP_BIRTH_DATE = "1987-03-09";

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "sex" | "birth_date" | "height_cm" | "activity" | "weight_unit" | "onboarding_completed_at"
>;

type ProgramRow = Pick<
  Database["public"]["Tables"]["programs"]["Row"],
  | "id"
  | "goal"
  | "rate_pct_per_week"
  | "protein_g_per_kg"
  | "fat_fraction_of_remaining"
  | "split_preset"
  | "ended_on"
>;

type WeighInRow = {
  id: string;
  weight_kg: number;
  local_date: string;
  measured_at: string;
  deleted_at: string | null;
};

export const freshProfileRow: ProfileRow = {
  sex: null,
  birth_date: null,
  height_cm: null,
  activity: null,
  weight_unit: null,
  onboarding_completed_at: null,
};

export const setUpProfileRow: ProfileRow = {
  sex: "female",
  birth_date: RECOGNISABLE_SETUP_BIRTH_DATE,
  height_cm: RECOGNISABLE_SETUP_HEIGHT,
  activity: "moderate",
  weight_unit: "kg",
  onboarding_completed_at: "2026-10-20T09:00:00+00:00",
};

export const programRow = (overrides: Partial<ProgramRow> = {}): ProgramRow => ({
  id: "66666666-6666-4666-8666-666666666666",
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 2,
  fat_fraction_of_remaining: 0.3,
  split_preset: "balanced",
  ended_on: null,
  ...overrides,
});

let weighInCounter = 0;

export const setupWeighInRow = (overrides: Partial<WeighInRow> = {}): WeighInRow => {
  weighInCounter += 1;
  return {
    id: `77777777-7777-4777-8777-${weighInCounter.toString(16).padStart(12, "0")}`,
    weight_kg: 81.2,
    local_date: "2026-10-23",
    measured_at: "2026-10-23T07:30:00+00:00",
    deleted_at: null,
    ...overrides,
  };
};

type SetupFake = {
  profiles: ProfileRow[];
  programs: ProgramRow[];
  weighIns: WeighInRow[];
};

type RecordedRequest = { table: string; url: URL };

/**
 * A stand-in for the three tables the setup read touches, behind MSW. It honours only the filters the
 * read is meant to send: `ended_on is null` on programs, `deleted_at is null` on weigh-ins, and the
 * `order` and `limit` of the weigh-in read. A read that leaves one out gets rows it should not, so a
 * test sees the missing filter. `failWith` makes the next requests to one table fail with a code.
 */
export function installSetupFake(server: SetupServer, fake: Partial<SetupFake> = {}) {
  const tables: SetupFake = { profiles: [], programs: [], weighIns: [], ...fake };
  const requests: RecordedRequest[] = [];
  const failures = new Map<string, string>();

  const answer = (table: string, request: Request, rows: readonly unknown[]) => {
    requests.push({ table, url: new URL(request.url) });
    const code = failures.get(table);
    return code === undefined
      ? postgrestRows(request, rows)
      : postgrestError(500, code, `a value of ${RECOGNISABLE_SETUP_WEIGHT} was refused`);
  };

  server.use(
    http.get(`${REST_URL}/profiles`, ({ request }) => answer("profiles", request, tables.profiles)),
    http.get(`${REST_URL}/programs`, ({ request }) => {
      const activeOnly = new URL(request.url).searchParams.get("ended_on") === "is.null";
      const rows = tables.programs.filter((row) => !activeOnly || row.ended_on === null);
      return answer("programs", request, rows);
    }),
    http.get(`${REST_URL}/weigh_ins`, ({ request }) => {
      const { searchParams } = new URL(request.url);
      const liveOnly = searchParams.get("deleted_at") === "is.null";
      const order = (searchParams.get("order") ?? "").split(",").filter(Boolean);
      const limit = Number(searchParams.get("limit") ?? Number.POSITIVE_INFINITY);
      const rows = tables.weighIns
        .filter((row) => !liveOnly || row.deleted_at === null)
        .sort((first, second) => {
          for (const clause of order) {
            const [column, direction] = clause.split(".");
            if (column === "local_date" || column === "measured_at" || column === "id") {
              const difference = first[column].localeCompare(second[column]);
              if (difference !== 0) {
                return direction === "desc" ? -difference : difference;
              }
            }
          }
          return 0;
        })
        .slice(0, limit);
      return answer("weigh_ins", request, rows);
    }),
  );

  return {
    requests,
    failWith: (table: string, code: string) => failures.set(table, code),
  };
}
