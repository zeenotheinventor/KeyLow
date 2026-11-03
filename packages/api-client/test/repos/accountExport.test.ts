import { ACCOUNT_EXPORT_TABLES, accountExportSchema } from "@keylow/core";
import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  AccountExportError,
  exportMyData,
  readMyDataByTable,
  readOwnRows,
} from "../../src/repos/accountExport";
import { createTestClient } from "../createTestClient";
import {
  AUTH_USER_URL,
  REST_URL,
  SIGNED_IN_USER_ID,
  postgrestError,
  signInAs,
} from "../support/postgrest";

import type { AccountExportTable } from "@keylow/core";

const server = setupServer();

// A weight and a database message nobody would pick by chance, to look for in a thrown error.
const RECOGNISABLE_WEIGHT = 81.234;
const RECOGNISABLE_DATABASE_MESSAGE = "key707-recognisable-database-message";

const authUser = {
  id: SIGNED_IN_USER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "someone@keylow.test",
  created_at: "2026-10-01T09:00:00.123456Z",
  last_sign_in_at: "2026-11-03T08:00:00.5Z",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: {},
  identities: [{ provider: "email", identity_data: { email: "someone@keylow.test" } }],
};

type RestRequest = { table: string; url: URL };
let restRequests: RestRequest[];

