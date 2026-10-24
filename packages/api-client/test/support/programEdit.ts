import { HttpResponse, http } from "msw";

import { REST_URL, postgrestError, postgrestRows } from "./postgrest";
import { RECOGNISABLE_SETUP_BIRTH_DATE, RECOGNISABLE_SETUP_WEIGHT } from "./setupState";

import type { EdgeErrorCode } from "@keylow/core/schemas";
import type { SetupServer } from "msw/node";

export const RUN_CHECKIN_URL = "http://127.0.0.1:54321/functions/v1/run-checkin";
export const RECOMPUTED_TARGETS_ID = "99999999-9999-4999-8999-0000000000c1";

type RecordedCall = {
  name: "GET profiles" | "PATCH programs" | "POST run-checkin";
  search: URLSearchParams;
  body: Record<string, unknown> | undefined;
};

type StoredProgram = { id: string; ended_on: string | null; [column: string]: unknown };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * A stand-in for the requests `updateMyProgram` makes, behind MSW: the profile read for the birth date, the
 * update of the active program and the `run-checkin` recompute. Every call is recorded in order with its
 * query string and body. A refused request's message quotes the weight, as a real one can, so a test can
 * look for it in what is thrown. `recomputeRefusedWith` makes the function answer an edge error.
 */
export function installProgramEditFake(
  server: SetupServer,
  {
    programs = [{ id: "88888888-8888-4888-8888-888888888801", ended_on: null }],
    birthDate = RECOGNISABLE_SETUP_BIRTH_DATE,
  }: { programs?: StoredProgram[]; birthDate?: string | null } = {},
) {
  const calls: RecordedCall[] = [];
  const failures = new Map<RecordedCall["name"], string>();
  let recomputeRefusal: { status: number; code: EdgeErrorCode } | null = null;
  const storedPrograms = [...programs];

  const record = async (request: Request, name: RecordedCall["name"]) => {
    const parsed: unknown = request.method === "GET" ? undefined : await request.clone().json();
    const call: RecordedCall = {
      name,
      search: new URL(request.url).searchParams,
      body: isRecord(parsed) ? parsed : undefined,
    };
    calls.push(call);
    return call;
  };

  const failureOf = (name: RecordedCall["name"]) => {
    const code = failures.get(name);
    return code === undefined
      ? null
      : postgrestError(400, code, `a value of ${RECOGNISABLE_SETUP_WEIGHT} was refused`);
  };

  server.use(
    http.get(`${REST_URL}/profiles`, async ({ request }) => {
      await record(request, "GET profiles");
      return failureOf("GET profiles") ?? postgrestRows(request, [{ birth_date: birthDate }]);
    }),
    http.patch(`${REST_URL}/programs`, async ({ request }) => {
      const call = await record(request, "PATCH programs");
      const failed = failureOf("PATCH programs");
      if (failed !== null) {
        return failed;
      }
      const activeOnly = call.search.get("ended_on") === "is.null";
      const matching = storedPrograms.filter((row) => !activeOnly || row.ended_on === null);
      for (const row of matching) {
        Object.assign(row, call.body);
      }
      return postgrestRows(
        request,
        matching.map(({ id }) => ({ id })),
      );
    }),
    http.post(RUN_CHECKIN_URL, async ({ request }) => {
      await record(request, "POST run-checkin");
      if (recomputeRefusal !== null) {
        return HttpResponse.json(
          { error: { code: recomputeRefusal.code, message: "Refused" } },
          { status: recomputeRefusal.status },
        );
      }
      return HttpResponse.json({ targetsId: RECOMPUTED_TARGETS_ID });
    }),
  );

  return {
    calls,
    programs: storedPrograms,
    failWith: (name: "GET profiles" | "PATCH programs", code: string) => {
      failures.set(name, code);
    },
    recomputeRefusedWith: (status: number, code: EdgeErrorCode) => {
      recomputeRefusal = { status, code };
    },
    /** The calls as `METHOD target`, in the order they were made. */
    order: () => calls.map((call) => call.name),
    bodyOf: (name: RecordedCall["name"]) => calls.find((call) => call.name === name)?.body,
    searchOf: (name: RecordedCall["name"]) => calls.find((call) => call.name === name)?.search,
  };
}
