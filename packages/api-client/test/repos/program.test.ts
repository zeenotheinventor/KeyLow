import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import {
  getMyProgramSummary,
  listMyExpenditureSnapshots,
  listMyTargetsHistory,
} from "../../src/repos/program";
import { createTestClient } from "../createTestClient";
import {
  CHECKIN_SNAPSHOT_ID,
  PROGRAM_ID,
  RECOGNISABLE_MU_KCAL,
  RECOGNISABLE_PROTEIN_G,
  basisOf,
  eligibleMeasurement,
  ineligibleMeasurement,
  installProgramFake,
  programRow,
  snapshotRow,
  START_SNAPSHOT_ID,
  startSnapshotRow,
  TARGETS_ID,
  targetsRow,
} from "../support/program";

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => {
  server.close();
});

const silenceConsole = () =>
  (["log", "info", "warn", "error", "debug"] as const).map((method) =>
    vi.spyOn(console, method).mockImplementation(() => undefined),
  );

const thrownBy = (action: () => Promise<unknown>) =>
  action().then(
    () => null,
    (thrown: unknown) => thrown,
  );

const everythingAbout = (error: unknown, consoleSpies: ReturnType<typeof silenceConsole>) =>
  JSON.stringify({
    message: error instanceof Error ? error.message : null,
    cause: error instanceof Error ? error.cause : null,
    console: consoleSpies.map((spy) => spy.mock.calls),
  });

const noProgramSummary = {
  program: null,
  latestSnapshot: null,
  previousSnapshot: null,
  currentTargets: null,
  previousTargets: null,
};

const startSnapshot = {
  id: START_SNAPSHOT_ID,
  kind: "start",
  asOfDate: "2026-10-23",
  muKcal: 2200,
  varKcal2: 90000,
  measurement: null,
};

