import { customFoodInputSchema } from "@keylow/core/schemas";
import { buildFood } from "@keylow/core/testing";
import { http } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { getAssistantConsent, setAssistantConsent } from "../../src/repos/assistant";
import { getDiaryDay, getLogEntry } from "../../src/repos/diary";
import { copyDay, CopyDayPartialWriteError } from "../../src/repos/diaryCopy";
import { logFood, softDeleteLogEntry } from "../../src/repos/diaryWrites";
import {
  FoodsPartialWriteError,
  createFood,
  getFood,
  replaceFoodPortions,
  searchFoods,
  softDeleteFood,
  updateFood,
} from "../../src/repos/foods";
import { getMyTimeZone, updateMyTargets } from "../../src/repos/targets";
import { acceptTerms, getMyTermsAcceptance } from "../../src/repos/terms";
import { createTestClient } from "../createTestClient";
import { answerCopyDay } from "../support/copyDayServer";
import { FOOD_ID, foodEntryRow } from "../support/diary";
import { REST_URL, SIGNED_IN_USER_ID, foodRow, postgrestRows } from "../support/postgrest";
import {
  databaseErrorQuotingTheRow,
  errorThrownBy,
  expectNoQuotedText,
  expectOnlyTheCode,
} from "../support/quotedDatabaseError";

// A database error can quote the failing row in its message, details and hint, and the row is health
// data (a food a person ate, the amounts). Whatever a repo throws for one carries the action and the
// code and nothing else, so these tests give every repo family an error that quotes a food and a number.

const server = setupServer();

beforeAll(() => {
  server.listen({ onUnhandledFrame: "error" });
});
afterEach(() => {
  server.resetHandlers();
});
afterAll(() => {
  server.close();
});

const ENTRY_ID = "55555555-5555-4555-8555-555555555555";
const CODE = "23514";

