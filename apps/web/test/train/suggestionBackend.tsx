import { trainBackend } from "./support";
import { goldenLibraryRows } from "../../../../packages/api-client/test/support/goldenLibraryRows";
import {
  goldenSessions,
  goldenSets,
  goldenRoutine as goldenWeekRoutine,
} from "../../../../packages/api-client/test/support/goldenWeekRows";
import {
  trainingGoalsRow,
  vTaperAnswers,
} from "../../../../packages/api-client/test/support/trainingGoals";

type Row = Record<string, unknown>;

/*
 * The tables behind the suggestion card, served to the real api-client through the Train page's fake fetch:
 * the golden week (KEY-353) and its library, the V-taper goal the golden suggestion is worked out for, and
 * the accepted suggestions with the rules of the table (one live row a day, a soft delete for Undo). The
 * rows are the api-client tests' own, so the card is tested on the suggestion core pins.
 */

export const suggestionBackend: {
  /** The current goal row, or null for no goal. */
  goal: Row | null;
  /** The accepted suggestions, live and soft deleted. */
  accepted: Row[];
  /** The bodies of the rows inserted, in order. */
  inserted: Row[];
  /** The ids soft deleted by an Undo or a replace, in order. */
  softDeleted: string[];
  /** The reads of each table, in order, so a test can tell a read that was never made. */
  reads: string[];
  /** Fails the writes, as a database that is down does. */
  failingWrites: boolean;
  /** Fails the reads of the accepted suggestions. */
  failingAcceptedReads: boolean;
  /** Never answers the reads of the accepted suggestions. */
  hangingAcceptedReads: boolean;
  /** Holds every write until it settles. A test opens it by resolving it. */
  writeGate: Promise<void> | null;
} = {
  goal: null,
  accepted: [],
  inserted: [],
  softDeleted: [],
  reads: [],
  failingWrites: false,
  failingAcceptedReads: false,
  hangingAcceptedReads: false,
  writeGate: null,
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const serverError = () =>
  json({ code: "XX000", message: "database unavailable", details: null, hint: null }, 500);

/** One row for a read that asks for one object, and the rows otherwise, as PostgREST answers. */
function answer(request: Request, rows: Row[], status = 200): Response {
  if (request.headers.get("accept")?.includes("vnd.pgrst.object") !== true) {
    return json(rows, status);
  }
  const [row] = rows;
  return row === undefined
    ? json({ code: "PGRST116", message: "no row", details: null, hint: null }, 406)
    : json(row, status);
}

/** The values of a PostgREST filter such as `local_date=gte.2026-10-12`. */
const filterValues = (url: URL, column: string, operator: string): string[] =>
  url.searchParams
    .getAll(column)
    .filter((value) => value.startsWith(`${operator}.`))
    .map((value) => value.slice(operator.length + 1));

function matching(url: URL): Row[] {
  const ids = filterValues(url, "id", "eq");
  const dates = filterValues(url, "local_date", "eq");
  const from = filterValues(url, "local_date", "gte");
  const to = filterValues(url, "local_date", "lte");
  const isLive = filterValues(url, "deleted_at", "is").includes("null");
  return suggestionBackend.accepted.filter(
    (row) =>
      ids.every((id) => row["id"] === id) &&
      dates.every((date) => row["local_date"] === date) &&
      from.every((first) => String(row["local_date"]) >= first) &&
      to.every((last) => String(row["local_date"]) <= last) &&
      (!isLive || row["deleted_at"] === null),
  );
}

const isRow = (value: unknown): value is Row => typeof value === "object" && value !== null;

let created = 0;

async function acceptedWrite(request: Request, url: URL): Promise<Response> {
  const body: unknown = await request.json();
  await suggestionBackend.writeGate;
  if (suggestionBackend.failingWrites) {
    return serverError();
  }
  if (request.method === "POST") {
    const inserted = isRow(body) ? body : {};
    suggestionBackend.inserted.push(inserted);
    created += 1;
    const stored = {
      id: `66666666-6666-4666-8666-${(0xa00000000000 + created).toString(16)}`,
      deleted_at: null,
      ...inserted,
    };
    suggestionBackend.accepted.push(stored);
    return answer(request, [stored], 201);
  }
  const changed = matching(url);
  for (const row of changed) {
    Object.assign(row, isRow(body) ? body : {});
    suggestionBackend.softDeleted.push(String(row["id"]));
  }
  return answer(request, changed);
}

function respond(request: Request, url: URL): Response | Promise<Response> | null {
  const { pathname, searchParams } = url;
  if (pathname.endsWith("/accepted_suggestions")) {
    if (request.method !== "GET") {
      return acceptedWrite(request, url);
    }
    suggestionBackend.reads.push("accepted_suggestions");
    if (suggestionBackend.hangingAcceptedReads) {
      return new Promise<Response>(() => undefined);
    }
    return suggestionBackend.failingAcceptedReads
      ? serverError()
      : answer(
          request,
          [...matching(url)].sort((first, second) =>
            String(first["local_date"]).localeCompare(String(second["local_date"])),
          ),
        );
  }
  if (pathname.endsWith("/training_goals")) {
    suggestionBackend.reads.push("training_goals");
    return answer(request, suggestionBackend.goal === null ? [] : [suggestionBackend.goal]);
  }
  // The library read asks for the exercises of the goal's equipment, the other exercise reads do not.
  const equipment = searchParams.get("equipment");
  if (pathname.endsWith("/exercises") && equipment?.startsWith("in.(") === true) {
    suggestionBackend.reads.push("library");
    const wanted = equipment.slice(4, -1).split(",");
    return answer(
      request,
      goldenLibraryRows.filter((row) => wanted.includes(row.equipment)),
    );
  }
  // The heat read: the sets of the last days, with their sessions joined to filter on.
  if (
    pathname.endsWith("/workout_sets") &&
    request.method === "GET" &&
    (searchParams.get("select") ?? "").includes("workout_sessions!inner")
  ) {
    return answer(request, goldenSets);
  }
  return null;
}

/** Puts the golden Wednesday behind the Train page's fake: the golden week and routine, and the V-taper goal. */
export function installGoldenSuggestionBackend(): void {
  suggestionBackend.goal = trainingGoalsRow(vTaperAnswers);
  suggestionBackend.accepted = [];
  suggestionBackend.inserted = [];
  suggestionBackend.softDeleted = [];
  suggestionBackend.reads = [];
  suggestionBackend.failingWrites = false;
  suggestionBackend.failingAcceptedReads = false;
  suggestionBackend.hangingAcceptedReads = false;
  suggestionBackend.writeGate = null;
  trainBackend.routine = goldenWeekRoutine;
  trainBackend.everLogged = true;
  trainBackend.weekSessions = goldenSessions;
  trainBackend.extraRoute = respond;
}