describe("getMyProgramSummary", () => {
  describe("with no active program", () => {
    it("should return a null program and nothing else when there is no program row", async () => {
      installProgramFake(server);

      expect(await getMyProgramSummary(createTestClient())).toEqual(noProgramSummary);
    });

    it("should return nothing else when the only program has ended, even though rows remain", async () => {
      installProgramFake(server, {
        programs: [programRow({ ended_on: "2026-10-28" })],
        snapshots: [startSnapshotRow()],
        targets: [targetsRow({ effective_from: "2026-10-23" })],
      });

      expect(await getMyProgramSummary(createTestClient())).toEqual(noProgramSummary);
    });
  });

  describe("a settling program with one start snapshot", () => {
    it("should map the program, the start snapshot and the current targets", async () => {
      installProgramFake(server, {
        programs: [programRow({ next_checkin_date: "2026-11-06", started_on: "2026-10-23" })],
        snapshots: [startSnapshotRow({ id: START_SNAPSHOT_ID })],
        targets: [
          targetsRow({
            id: TARGETS_ID,
            effective_from: "2026-10-23",
            calories_kcal: 2150,
            protein_g: 126,
            fat_g: 73,
            carbs_g: 247,
            dow_calories_kcal: [2150, 2150, 2150, 2150, 2150, 2150, 2150],
            basis: basisOf({ source: "start" }),
          }),
        ],
      });

      expect(await getMyProgramSummary(createTestClient())).toEqual({
        program: {
          id: PROGRAM_ID,
          goal: "lose",
          ratePctPerWeek: 0.5,
          proteinGPerKg: 1.6,
          fatFraction: 0.3,
          splitPreset: "balanced",
          startedOn: "2026-10-23",
          nextCheckinDate: "2026-11-06",
        },
        latestSnapshot: startSnapshot,
        previousSnapshot: null,
        currentTargets: {
          id: TARGETS_ID,
          effectiveFrom: "2026-10-23",
          effectiveTo: null,
          isCurrent: true,
          caloriesKcal: 2150,
          proteinG: 126,
          fatG: 73,
          carbsG: 247,
          dowCaloriesKcal: [2150, 2150, 2150, 2150, 2150, 2150, 2150],
          basis: basisOf({ source: "start" }),
        },
        previousTargets: null,
      });
    });

    it("should return a null next check-in date when the program has none", async () => {
      installProgramFake(server, {
        programs: [programRow({ next_checkin_date: null })],
        snapshots: [startSnapshotRow()],
        targets: [targetsRow()],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.program?.nextCheckinDate).toBeNull();
    });

    it("should read a program with no snapshot and no targets yet as a program with nothing else", async () => {
      installProgramFake(server, { programs: [programRow()] });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.program?.id).toBe(PROGRAM_ID);
      expect({ ...summary, program: null }).toEqual(noProgramSummary);
    });
  });

  describe("a measured program with two snapshots and two targets rows", () => {
    const install = () =>
      installProgramFake(server, {
        programs: [programRow()],
        // Out of order on purpose: the newest comes from the read's order, not from the table.
        snapshots: [
          snapshotRow({ as_of_date: "2026-10-30", mu_kcal: 2260, var_kcal2: 40000 }),
          startSnapshotRow({ as_of_date: "2026-10-16" }),
          snapshotRow({ as_of_date: "2026-10-23", mu_kcal: 2230, var_kcal2: 60000 }),
        ],
        targets: [
          targetsRow({
            effective_from: "2026-10-30",
            effective_to: null,
            calories_kcal: 2140,
          }),
          targetsRow({
            effective_from: "2026-10-23",
            effective_to: "2026-10-30",
            calories_kcal: 2170,
          }),
          targetsRow({
            effective_from: "2026-10-16",
            effective_to: "2026-10-23",
            calories_kcal: 2190,
          }),
        ],
      });

    it("should return the newest snapshot as the latest and the one before it as the previous", async () => {
      install();

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.latestSnapshot).toMatchObject({
        kind: "checkin",
        asOfDate: "2026-10-30",
        muKcal: 2260,
        varKcal2: 40000,
      });
      expect(summary.previousSnapshot).toMatchObject({
        kind: "checkin",
        asOfDate: "2026-10-23",
        muKcal: 2230,
        varKcal2: 60000,
      });
    });

    it("should parse the measurement of a snapshot with its update fields and counts", async () => {
      install();

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.latestSnapshot?.measurement).toEqual({
        eligible: true,
        zKcal: 2585,
        rKcal2: 62467.9,
        slopeKgPerDay: -0.05,
        seSlopeKg: 0.0198898,
        meanIntakeKcal: 2200,
        spanDays: 14,
        weighDays: 14,
        completeDays: 14,
        gain: 0.5,
        rawStepKcal: 312.5,
        stepKcal: 250,
        stepClamped: true,
      });
    });

    it("should return the current targets row as current and the one before as the previous, not current", async () => {
      install();

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.currentTargets).toMatchObject({
        effectiveFrom: "2026-10-30",
        effectiveTo: null,
        isCurrent: true,
        caloriesKcal: 2140,
      });
      expect(summary.previousTargets).toMatchObject({
        effectiveFrom: "2026-10-23",
        effectiveTo: "2026-10-30",
        isCurrent: false,
        caloriesKcal: 2170,
      });
    });

    it("should read an ineligible measurement as it was stored, with its reasons", async () => {
      installProgramFake(server, {
        programs: [programRow()],
        snapshots: [snapshotRow({ measurement: ineligibleMeasurement })],
        targets: [targetsRow()],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.latestSnapshot?.measurement).toEqual({
        eligible: false,
        reasons: ["complete_days"],
        spanDays: 14,
        weighDays: 14,
        completeDays: 9,
      });
    });
  });

  describe("the targets rows", () => {
    it("should skip a row that held for no days when it names the previous targets", async () => {
      installProgramFake(server, {
        programs: [programRow()],
        snapshots: [startSnapshotRow()],
        targets: [
          targetsRow({
            effective_from: "2026-10-23",
            effective_to: "2026-10-30",
            calories_kcal: 2170,
          }),
          // Replaced on the day it began, so it was never in force.
          targetsRow({
            effective_from: "2026-10-30",
            effective_to: "2026-10-30",
            calories_kcal: 1999,
            created_at: "2026-10-30T07:00:00+00:00",
          }),
          targetsRow({
            effective_from: "2026-10-30",
            effective_to: null,
            calories_kcal: 2140,
            created_at: "2026-10-30T09:00:00+00:00",
          }),
        ],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.currentTargets).toMatchObject({ caloriesKcal: 2140 });
      expect(summary.previousTargets).toMatchObject({ caloriesKcal: 2170 });
    });

    it("should find the real previous row behind more than two rows that held for no days", async () => {
      // Each recompute, edit or collapsed catch-up on one day leaves an empty row, so a read of the
      // newest two rows would hold only empty ones.
      const emptyRow = (minute: number) =>
        targetsRow({
          effective_from: "2026-10-30",
          effective_to: "2026-10-30",
          calories_kcal: 1900 + minute,
          created_at: `2026-10-30T07:0${minute}:00+00:00`,
        });
      installProgramFake(server, {
        programs: [programRow()],
        targets: [
          targetsRow({
            effective_from: "2026-10-23",
            effective_to: "2026-10-30",
            calories_kcal: 2170,
          }),
          emptyRow(1),
          emptyRow(2),
          emptyRow(3),
          emptyRow(4),
          targetsRow({
            effective_from: "2026-10-30",
            effective_to: null,
            calories_kcal: 2140,
            created_at: "2026-10-30T09:00:00+00:00",
          }),
        ],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.currentTargets).toMatchObject({ caloriesKcal: 2140 });
      expect(summary.previousTargets).toMatchObject({ caloriesKcal: 2170 });
    });

    it("should return no current targets when no row is open, and the newest closed row as the previous", async () => {
      installProgramFake(server, {
        programs: [programRow()],
        targets: [targetsRow({ effective_from: "2026-10-23", effective_to: "2026-10-30" })],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.currentTargets).toBeNull();
      expect(summary.previousTargets).toMatchObject({
        effectiveFrom: "2026-10-23",
        isCurrent: false,
      });
    });
  });

  describe("the snapshots and targets of the active program only", () => {
    const OLD_PROGRAM_ID = "66666666-6666-4666-8666-666666666601";
    const NEW_PROGRAM_ID = "66666666-6666-4666-8666-666666666602";

    it("should show a restarted program its own start snapshot and nothing of the ended one's", async () => {
      installProgramFake(server, {
        programs: [
          programRow({ id: OLD_PROGRAM_ID, ended_on: "2026-10-28" }),
          programRow({ id: NEW_PROGRAM_ID, started_on: "2026-10-29" }),
        ],
        snapshots: [
          snapshotRow({ program_id: OLD_PROGRAM_ID, as_of_date: "2026-10-20", mu_kcal: 2260 }),
          snapshotRow({ program_id: OLD_PROGRAM_ID, as_of_date: "2026-10-27", mu_kcal: 2290 }),
          startSnapshotRow({ program_id: NEW_PROGRAM_ID, as_of_date: "2026-10-29", mu_kcal: 2300 }),
        ],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.latestSnapshot).toMatchObject({ kind: "start", muKcal: 2300 });
      expect(summary.previousSnapshot).toBeNull();
    });

    it("should read the newest two snapshots of the active program, whoever wrote the rows around them", async () => {
      installProgramFake(server, {
        programs: [programRow({ id: NEW_PROGRAM_ID })],
        snapshots: [
          snapshotRow({ program_id: OLD_PROGRAM_ID, as_of_date: "2026-10-27", mu_kcal: 2290 }),
          startSnapshotRow({ program_id: NEW_PROGRAM_ID, as_of_date: "2026-10-29", mu_kcal: 2300 }),
          snapshotRow({ program_id: NEW_PROGRAM_ID, as_of_date: "2026-11-05", mu_kcal: 2320 }),
          snapshotRow({ program_id: null, as_of_date: "2026-11-04", mu_kcal: 2310 }),
        ],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.latestSnapshot).toMatchObject({ asOfDate: "2026-11-05", muKcal: 2320 });
      expect(summary.previousSnapshot).toMatchObject({ asOfDate: "2026-10-29", muKcal: 2300 });
    });

    it("should give a restarted program no previous targets, and its own row as the current", async () => {
      installProgramFake(server, {
        programs: [
          programRow({ id: OLD_PROGRAM_ID, ended_on: "2026-10-28" }),
          programRow({ id: NEW_PROGRAM_ID, started_on: "2026-10-29" }),
        ],
        targets: [
          targetsRow({
            program_id: OLD_PROGRAM_ID,
            effective_from: "2026-10-20",
            effective_to: "2026-10-29",
            calories_kcal: 2290,
          }),
          targetsRow({
            program_id: NEW_PROGRAM_ID,
            effective_from: "2026-10-29",
            effective_to: null,
            calories_kcal: 2150,
          }),
        ],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.currentTargets).toMatchObject({ caloriesKcal: 2150, isCurrent: true });
      expect(summary.previousTargets).toBeNull();
    });

    it("should find its own previous targets when rows of other programs sit around them", async () => {
      installProgramFake(server, {
        programs: [programRow({ id: NEW_PROGRAM_ID })],
        targets: [
          targetsRow({
            program_id: OLD_PROGRAM_ID,
            effective_from: "2026-10-01",
            effective_to: "2026-10-10",
            calories_kcal: 2290,
          }),
          targetsRow({
            program_id: NEW_PROGRAM_ID,
            effective_from: "2026-10-10",
            effective_to: "2026-10-20",
            calories_kcal: 2170,
          }),
          targetsRow({
            program_id: null,
            effective_from: "2026-10-20",
            effective_to: "2026-10-24",
            calories_kcal: 2000,
          }),
          targetsRow({
            program_id: NEW_PROGRAM_ID,
            effective_from: "2026-10-24",
            effective_to: null,
            calories_kcal: 2140,
          }),
        ],
      });

      const summary = await getMyProgramSummary(createTestClient());

      expect(summary.currentTargets).toMatchObject({ caloriesKcal: 2140 });
      expect(summary.previousTargets).toMatchObject({ caloriesKcal: 2170 });
    });

    it("should keep the ended program's targets in the history list, which is not filtered", async () => {
      installProgramFake(server, {
        programs: [programRow({ id: NEW_PROGRAM_ID })],
        targets: [
          targetsRow({
            program_id: OLD_PROGRAM_ID,
            effective_from: "2026-10-20",
            effective_to: "2026-10-29",
            calories_kcal: 2290,
          }),
          targetsRow({
            program_id: NEW_PROGRAM_ID,
            effective_from: "2026-10-29",
            effective_to: null,
          }),
        ],
      });

      const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

      expect(history.map((row) => row.caloriesKcal)).toEqual([2290, 2140]);
    });

    it("should keep the ended program's snapshots in the history list, which is not filtered", async () => {
      installProgramFake(server, {
        programs: [programRow({ id: NEW_PROGRAM_ID })],
        snapshots: [
          snapshotRow({ program_id: OLD_PROGRAM_ID, as_of_date: "2026-10-27" }),
          startSnapshotRow({ program_id: NEW_PROGRAM_ID, as_of_date: "2026-10-29" }),
        ],
      });

      const snapshots = await listMyExpenditureSnapshots(createTestClient(), {
        fromDate: "2026-10-01",
      });

      expect(snapshots.map((snapshot) => snapshot.asOfDate)).toEqual(["2026-10-27", "2026-10-29"]);
    });
  });

  describe("what it asks for", () => {
    it("should select only the columns it maps, the newest two snapshots and the recent targets", async () => {
      const { requests } = installProgramFake(server, { programs: [programRow()] });

      await getMyProgramSummary(createTestClient());

      const urlOf = (table: string) => requests.find((request) => request.table === table)?.url;
      expect(urlOf("programs")?.searchParams.get("select")).toBe(
        "id,goal,rate_pct_per_week,protein_g_per_kg,fat_fraction_of_remaining,split_preset,started_on,next_checkin_date",
      );
      expect(urlOf("programs")?.searchParams.get("ended_on")).toBe("is.null");
      expect(urlOf("expenditure_snapshots")?.searchParams.get("select")).toBe(
        "id,program_id,as_of_date,kind,mu_kcal,var_kcal2,measurement",
      );
      expect(urlOf("expenditure_snapshots")?.searchParams.get("order")).toBe("as_of_date.desc");
      expect(urlOf("expenditure_snapshots")?.searchParams.get("limit")).toBe("5");
      expect(urlOf("targets")?.searchParams.get("select")).toBe(
        "id,program_id,effective_from,effective_to,calories_kcal,protein_g,fat_g,carbs_g,dow_calories_kcal,basis",
      );
      expect(urlOf("targets")?.searchParams.get("order")).toBe(
        "effective_from.desc,created_at.desc,id.desc",
      );
      expect(urlOf("targets")?.searchParams.get("limit")).toBe("25");
    });
  });

  describe("a row that is not what the database promises", () => {
    it("should throw the action and a code only when a measurement is malformed, with no value anywhere", async () => {
      const consoleSpies = silenceConsole();
      installProgramFake(server, {
        programs: [programRow()],
        snapshots: [
          snapshotRow({
            mu_kcal: RECOGNISABLE_MU_KCAL,
            measurement: { ...eligibleMeasurement, zKcal: RECOGNISABLE_MU_KCAL, gain: "0.5" },
          }),
        ],
        targets: [targetsRow()],
      });

      const error = await thrownBy(() => getMyProgramSummary(createTestClient()));

      expect(error).toMatchObject({
        message: "Could not load your program (invalid_measurement)",
        cause: { code: "invalid_measurement" },
      });
      expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_MU_KCAL));
    });

    it("should throw the action and a code only when a basis is malformed", async () => {
      const consoleSpies = silenceConsole();
      installProgramFake(server, {
        programs: [programRow()],
        snapshots: [startSnapshotRow()],
        targets: [
          targetsRow({
            protein_g: RECOGNISABLE_PROTEIN_G,
            basis: basisOf({ goal: "bulk", bmrKcal: RECOGNISABLE_PROTEIN_G }),
          }),
        ],
      });

      const error = await thrownBy(() => getMyProgramSummary(createTestClient()));

      expect(error).toMatchObject({
        message: "Could not load your program (invalid_basis)",
        cause: { code: "invalid_basis" },
      });
      expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_PROTEIN_G));
    });

    it("should throw a code only when a snapshot has a kind that is not start or checkin", async () => {
      installProgramFake(server, {
        programs: [programRow()],
        snapshots: [snapshotRow({ kind: "manual" })],
      });

      const error = await thrownBy(() => getMyProgramSummary(createTestClient()));

      expect(error).toMatchObject({
        message: "Could not load your program (invalid_row)",
        cause: { code: "invalid_row" },
      });
    });

    it.each([
      ["a check-in with no measurement", snapshotRow({ kind: "checkin", measurement: null })],
      ["a start with a measurement", startSnapshotRow({ measurement: eligibleMeasurement })],
    ])("should throw a code only for %s", async (_name, row) => {
      installProgramFake(server, { programs: [programRow()], snapshots: [row] });

      const error = await thrownBy(() => getMyProgramSummary(createTestClient()));

      expect(error).toMatchObject({
        message: "Could not load your program (invalid_row)",
        cause: { code: "invalid_row" },
      });
    });

    it("should not read a malformed snapshot when there is no active program", async () => {
      installProgramFake(server, {
        programs: [programRow({ ended_on: "2026-10-28" })],
        snapshots: [snapshotRow({ measurement: { eligible: "maybe" } })],
      });

      expect(await getMyProgramSummary(createTestClient())).toEqual(noProgramSummary);
    });
  });

  describe("when a read fails", () => {
    it.each([["programs"], ["expenditure_snapshots"], ["targets"]] as const)(
      "should throw the action and the code only when %s fails, with no value in the message, the cause or the console",
      async (table) => {
        const consoleSpies = silenceConsole();
        const { failWith } = installProgramFake(server, {
          programs: [programRow()],
          snapshots: [snapshotRow({ mu_kcal: RECOGNISABLE_MU_KCAL })],
        });
        failWith(table, "XX000");

        const error = await thrownBy(() => getMyProgramSummary(createTestClient()));

        expect(error).toMatchObject({
          message: "Could not load your program (XX000)",
          cause: { code: "XX000" },
        });
        expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_MU_KCAL));
      },
    );
  });
});

