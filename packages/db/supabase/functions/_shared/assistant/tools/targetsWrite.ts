// What `update_targets` reads around its write: the instants it compares to tell whether the person changed
// their targets or the program since. Both are stamps the repo writes in one call (`updateMyTargets` gives
// the profile's `targets_updated_at` and the ended program's `updated_at` the same instant), so one stamp
// on the action covers both. The reads are the person's own rows, and the stamps carry no health value.
import type { ToolContext } from "../tool.ts";

export const sameInstant = (first: string, second: string): boolean =>
  Date.parse(first) === Date.parse(second);

// The instant the person's targets were last saved, or null when they never were. Row level security shows
// the signed in person's own profile row only.
export async function readTargetsStamp(ctx: ToolContext): Promise<string | null> {
  const { data, error } = await ctx.caller
    .from("profiles")
    .select("targets_updated_at")
    .maybeSingle();
  if (error) {
    // The database's message can quote a row, so only its code is kept.
    throw new Error(`Could not read the targets stamp ${error.code}`);
  }
  return data?.targets_updated_at ?? null;
}

export type ProgramStamp = { endedOn: string | null; updatedAt: string };

// A program of the person's, or null when there is none with that id.
export async function readProgramStamp(
  ctx: ToolContext,
  programId: string,
): Promise<ProgramStamp | null> {
  const { data, error } = await ctx.caller
    .from("programs")
    .select("ended_on,updated_at")
    .eq("id", programId)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not read the program stamp ${error.code}`);
  }
  return data === null ? null : { endedOn: data.ended_on, updatedAt: data.updated_at };
}

// The id of the person's active programme, or null when they have none. Reads one column of one table, so
// a stored plan that this code does not know cannot stop the targets being saved.
export async function readActiveProgramId(ctx: ToolContext): Promise<string | null> {
  const { data, error } = await ctx.caller
    .from("programs")
    .select("id")
    .is("ended_on", null)
    .maybeSingle();
  if (error) {
    throw new Error(`Could not read the active program ${error.code}`);
  }
  return data?.id ?? null;
}
