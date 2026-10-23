import type { PostgrestError } from "@supabase/supabase-js";

const FOREIGN_KEY_VIOLATION = "23503";
const INSUFFICIENT_PRIVILEGE = "42501";
// The default name Postgres gives a foreign key on a `portion_id` column, on `food_log_entries` and on `recipe_ingredients`.
const PORTION_FOREIGN_KEY_SUFFIX = "_portion_id_fkey";

/**
 * Whether the database refused a write because the portion it carried no longer exists. A refresh of a
 * branded food deletes its portions and inserts new ones, so a screen opened before it can still hold an old id.
 * The foreign key says so (23503, naming the `portion_id` key), but the insert and update policies check the portion
 * first and refuse a portion that is not there with 42501, so that counts too. Only the code and the name of
 * the constraint are read, because the rest of an error can quote the row.
 */
export function isDeadPortionRefusal({ code, message }: PostgrestError): boolean {
  return (
    code === INSUFFICIENT_PRIVILEGE ||
    (code === FOREIGN_KEY_VIOLATION && message.includes(PORTION_FOREIGN_KEY_SUFFIX))
  );
}

/**
 * Runs a write that carries `portionId`, and when the database refuses it for a portion that is gone,
 * runs it once more with no portion. The snapshot of an entry keeps the label and the amount, so nothing
 * is lost (ADR 0003, Amendment 2). A write with no portion, and any other refusal, is not repeated, and the
 * answer of the second write is returned as it is, so a repeat that fails is reported like any failure.
 */
export async function writeWithoutDeadPortion<Result extends { error: PostgrestError | null }>(
  portionId: string | null,
  write: (portionId: string | null) => PromiseLike<Result>,
): Promise<Result> {
  const result = await write(portionId);

  if (portionId !== null && result.error !== null && isDeadPortionRefusal(result.error)) {
    return write(null);
  }

  return result;
}