/** Every table answers an empty list, unless a test gives it rows. */
function answerTables(rowsByTable: Partial<Record<AccountExportTable, (url: URL) => unknown[]>>) {
  server.use(
    ...ACCOUNT_EXPORT_TABLES.map((table) =>
      http.get(`${REST_URL}/${table}`, ({ request }) => {
        const url = new URL(request.url);
        restRequests.push({ table, url });
        return HttpResponse.json(rowsByTable[table]?.(url) ?? []);
      }),
    ),
  );
}

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
beforeEach(() => {
  restRequests = [];
  server.use(http.get(AUTH_USER_URL, () => HttpResponse.json(authUser)));
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

async function signedInClient() {
  const client = createTestClient();
  await signInAs(client, SIGNED_IN_USER_ID);
  return client;
}

const weighInRows = (count: number, offset: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-4000-8000-${String(offset + index).padStart(12, "0")}`,
    weight_kg: RECOGNISABLE_WEIGHT,
    deleted_at: null,
  }));

const pageOf = (url: URL, total: number) => {
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 1000);
  return weighInRows(Math.max(0, Math.min(limit, total - offset)), offset);
};

describe("readOwnRows", () => {
  it("should read every column of the rows of the owner, with the owner filter and a stable order", async () => {
    answerTables({ weigh_ins: () => weighInRows(2, 0) });

    const rows = await readOwnRows(
      await signedInClient(),
      SIGNED_IN_USER_ID,
      "weigh_ins",
      "user_id",
      ["id"],
    );

    expect(rows).toHaveLength(2);
    const { url } = restRequests[0] ?? {};
    expect(url?.searchParams.get("select")).toBe("*");
    expect(url?.searchParams.get("user_id")).toBe(`eq.${SIGNED_IN_USER_ID}`);
    expect(url?.searchParams.get("order")).toBe("id.asc");
  });

  it("should not filter out soft-deleted rows", async () => {
    answerTables({});

    await readOwnRows(await signedInClient(), SIGNED_IN_USER_ID, "weigh_ins", "user_id", ["id"]);

    expect(restRequests[0]?.url.searchParams.has("deleted_at")).toBe(false);
  });

  it("should order by every key column when the key is composite", async () => {
    answerTables({});

    await readOwnRows(await signedInClient(), SIGNED_IN_USER_ID, "day_logs", "user_id", [
      "user_id",
      "local_date",
    ]);

    expect(restRequests[0]?.url.searchParams.get("order")).toBe("user_id.asc,local_date.asc");
  });

  it("should read a table in pages until a page comes back short, and join them", async () => {
    answerTables({ weigh_ins: (url) => pageOf(url, 2001) });

    const rows = await readOwnRows(
      await signedInClient(),
      SIGNED_IN_USER_ID,
      "weigh_ins",
      "user_id",
      ["id"],
    );

    expect(rows).toHaveLength(2001);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2001);
    expect(restRequests.map(({ url }) => url.searchParams.get("offset"))).toEqual([
      "0",
      "1000",
      "2000",
    ]);
  });

  it("should ask for one more page when the last page is exactly full", async () => {
    answerTables({ weigh_ins: (url) => pageOf(url, 1000) });

    const rows = await readOwnRows(
      await signedInClient(),
      SIGNED_IN_USER_ID,
      "weigh_ins",
      "user_id",
      ["id"],
    );

    expect(rows).toHaveLength(1000);
    expect(restRequests).toHaveLength(2);
  });
});

describe("readMyDataByTable", () => {
  it("should yield every table once, in schema order, each filtered to the signed in user", async () => {
    answerTables({ weigh_ins: () => weighInRows(1, 0) });

    const tables: AccountExportTable[] = [];
    const rowCounts: Record<string, number> = {};
    for await (const { table, rows } of readMyDataByTable(await signedInClient())) {
      tables.push(table);
      rowCounts[table] = rows.length;
    }

    expect(tables).toEqual([...ACCOUNT_EXPORT_TABLES]);
    expect(rowCounts.weigh_ins).toBe(1);
    expect(rowCounts.profiles).toBe(0);
    for (const { table, url } of restRequests) {
      const ownerFilters = [...url.searchParams.entries()].filter(
        ([, value]) => value === `eq.${SIGNED_IN_USER_ID}`,
      );
      expect(ownerFilters, table).toHaveLength(1);
    }
  });

  it("should filter the profile by its id and the shared tables by owner_id", async () => {
    answerTables({});

    for await (const { table } of readMyDataByTable(await signedInClient())) {
      expect(table).toBeTruthy();
    }

    const ownerColumnOf = (table: string) =>
      [...(restRequests.find((request) => request.table === table)?.url.searchParams ?? [])]
        .filter(([, value]) => value === `eq.${SIGNED_IN_USER_ID}`)
        .map(([key]) => key);
    expect(ownerColumnOf("profiles")).toEqual(["id"]);
    expect(ownerColumnOf("foods")).toEqual(["owner_id"]);
    expect(ownerColumnOf("food_portions")).toEqual(["owner_id"]);
    expect(ownerColumnOf("exercises")).toEqual(["owner_id"]);
    expect(ownerColumnOf("exercise_muscles")).toEqual(["owner_id"]);
    expect(ownerColumnOf("assistant_messages")).toEqual(["user_id"]);
  });
});

describe("exportMyData", () => {
  it("should return an object that the account export schema accepts", async () => {
    answerTables({ weigh_ins: () => weighInRows(3, 0) });

    const data = await exportMyData(await signedInClient());

    expect(accountExportSchema.safeParse(data).success).toBe(true);
    expect(data.export_version).toBe(1);
    expect(data.tables.weigh_ins).toHaveLength(3);
    expect(Object.keys(data.tables)).toEqual([...ACCOUNT_EXPORT_TABLES]);
  });

  it("should hold the account block from the auth user and nothing else of the session", async () => {
    answerTables({});

    const data = await exportMyData(await signedInClient());

    expect(data.account).toEqual({
      id: SIGNED_IN_USER_ID,
      email: "someone@keylow.test",
      created_at: "2026-10-01T09:00:00.123456Z",
      last_sign_in_at: "2026-11-03T08:00:00.5Z",
      providers: ["email"],
    });
    expect(Date.parse(data.exported_at)).not.toBeNaN();
    expect(JSON.stringify(data)).not.toContain("test-refresh-token");
  });

  it("should give a user who never signed in a null last sign in time and no email", async () => {
    answerTables({});
    server.use(
      http.get(AUTH_USER_URL, () =>
        HttpResponse.json({ ...authUser, email: undefined, last_sign_in_at: undefined }),
      ),
    );

    const data = await exportMyData(await signedInClient());

    expect(data.account.email).toBeNull();
    expect(data.account.last_sign_in_at).toBeNull();
  });
});

describe("a failed export", () => {
  /** What a rejected call throws, or null when it did not reject. */
  const rejectionOf = async (call: Promise<unknown>): Promise<unknown> => {
    try {
      await call;
    } catch (error) {
      return error;
    }
    return null;
  };

  it("should name the table and the code and carry no row value or database message", async () => {
    answerTables({ weigh_ins: () => weighInRows(1, 0) });
    server.use(
      http.get(`${REST_URL}/food_log_entries`, () =>
        postgrestError(500, "XX000", RECOGNISABLE_DATABASE_MESSAGE, {
          details: `Failing row contains (${RECOGNISABLE_WEIGHT})`,
        }),
      ),
    );

    const error = await rejectionOf(exportMyData(await signedInClient()));

    expect(error).toBeInstanceOf(AccountExportError);
    expect(error).toMatchObject({ table: "food_log_entries", code: "XX000" });
    const text = JSON.stringify({
      message: error instanceof Error ? error.message : "",
      name: error instanceof Error ? error.name : "",
      cause: error instanceof Error ? error.cause : null,
      own: error,
    });
    expect(text).not.toContain(RECOGNISABLE_DATABASE_MESSAGE);
    expect(text).not.toContain(String(RECOGNISABLE_WEIGHT));
    expect(text).toContain("food_log_entries");
    expect(text).toContain("XX000");
  });

  it("should stop at the first table that fails", async () => {
    answerTables({});
    server.use(http.get(`${REST_URL}/weigh_ins`, () => postgrestError(403, "42501", "denied")));

    await rejectionOf(exportMyData(await signedInClient()));

    expect(restRequests.map(({ table }) => table)).not.toContain("recipes");
  });

  it("should name the account when the signed in user cannot be read", async () => {
    answerTables({});
    const client = await signedInClient();
    server.use(
      http.get(AUTH_USER_URL, () => HttpResponse.json({ message: "no session" }, { status: 401 })),
    );

    const error = await rejectionOf(exportMyData(client));

    expect(error).toMatchObject({ name: "AccountExportError", table: "account" });
    expect(restRequests).toHaveLength(0);
  });

  it("should name the table whose rows are not valid JSON objects", async () => {
    answerTables({});
    server.use(http.get(`${REST_URL}/recipes`, () => HttpResponse.json(["not a row"])));

    const error = await rejectionOf(exportMyData(await signedInClient()));

    expect(error).toMatchObject({ table: "recipes", code: "invalid_rows" });
  });
});