describe("listMyExpenditureSnapshots", () => {
  it("should return the snapshots oldest first, whatever order the table holds them in", async () => {
    installProgramFake(server, {
      snapshots: [
        snapshotRow({ as_of_date: "2026-10-30" }),
        startSnapshotRow({ as_of_date: "2026-10-16" }),
        snapshotRow({ as_of_date: "2026-10-23" }),
      ],
    });

    const snapshots = await listMyExpenditureSnapshots(createTestClient(), {
      fromDate: "2026-10-01",
    });

    expect(snapshots.map((snapshot) => snapshot.asOfDate)).toEqual([
      "2026-10-16",
      "2026-10-23",
      "2026-10-30",
    ]);
  });

  it("should map a snapshot's kind, estimate, variance and parsed measurement", async () => {
    installProgramFake(server, {
      snapshots: [
        startSnapshotRow({ id: START_SNAPSHOT_ID, as_of_date: "2026-10-16" }),
        snapshotRow({
          id: CHECKIN_SNAPSHOT_ID,
          as_of_date: "2026-10-23",
          mu_kcal: 2230,
          var_kcal2: 60000,
        }),
      ],
    });

    const snapshots = await listMyExpenditureSnapshots(createTestClient(), {
      fromDate: "2026-10-01",
    });

    expect(snapshots).toEqual([
      {
        id: START_SNAPSHOT_ID,
        kind: "start",
        asOfDate: "2026-10-16",
        muKcal: 2200,
        varKcal2: 90000,
        measurement: null,
      },
      {
        id: CHECKIN_SNAPSHOT_ID,
        kind: "checkin",
        asOfDate: "2026-10-23",
        muKcal: 2230,
        varKcal2: 60000,
        measurement: eligibleMeasurement,
      },
    ]);
  });

  it("should include a snapshot on the from date and leave out the day before", async () => {
    installProgramFake(server, {
      snapshots: [
        snapshotRow({ as_of_date: "2026-10-15" }),
        snapshotRow({ as_of_date: "2026-10-16" }),
      ],
    });

    const snapshots = await listMyExpenditureSnapshots(createTestClient(), {
      fromDate: "2026-10-16",
    });

    expect(snapshots.map((snapshot) => snapshot.asOfDate)).toEqual(["2026-10-16"]);
  });

  it("should return an empty list when there is none", async () => {
    installProgramFake(server);

    expect(
      await listMyExpenditureSnapshots(createTestClient(), { fromDate: "2026-10-01" }),
    ).toEqual([]);
  });

  it("should select only the mapped columns, oldest first", async () => {
    const { requests } = installProgramFake(server);

    await listMyExpenditureSnapshots(createTestClient(), { fromDate: "2026-10-01" });

    const { searchParams } = requests[0]?.url ?? new URL("http://unread.invalid");
    expect(searchParams.get("select")).toBe(
      "id,program_id,as_of_date,kind,mu_kcal,var_kcal2,measurement",
    );
    expect(searchParams.get("order")).toBe("as_of_date.asc");
    expect(searchParams.get("as_of_date")).toBe("gte.2026-10-01");
  });

  it.each(["yesterday", "2026-13-01", "2026-10-1", "2026-10-01,or=(id.neq.0)"])(
    "should throw a RangeError and make no request for the from date %s",
    async (fromDate) => {
      const { requests } = installProgramFake(server);

      await expect(
        listMyExpenditureSnapshots(createTestClient(), { fromDate }),
      ).rejects.toBeInstanceOf(RangeError);
      expect(requests).toEqual([]);
    },
  );

  it.each([
    ["a check-in with no measurement", snapshotRow({ kind: "checkin", measurement: null })],
    ["a start with a measurement", startSnapshotRow({ measurement: eligibleMeasurement })],
  ])("should throw a code only for %s", async (_name, row) => {
    installProgramFake(server, { snapshots: [row] });

    const error = await thrownBy(() =>
      listMyExpenditureSnapshots(createTestClient(), { fromDate: "2026-10-01" }),
    );

    expect(error).toMatchObject({
      message: "Could not load your expenditure history (invalid_row)",
      cause: { code: "invalid_row" },
    });
  });

  it("should throw a code only when a measurement is malformed", async () => {
    const consoleSpies = silenceConsole();
    installProgramFake(server, {
      snapshots: [
        snapshotRow({ measurement: { ...eligibleMeasurement, zKcal: RECOGNISABLE_MU_KCAL * 10 } }),
      ],
    });

    const error = await thrownBy(() =>
      listMyExpenditureSnapshots(createTestClient(), { fromDate: "2026-10-01" }),
    );

    expect(error).toMatchObject({
      message: "Could not load your expenditure history (invalid_measurement)",
      cause: { code: "invalid_measurement" },
    });
    expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_MU_KCAL * 10));
  });

  it("should throw the action and the code only when the read fails, with no value anywhere", async () => {
    const consoleSpies = silenceConsole();
    const { failWith } = installProgramFake(server, {
      snapshots: [snapshotRow({ mu_kcal: RECOGNISABLE_MU_KCAL })],
    });
    failWith("expenditure_snapshots", "XX000");

    const error = await thrownBy(() =>
      listMyExpenditureSnapshots(createTestClient(), { fromDate: "2026-10-01" }),
    );

    expect(error).toMatchObject({
      message: "Could not load your expenditure history (XX000)",
      cause: { code: "XX000" },
    });
    expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_MU_KCAL));
  });
});

