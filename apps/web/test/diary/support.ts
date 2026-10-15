import { buildLogEntry, buildQuickEntry } from "@keylow/core/diary";
import { buildFood } from "@keylow/core/testing";

import type { DiaryDay, LogEntry, Targets } from "@keylow/api-client";

const FOOD_ID = "22222222-2222-4222-8222-222222222222";
let entryCount = 0;

function databaseColumns() {
  entryCount += 1;
  const serial = String(entryCount).padStart(12, "0");

  return {
    id: `00000000-0000-4000-8000-${serial}`,
    created_at: `2026-10-15T08:00:${String(entryCount % 60).padStart(2, "0")}+00:00`,
  };
}

type FoodEntryOptions = {
  /** The day, `YYYY-MM-DD`. */
  date: string;
  /** The time on the clock, `HH:mm`. The diary tests read the day in UTC. */
  time: string;
  name: string;
  quantity: number;
  unit: "g" | "ml" | "portion";
  kcal: number;
  protein: number;
  fat: number;
  carbs: number;
};

/** A food entry as the diary reads it, with the diary boards' own numbers for its nutrients. */
export function foodEntry(options: FoodEntryOptions): LogEntry {
  const portion = {
    id: "33333333-3333-4333-8333-333333333333",
    label: "1 medium",
    grams: 100,
    ml: null,
  };
  const entry = buildLogEntry({
    food: buildFood({ id: FOOD_ID, name: options.name }),
    quantity: options.quantity,
    unit: options.unit,
    localDate: options.date,
    loggedAt: `${options.date}T${options.time}:00+00:00`,
    ...(options.unit === "portion" ? { portion } : {}),
  });

  return {
    ...entry,
    ...databaseColumns(),
    kcal: options.kcal,
    nutrients: {
      kcal: options.kcal,
      protein_g: options.protein,
      fat_g: options.fat,
      carbs_g: options.carbs,
      fibre_g: null,
    },
  };
}

export function quickEntry(options: {
  date: string;
  time: string;
  label: string;
  kcal: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}): LogEntry {
  const entry = buildQuickEntry({
    localDate: options.date,
    loggedAt: `${options.date}T${options.time}:00+00:00`,
    kcal: options.kcal,
    label: options.label,
    ...(options.protein === undefined ? {} : { protein_g: options.protein }),
    ...(options.fat === undefined ? {} : { fat_g: options.fat }),
    ...(options.carbs === undefined ? {} : { carbs_g: options.carbs }),
  });

  return { ...entry, ...databaseColumns(), kcal: options.kcal };
}

/** The sample day of the boards, Thursday 15 October 2026: 1,039 kcal, 86 g protein, 129 g carbohydrate, 19 g fat. */
export function sampleDay(date = "2026-10-15"): LogEntry[] {
  const base = { date, kcal: 0, protein: 0, fat: 0, carbs: 0 };
  return [
    foodEntry({
      ...base,
      time: "08:05",
      name: "Porridge oats",
      quantity: 50,
      unit: "g",
      kcal: 187,
      protein: 5.6,
      fat: 4.2,
      carbs: 30.2,
    }),
    foodEntry({
      ...base,
      time: "08:05",
      name: "Semi-skimmed milk",
      quantity: 200,
      unit: "ml",
      kcal: 92,
      protein: 7,
      fat: 3.4,
      carbs: 9.6,
    }),
    foodEntry({
      ...base,
      time: "08:10",
      name: "Banana",
      quantity: 1,
      unit: "portion",
      kcal: 95,
      protein: 1.2,
      fat: 0.1,
      carbs: 20.3,
    }),
    foodEntry({
      ...base,
      time: "12:40",
      name: "Chicken breast, grilled",
      quantity: 150,
      unit: "g",
      kcal: 222,
      protein: 48,
      fat: 3.3,
      carbs: 0,
    }),
    foodEntry({
      ...base,
      time: "12:40",
      name: "Basmati rice, boiled",
      quantity: 180,
      unit: "g",
      kcal: 216,
      protein: 4.9,
      fat: 0.7,
      carbs: 47.5,
    }),
    quickEntry({
      date,
      time: "12:45",
      label: "Meal deal crisps",
      kcal: 130,
      protein: 2,
      fat: 7,
      carbs: 15,
    }),
    foodEntry({
      ...base,
      time: "15:20",
      name: "Greek yoghurt 0% fat",
      quantity: 170,
      unit: "g",
      kcal: 97,
      protein: 17.3,
      fat: 0.3,
      carbs: 6.5,
    }),
  ];
}

/** The over target day: the sample day and a lasagne at 19:30, 2,412 kcal in all. */
export function overTargetDay(date = "2026-10-15"): LogEntry[] {
  return [
    ...sampleDay(date),
    foodEntry({
      date,
      time: "19:30",
      name: "Lasagne",
      quantity: 1,
      unit: "portion",
      kcal: 1373,
      protein: 64,
      fat: 62,
      carbs: 128,
    }),
  ];
}

export const targets: Targets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
export const noTargets: Targets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

/** A day as `useDiaryDay` returns it. */
export function diaryDay(localDate: string, entries: LogEntry[], isComplete = false): DiaryDay {
  return {
    localDate,
    entries,
    dayLog: isComplete
      ? {
          local_date: localDate,
          is_complete: true,
          completed_at: "2026-10-15T20:00:00+00:00",
          note: null,
        }
      : null,
    totals: null,
  };
}
