import { z } from "zod";

import { describeLoggedAmount } from "../../copy/diary";
import { formatClockTime } from "../../dates/formatClockTime";
import { logEntryInsertSchema } from "../../diary/schemas";
import { formatCalories, formatGrams } from "../../format/numbers";
import { assistantIdSchema } from "../ids";

import type { LogEntryInsert } from "../../diary/schemas";
import type { AssistantCard, AssistantCardRow } from "../card";

/*
 * What the diary cards are built from: the rows a write left behind, as the database holds them, and
 * never the numbers the model sent. A row that does not parse is left out of the words by the callers.
 */

/**
 * A card before it has its action ids. A tool builds the card from the rows it wrote, but the executor
 * reserves the action only around the tool, so the turn loop adds the ids from the executor's result.
 */
export type AssistantCardDraft = Omit<AssistantCard, "actionIds">;

/** The card with the action ids of the writes it groups, at least one. */
export const withActionIds = (
  draft: AssistantCardDraft,
  actionIds: [string, ...string[]],
): AssistantCard => ({ actionIds, ...draft });

export type CardEntry = {
  id: string;
  /** The entry's time on the person's own clock, "08:10". */
  clockTime: string;
  entry: LogEntryInsert;
};

const rowIdentitySchema = z.object({ id: assistantIdSchema, clock_time: z.string().optional() });

/** The entry in a row, or null when the row is not an entry. `clock_time` is used when the row has it. */
export function cardEntryOfRow(row: unknown, timeZone: string): CardEntry | null {
  const identity = rowIdentitySchema.safeParse(row);
  const entry = logEntryInsertSchema.safeParse(row);
  if (!identity.success || !entry.success) {
    return null;
  }
  return {
    id: identity.data.id,
    clockTime:
      identity.data.clock_time ?? formatClockTime(new Date(entry.data.logged_at), timeZone),
    entry: entry.data,
  };
}

/** The name up to the first comma, in the case it is stored in: "Egg, boiled" is "Egg". */
function headOf(name: string): string {
  const [head = ""] = name.split(",");
  const trimmed = head.trim();
  return trimmed === "" ? name : trimmed;
}

const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

const nameOf = ({ entry }: CardEntry): string =>
  entry.item_type === "quick" ? (entry.snapshot.label ?? "quick add") : entry.snapshot.name;

/** The name as it is stored, up to the first comma: for a sentence that starts with it, or lists it by itself. */
export const describeStoredName = (card: CardEntry): string => headOf(nameOf(card));

/**
 * The name in the middle of a sentence ("Logged 2 eggs and toast"): lower case at the start, with a count
 * for two or more portions. The plural adds an "s" to the name, and nothing smarter, so "bread" would read
 * "2 breads".
 */
export function describeCardName(card: CardEntry): string {
  const { entry } = card;
  const name = lowerFirst(headOf(nameOf(card)));
  if (entry.item_type === "food" && entry.unit === "portion" && entry.quantity >= 2) {
    return `${formatGrams(entry.quantity)} ${name.endsWith("s") ? name : `${name}s`}`;
  }
  return name;
}

const pluralOf = (label: string): string => (label.endsWith("s") ? label : `${label}s`);

/**
 * How much was logged, led by the portion with its size in brackets: "2 large eggs (100 g)", "1 slice
 * (30 g)", "200 g". A portion whose label starts with a number, such as "1 medium", is written as the
 * diary writes it.
 */
export function describeCardAmount({ entry }: CardEntry): string {
  if (entry.item_type === "quick") {
    return describeLoggedAmount(null);
  }
  if (entry.item_type === "recipe") {
    return entry.unit === "serving"
      ? `${formatGrams(entry.quantity)} ${entry.quantity === 1 ? "serving" : "servings"}`
      : `${formatGrams(entry.quantity)} g`;
  }
  const { portion } = entry.snapshot;
  if (entry.unit !== "portion" || portion === null || /^\d/.test(portion.label)) {
    return describeLoggedAmount({
      unit: entry.unit,
      quantity: entry.quantity,
      resolvedGrams: entry.resolved_grams,
      portion,
    });
  }
  // A portion with no size is the count portion of a food per portion, so nothing goes in brackets.
  const size =
    "grams" in portion
      ? ` (${formatGrams(entry.quantity * portion.grams)} g)`
      : "ml" in portion
        ? ` (${formatGrams(entry.quantity * portion.ml)} ml)`
        : "";
  return entry.quantity === 1
    ? `1 ${portion.label}${size}`
    : `${formatGrams(entry.quantity)} ${pluralOf(portion.label)}${size}`;
}

export function cardRowOf(card: CardEntry): AssistantCardRow {
  const { kcal } = card.entry.nutrients;
  return {
    name: nameOf(card),
    amountText: describeCardAmount(card),
    time: card.clockTime,
    kcalText: kcal === null ? null : `${formatCalories(kcal)} kcal`,
    match: null,
    matchedFood: null,
    estimate: false,
  };
}

/** The time all the entries share, or null when they are at different times. */
export function sharedClockTime(cards: readonly CardEntry[]): string | null {
  const [first] = cards;
  return first !== undefined && cards.every((card) => card.clockTime === first.clockTime)
    ? first.clockTime
    : null;
}

const sumOf = (values: readonly (number | null)[]): number | null => {
  const known = values.filter((value): value is number => value !== null);
  return known.length === 0 ? null : known.reduce((total, value) => total + value, 0);
};

/** "1,940 kcal", the calories of the entries that have a figure, or null when none has. */
export function describeCardTotalKcal(cards: readonly CardEntry[]): string | null {
  const kcal = sumOf(cards.map(({ entry }) => entry.nutrients.kcal));
  return kcal === null ? null : `${formatCalories(kcal)} kcal`;
}

/** "232 kcal · P 15 g · C 17 g · F 10 g". A figure no entry gave is left out, never written as 0. */
export function describeCardTotal(cards: readonly CardEntry[]): string | null {
  const nutrients = cards.map(({ entry }) => entry.nutrients);
  const kcal = sumOf(nutrients.map((n) => n.kcal));
  const parts = [
    kcal === null ? null : `${formatCalories(kcal)} kcal`,
    ...(
      [
        ["P", "protein_g"],
        ["C", "carbs_g"],
        ["F", "fat_g"],
      ] as const
    ).map(([letter, key]) => {
      const grams = sumOf(nutrients.map((n) => n[key]));
      return grams === null ? null : `${letter} ${formatGrams(grams)} g`;
    }),
  ].filter((part): part is string => part !== null);
  return parts.length === 0 ? null : parts.join(" · ");
}