describe("listMyTargetsHistory", () => {
  const closedRow = (from: string, to: string | null, calories: number) =>
    targetsRow({ effective_from: from, effective_to: to, calories_kcal: calories });

  it("should return the rows oldest first, whatever order the table holds them in", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      targets: [
        closedRow("2026-10-30", null, 2140),
        closedRow("2026-10-16", "2026-10-23", 2190),
        closedRow("2026-10-23", "2026-10-30", 2170),
      ],
    });

    const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

    expect(history.map((row) => row.effectiveFrom)).toEqual([
      "2026-10-16",
      "2026-10-23",
      "2026-10-30",
    ]);
  });

  describe("the rows whose range touches the from date", () => {
    const install = () =>
      installProgramFake(server, {
        programs: [programRow()],
        targets: [
          closedRow("2026-10-02", "2026-10-09", 2250),
          closedRow("2026-10-09", "2026-10-16", 2200),
          closedRow("2026-10-16", "2026-10-23", 2170),
          closedRow("2026-10-23", null, 2140),
        ],
      });

    it("should leave out a row that ended on the from date, because its end is exclusive", async () => {
      install();

      const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-16" });

      expect(history.map((row) => row.effectiveFrom)).toEqual(["2026-10-16", "2026-10-23"]);
    });

    it("should include a row that held on the from date and ended after it", async () => {
      install();

      const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-15" });

      expect(history.map((row) => row.effectiveFrom)).toEqual([
        "2026-10-09",
        "2026-10-16",
        "2026-10-23",
      ]);
    });

    it("should always include the open row, however late the from date", async () => {
      install();

      const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-12-01" });

      expect(history.map((row) => row.effectiveFrom)).toEqual(["2026-10-23"]);
    });
  });

  it("should map every field of a row", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      targets: [
        targetsRow({
          id: TARGETS_ID,
          effective_from: "2026-10-23",
          effective_to: "2026-10-30",
          calories_kcal: 2170,
          protein_g: 126,
          fat_g: 73,
          carbs_g: 252,
          dow_calories_kcal: [2200, 2200, 2200, 2200, 2200, 2100, 2100],
        }),
      ],
    });

    const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

    expect(history).toEqual([
      {
        id: TARGETS_ID,
        effectiveFrom: "2026-10-23",
        effectiveTo: "2026-10-30",
        isCurrent: false,
        caloriesKcal: 2170,
        proteinG: 126,
        fatG: 73,
        carbsG: 252,
        dowCaloriesKcal: [2200, 2200, 2200, 2200, 2200, 2100, 2100],
        basis: basisOf(),
      },
    ]);
  });

  it("should drop a row that held for no days, because it was never in force", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      targets: [
        closedRow("2026-10-23", "2026-10-30", 2170),
        closedRow("2026-10-30", "2026-10-30", 1999),
        closedRow("2026-10-30", null, 2140),
      ],
    });

    const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

    expect(history.map((row) => row.caloriesKcal)).toEqual([2170, 2140]);
  });

  it("should keep a row that held for no days when asked to, in its place among the rows of that day", async () => {
    installProgramFake(server, {
      programs: [programRow()],
      targets: [
        closedRow("2026-10-23", "2026-10-30", 2170),
        closedRow("2026-10-30", "2026-10-30", 1999),
        closedRow("2026-10-30", null, 2140),
      ],
    });

    const history = await listMyTargetsHistory(createTestClient(), {
      fromDate: "2026-10-01",
      keepZeroDayRows: true,
    });

    expect(history.map((row) => row.caloriesKcal)).toEqual([2170, 1999, 2140]);
  });

  describe("which row is current", () => {
    it("should mark the open row current while the program is active", async () => {
      installProgramFake(server, {
        programs: [programRow()],
        targets: [closedRow("2026-10-16", "2026-10-23", 2170), closedRow("2026-10-23", null, 2140)],
      });

      const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

      expect(history.map((row) => row.isCurrent)).toEqual([false, true]);
    });

    it("should not mark the open row current once the program has ended", async () => {
      installProgramFake(server, {
        programs: [programRow({ ended_on: "2026-10-28" })],
        targets: [closedRow("2026-10-16", "2026-10-23", 2170), closedRow("2026-10-23", null, 2140)],
      });

      const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

      expect(history.map((row) => row.isCurrent)).toEqual([false, false]);
      expect(history[1]?.effectiveTo).toBeNull();
    });

    it("should not mark the open row current when there is no program at all", async () => {
      installProgramFake(server, { targets: [closedRow("2026-10-23", null, 2140)] });

      const history = await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

      expect(history.map((row) => row.isCurrent)).toEqual([false]);
    });
  });

  it("should select only the mapped columns and ask for the range and the order", async () => {
    const { requests } = installProgramFake(server);

    await listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" });

    const targetsUrl = requests.find((request) => request.table === "targets")?.url;
    expect(targetsUrl?.searchParams.get("select")).toBe(
      "id,program_id,effective_from,effective_to,calories_kcal,protein_g,fat_g,carbs_g,dow_calories_kcal,basis",
    );
    expect(targetsUrl?.searchParams.get("or")).toBe(
      "(effective_to.is.null,effective_to.gt.2026-10-01)",
    );
    expect(targetsUrl?.searchParams.get("order")).toBe("effective_from.asc,created_at.asc,id.asc");
  });

  it.each(["yesterday", "2026-02-30", "2026-10-01)"])(
    "should throw a RangeError and make no request for the from date %s",
    async (fromDate) => {
      const { requests } = installProgramFake(server);

      await expect(listMyTargetsHistory(createTestClient(), { fromDate })).rejects.toBeInstanceOf(
        RangeError,
      );
      expect(requests).toEqual([]);
    },
  );

  it("should throw a code only when a basis is malformed", async () => {
    const consoleSpies = silenceConsole();
    installProgramFake(server, {
      programs: [programRow()],
      targets: [targetsRow({ basis: basisOf({ bmrKcal: String(RECOGNISABLE_PROTEIN_G) }) })],
    });

    const error = await thrownBy(() =>
      listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" }),
    );

    expect(error).toMatchObject({
      message: "Could not load your targets history (invalid_basis)",
      cause: { code: "invalid_basis" },
    });
    expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_PROTEIN_G));
  });

  it.each([["targets"], ["programs"]] as const)(
    "should throw the action and the code only when %s fails, with no value anywhere",
    async (table) => {
      const consoleSpies = silenceConsole();
      const { failWith } = installProgramFake(server, {
        programs: [programRow()],
        targets: [targetsRow({ protein_g: RECOGNISABLE_PROTEIN_G })],
      });
      failWith(table, "XX000");

      const error = await thrownBy(() =>
        listMyTargetsHistory(createTestClient(), { fromDate: "2026-10-01" }),
      );

      expect(error).toMatchObject({
        message: "Could not load your targets history (XX000)",
        cause: { code: "XX000" },
      });
      expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_MU_KCAL));
      expect(everythingAbout(error, consoleSpies)).not.toContain(String(RECOGNISABLE_PROTEIN_G));
    },
  );
});
