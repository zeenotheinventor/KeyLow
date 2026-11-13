import { ACCOUNT_EXPORT_TABLES, ACCOUNT_EXPORT_VERSION, accountExportSchema } from "@keylow/core";

import type { Database } from "../database.types";
import type { AccountExport, AccountExportRow, AccountExportTable } from "@keylow/core";
import type { SupabaseClient } from "@supabase/supabase-js";

// The export is the person's whole health record. A row, a value or the database's own message (which
// can quote the row that failed) never reaches an error: a failure names the table and a code only,
// and nothing is attached as a cause.

/** The most rows PostgREST returns for one request (`max_rows` in `packages/db/supabase/config.toml`). */
const PAGE_SIZE = 1000;

/** `account` is the signed in user's own block, read before any table. */
type ExportFailureSource = AccountExportTable | "account";

/** A table, or the account block, could not be read into the export. Never carries a row or a value. */
export class AccountExportError extends Error {
  readonly table: ExportFailureSource;
  readonly code: string;

  constructor(table: ExportFailureSource, code: string) {
    super(`Could not export ${table} (${code})`);
    this.name = "AccountExportError";
    this.table = table;
    this.code = code;
  }
}

type RowOf<Table extends AccountExportTable> = Database["public"]["Tables"][Table]["Row"];

type ReadPlan<Table extends AccountExportTable> = {
  /** The column that holds the signed in user's id on this table. */
  ownerColumn: keyof RowOf<Table> & string;
  /** The primary key, so a page never skips or repeats a row. */
  orderColumns: (keyof RowOf<Table> & string)[];
};

// The owner column differs by table: the profile's own id, `owner_id` on the tables that also hold
// shared reference rows (and on recipes and the rows under them), `user_id` everywhere else. A child
// table with no owner column of its own would be scoped through its parent, and today none is: every
// child table below carries its own owner column, so each read is a direct filter.
const READ_PLANS: { [Table in AccountExportTable]: ReadPlan<Table> } = {
  profiles: { ownerColumn: "id", orderColumns: ["id"] },
  weigh_ins: { ownerColumn: "user_id", orderColumns: ["id"] },
  body_measurements: { ownerColumn: "user_id", orderColumns: ["id"] },
  food_log_entries: { ownerColumn: "user_id", orderColumns: ["id"] },
  day_logs: { ownerColumn: "user_id", orderColumns: ["user_id", "local_date"] },
  foods: { ownerColumn: "owner_id", orderColumns: ["id"] },
  food_portions: { ownerColumn: "owner_id", orderColumns: ["id"] },
  food_favourites: { ownerColumn: "owner_id", orderColumns: ["owner_id", "food_id"] },
  recipes: { ownerColumn: "owner_id", orderColumns: ["id"] },
  recipe_ingredients: { ownerColumn: "owner_id", orderColumns: ["id"] },
  recipe_favourites: { ownerColumn: "owner_id", orderColumns: ["owner_id", "recipe_id"] },
  shopping_list_items: { ownerColumn: "owner_id", orderColumns: ["id"] },
  programs: { ownerColumn: "user_id", orderColumns: ["id"] },
  expenditure_snapshots: { ownerColumn: "user_id", orderColumns: ["id"] },
  targets: { ownerColumn: "user_id", orderColumns: ["id"] },
  routines: { ownerColumn: "user_id", orderColumns: ["id"] },
  routine_days: { ownerColumn: "user_id", orderColumns: ["id"] },
  routine_exercises: { ownerColumn: "user_id", orderColumns: ["id"] },
  workout_sessions: { ownerColumn: "user_id", orderColumns: ["id"] },
  workout_sets: { ownerColumn: "user_id", orderColumns: ["id"] },
  training_goals: { ownerColumn: "user_id", orderColumns: ["id"] },
  accepted_suggestions: { ownerColumn: "user_id", orderColumns: ["id"] },
  exercises: { ownerColumn: "owner_id", orderColumns: ["id"] },
  exercise_muscles: { ownerColumn: "owner_id", orderColumns: ["id"] },
  assistant_conversations: { ownerColumn: "user_id", orderColumns: ["id"] },
  assistant_turns: { ownerColumn: "user_id", orderColumns: ["id"] },
  assistant_messages: { ownerColumn: "user_id", orderColumns: ["id"] },
  assistant_actions: { ownerColumn: "user_id", orderColumns: ["id"] },
  assistant_usage: { ownerColumn: "user_id", orderColumns: ["id"] },
  entitlements: { ownerColumn: "user_id", orderColumns: ["user_id", "feature"] },
  feature_requests: { ownerColumn: "user_id", orderColumns: ["created_at", "id"] },
  palate_preferences: { ownerColumn: "owner_id", orderColumns: ["id"] },
  meal_plans: { ownerColumn: "owner_id", orderColumns: ["id"] },
  meal_plan_days: { ownerColumn: "owner_id", orderColumns: ["id"] },
  meal_plan_items: { ownerColumn: "owner_id", orderColumns: ["id"] },
};