describe("a diary read that the database refuses", () => {
  it("should name the action and the code only when the day's entries cannot be read", async () => {
    server.use(
      http.get(`${REST_URL}/food_log_entries`, () => databaseErrorQuotingTheRow()),
      http.get(`${REST_URL}/day_logs`, ({ request }) => postgrestRows(request, [])),
      http.get(`${REST_URL}/day_totals`, ({ request }) => postgrestRows(request, [])),
    );

    const error = await errorThrownBy(() => getDiaryDay(createTestClient(), "2026-10-15"));

    expectOnlyTheCode(error, "load the day's entries", CODE);
  });

  it("should name the action and the code only when one entry cannot be read", async () => {
    server.use(http.get(`${REST_URL}/food_log_entries`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => getLogEntry(createTestClient(), ENTRY_ID));

    expectOnlyTheCode(error, "load the entry", CODE);
  });
});

describe("a diary write that the database refuses", () => {
  const food = buildFood({ id: FOOD_ID, name: "Rolled oats", kcal: 200 });

  it("should name the action and the code only when an entry cannot be logged", async () => {
    server.use(http.post(`${REST_URL}/food_log_entries`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() =>
      logFood(createTestClient(), {
        food,
        quantity: 50,
        unit: "g",
        loggedAt: "2026-10-15T12:00:00.000Z",
        localDate: "2026-10-15",
      }),
    );

    expectOnlyTheCode(error, "log the food", CODE);
  });

  it("should name the action and the code only when an entry cannot be deleted", async () => {
    server.use(http.patch(`${REST_URL}/food_log_entries`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() =>
      softDeleteLogEntry(createTestClient(), foodEntryRow().id),
    );

    expectOnlyTheCode(error, "delete the entry", CODE);
  });
});

describe("a day copy that the database refuses", () => {
  const copyRequest = { from: "2026-10-15", to: "2026-10-16", timeZone: "Europe/London" };
  const sourceEntries = [foodEntryRow()];

  it("should name the action and the code only when an insert fails and the copies are taken back", async () => {
    const { handlers } = answerCopyDay({ sourceEntries });
    server.use(
      http.post(`${REST_URL}/food_log_entries`, () => databaseErrorQuotingTheRow()),
      ...handlers,
    );

    const error = await errorThrownBy(() => copyDay(createTestClient(), copyRequest));

    expect(error).not.toBeInstanceOf(CopyDayPartialWriteError);
    expectOnlyTheCode(error, "copy the day", CODE);
  });

  it("should keep the database's text out of the partial write error when the copies cannot be taken back", async () => {
    const { handlers } = answerCopyDay({ sourceEntries: [foodEntryRow(), foodEntryRow()] });
    let insertsSeen = 0;
    // The handlers listed first answer first, so these two stand in front of the ones that serve the source day.
    server.use(
      http.post(`${REST_URL}/food_log_entries`, ({ request }) => {
        insertsSeen += 1;
        return insertsSeen === 1
          ? postgrestRows(request, [{ id: ENTRY_ID }], 201)
          : databaseErrorQuotingTheRow();
      }),
      http.patch(`${REST_URL}/food_log_entries`, () => databaseErrorQuotingTheRow("XX000")),
      ...handlers,
    );

    const error = await errorThrownBy(() => copyDay(createTestClient(), copyRequest));

    expect(error).toBeInstanceOf(CopyDayPartialWriteError);
    expectNoQuotedText(error);
    expect(error.message).toContain(`Could not copy the day (${CODE})`);
    expect(error.message).toContain("1 entries already copied could not be removed");
    expect(error.cause).toBeInstanceOf(Error);
    if (error.cause instanceof Error) {
      expectOnlyTheCode(error.cause, "copy the day", CODE);
    }
  });
});

describe("a targets or profile read that the database refuses", () => {
  it("should name the action and the code only", async () => {
    server.use(http.get(`${REST_URL}/profiles`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => getMyTimeZone(createTestClient()));

    expectOnlyTheCode(error, "load your time zone", CODE);
  });

  it("should name the action and the code only when the targets cannot be saved", async () => {
    server.use(
      http.get(`${REST_URL}/programs`, ({ request }) => postgrestRows(request, [])),
      http.patch(`${REST_URL}/profiles`, () => databaseErrorQuotingTheRow()),
    );

    const error = await errorThrownBy(() =>
      updateMyTargets(createTestClient(), SIGNED_IN_USER_ID, {
        kcal: 2000,
        protein_g: null,
        carbs_g: null,
        fat_g: null,
      }),
    );

    expectOnlyTheCode(error, "save your targets", CODE);
  });
});

describe("a food read or write that the database refuses", () => {
  const input = customFoodInputSchema.parse({
    name: "Protein flapjack",
    basis: "per_100g",
    kcal: 410,
    protein_g: 22,
    fat_g: 14,
    carbs_g: 45,
    fibre_g: 6,
    portions: [{ label: "1 bar", grams: 60, isDefault: true }],
  });

  it("should name the action and the code only when a food cannot be read", async () => {
    server.use(http.get(`${REST_URL}/foods`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => getFood(createTestClient(), FOOD_ID));

    expectOnlyTheCode(error, "load the food", CODE);
  });

  it("should name the action and the code only when the food search fails", async () => {
    server.use(http.post(`${REST_URL}/rpc/search_foods`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => searchFoods(createTestClient(), "oats"));

    expectOnlyTheCode(error, "search the foods", CODE);
  });

  it("should name the action and the code only when a food cannot be deleted", async () => {
    server.use(http.patch(`${REST_URL}/foods`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => softDeleteFood(createTestClient(), FOOD_ID));

    expectOnlyTheCode(error, "delete the food", CODE);
  });

  it("should name the food and the code only when the portions cannot be replaced", async () => {
    server.use(
      http.post(`${REST_URL}/rpc/replace_food_portions`, () => databaseErrorQuotingTheRow()),
    );

    const error = await errorThrownBy(() =>
      replaceFoodPortions(createTestClient(), FOOD_ID, input.portions),
    );

    expect(error).not.toBeInstanceOf(FoodsPartialWriteError);
    expectOnlyTheCode(error, `replace the portions of the food ${FOOD_ID}`, CODE);
  });

  it("should name the action and the code only when a created food is refused", async () => {
    server.use(http.post(`${REST_URL}/rpc/create_food`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() =>
      createFood(createTestClient(), SIGNED_IN_USER_ID, input),
    );

    expect(error).not.toBeInstanceOf(FoodsPartialWriteError);
    expectOnlyTheCode(error, "create the food", CODE);
  });

  it("should keep the database's text out of the partial write error when an updated food keeps its old portions", async () => {
    server.use(
      http.patch(`${REST_URL}/foods`, ({ request }) => postgrestRows(request, [foodRow()])),
      http.post(`${REST_URL}/rpc/replace_food_portions`, () => databaseErrorQuotingTheRow("XX000")),
    );

    const error = await errorThrownBy(() => updateFood(createTestClient(), FOOD_ID, input));

    expect(error).toBeInstanceOf(FoodsPartialWriteError);
    expectNoQuotedText(error);
    expect(error.message).toContain("(XX000)");
  });
});

describe("a terms read or write that the database refuses", () => {
  it("should name the action and the code only when the acceptance cannot be read", async () => {
    server.use(http.get(`${REST_URL}/profiles`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => getMyTermsAcceptance(createTestClient()));

    expectOnlyTheCode(error, "load your terms acceptance", CODE);
  });

  it("should name the action and the code only when the terms cannot be accepted", async () => {
    server.use(http.post(`${REST_URL}/rpc/accept_terms`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => acceptTerms(createTestClient(), "2026-10-15"));

    expectOnlyTheCode(error, "accept the terms", CODE);
  });
});

describe("an assistant setting that the database refuses", () => {
  it("should name the action and the code only when the setting cannot be read", async () => {
    server.use(http.get(`${REST_URL}/profiles`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() => getAssistantConsent(createTestClient()));

    expectOnlyTheCode(error, "load your assistant setting", CODE);
  });

  it("should name the action and the code only when the setting cannot be saved", async () => {
    server.use(http.patch(`${REST_URL}/profiles`, () => databaseErrorQuotingTheRow()));

    const error = await errorThrownBy(() =>
      setAssistantConsent(createTestClient(), SIGNED_IN_USER_ID, true),
    );

    expectOnlyTheCode(error, "save your assistant setting", CODE);
  });
});