/**
 * Every row of one table that belongs to the user, as stored: all columns, soft-deleted rows included.
 * The owner filter is explicit on every table, on top of row-level security, because the select
 * policies of `foods`, `food_portions`, `exercises` and `exercise_muscles` also return the shared
 * reference rows. Read a page at a time, ordered by the key. A short page proves nothing, because the
 * server may cap a page below the size asked for, so the read goes on from where the last page ended
 * and stops only on an empty page. That costs one extra request per table and never cuts a table short.
 */
export async function readOwnRows<Table extends AccountExportTable>(
  client: SupabaseClient<Database>,
  userId: string,
  table: Table,
  ownerColumn: ReadPlan<Table>["ownerColumn"],
  orderColumns: ReadPlan<Table>["orderColumns"],
): Promise<AccountExportRow[]> {
  const rows: AccountExportRow[] = [];

  for (let offset = 0; ; offset = rows.length) {
    let query = client
      .from(table)
      .select("*")
      .match({ [ownerColumn]: userId });
    for (const column of orderColumns) {
      query = query.order(column, { ascending: true });
    }
    const { data, error } = await query.range(offset, offset + PAGE_SIZE - 1);

    if (error) {
      throw new AccountExportError(table, error.code || "unknown");
    }

    const page = accountExportSchema.shape.tables.shape[table].safeParse(data);
    if (!page.success) {
      throw new AccountExportError(table, "invalid_rows");
    }

    if (page.data.length === 0) {
      return rows;
    }

    rows.push(...page.data);
  }
}

/** One table read with its own plan, so the columns are checked against that table. */
async function readPlannedTable<Table extends AccountExportTable>(
  client: SupabaseClient<Database>,
  userId: string,
  table: Table,
): Promise<{ table: Table; rows: AccountExportRow[] }> {
  const { ownerColumn, orderColumns } = READ_PLANS[table];
  return { table, rows: await readOwnRows(client, userId, table, ownerColumn, orderColumns) };
}

async function* readTables(
  client: SupabaseClient<Database>,
  userId: string,
): AsyncGenerator<{ table: AccountExportTable; rows: AccountExportRow[] }> {
  for (const table of ACCOUNT_EXPORT_TABLES) {
    yield await readPlannedTable(client, userId, table);
  }
}

async function readSignedInUser(client: SupabaseClient<Database>) {
  const { data, error } = await client.auth.getUser();

  if (error) {
    throw new AccountExportError("account", error.code ?? "unknown");
  }

  return data.user;
}

/**
 * The tables of the signed in user one at a time, in schema order, so a screen can write the file
 * table by table and never hold the whole export in memory.
 */
export async function* readMyDataByTable(
  client: SupabaseClient<Database>,
): AsyncGenerator<{ table: AccountExportTable; rows: AccountExportRow[] }> {
  const user = await readSignedInUser(client);
  yield* readTables(client, user.id);
}

/**
 * Everything the signed in user owns, read under their own JWT and checked against core's
 * `accountExportSchema`. The tables are read one after another, not in one transaction, so a row
 * written while the export runs may or may not appear.
 */
export async function exportMyData(client: SupabaseClient<Database>): Promise<AccountExport> {
  const user = await readSignedInUser(client);

  const tables: Record<string, AccountExportRow[]> = {};
  for await (const { table, rows } of readTables(client, user.id)) {
    tables[table] = rows;
  }

  const providers = [...new Set((user.identities ?? []).map((identity) => identity.provider))];
  const checked = accountExportSchema.safeParse({
    export_version: ACCOUNT_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    account: {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at ?? null,
      providers,
    },
    tables,
  });

  if (!checked.success) {
    throw new AccountExportError("account", "invalid_export");
  }

  return checked.data;
}
