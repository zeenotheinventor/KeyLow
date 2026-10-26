import {
  getFood,
  listFoodPortions,
  useLogEntries,
  useProfileTimeZone,
  useSupabase,
} from "@keylow/api-client";
import { describeLoggedPlate } from "@keylow/core/copy";
import { formatClockTime, parseClockTime } from "@keylow/core/dates";
import { clockTimeOn, openingLoggedAt } from "@keylow/core/diary";
import { plateFoodAmount, plateItemName } from "@keylow/core/plate";
import { useRouter } from "expo-router";
import { useCallback } from "react";

import { usePlate, usePlateLoggingGuard } from "./usePlate";
import { useToast } from "../../components/ui";
import { diaryHref, useCloseFoodsSheet } from "../navigation";
import { useReadsEnabled } from "../useReadsEnabled";

import type { LogPlateResult } from "./types";
import type { LogEntriesItem } from "@keylow/api-client";
import type { LogContext } from "@keylow/core/diary";
import type { PlateItem } from "@keylow/core/plate";
import type { Food, FoodPortion } from "@keylow/core/schemas";

type LoadedFood = { food: Food; portions: FoodPortion[] };
type Client = ReturnType<typeof useSupabase>;

// Every distinct food on the plate, read once with its portions. A food that cannot be read, or is no longer
// visible, fails the whole log: the plate is never partly logged.
async function loadFoods(
  client: Client,
  items: readonly PlateItem[],
): Promise<Map<string, LoadedFood>> {
  const foodIds = new Set(items.flatMap((item) => (item.kind === "food" ? [item.foodId] : [])));
  const loaded = await Promise.all(
    [...foodIds].map(async (foodId) => {
      const [food, portions] = await Promise.all([
        getFood(client, foodId),
        listFoodPortions(client, foodId),
      ]);
      if (food === null) {
        throw new Error("A food on the plate is no longer there");
      }

      return [foodId, { food, portions }] as const;
    }),
  );

  return new Map(loaded);
}

// What one row is logged as, at the time the whole plate shares. Undefined when the row cannot be logged.
function entryOfRow(
  item: PlateItem,
  foods: ReadonlyMap<string, LoadedFood>,
  when: { loggedAt: string; localDate: string },
): LogEntriesItem | undefined {
  if (item.kind === "recipe") {
    return {
      kind: "recipe",
      input: { recipe: item.recipe, quantity: item.quantity, unit: item.unit, ...when },
    };
  }
  const loaded = foods.get(item.foodId);
  const amount = loaded === undefined ? undefined : plateFoodAmount(item, loaded.portions);
  if (loaded === undefined || amount === undefined) {
    return undefined;
  }

  return {
    kind: "food",
    input: {
      food: loaded.food,
      quantity: amount.quantity,
      unit: amount.unit,
      ...(amount.unit === "portion" ? { portion: amount.portion } : {}),
      foodPortions: loaded.portions,
      ...when,
    },
  };
}

/**
 * The one action that logs the plate. `logPlate` reads the foods on the plate, logs every row in one
 * all-or-nothing write at the plate's time on the sheet's day, and on success shows the toast and takes the
 * person to the diary at that hour, closing the sheet (and so the plate). It never throws: `{ ok: false }`
 * means nothing was written and the plate is as it was, and the caller says so where its board does. A call
 * that did nothing because a log was running, or the plate could not be logged, has `wasIgnored` set and
 * needs no sentence. Nothing from the plate goes into an error, a log or a breadcrumb.
 */
export function useLogPlate(context: LogContext | undefined): {
  logPlate: () => Promise<LogPlateResult>;
} {
  const plate = usePlate();
  const router = useRouter();
  const client = useSupabase();
  const toast = useToast();
  const closeSheet = useCloseFoodsSheet();
  const logEntries = useLogEntries();
  const profileTimeZone = useProfileTimeZone({ enabled: useReadsEnabled() });
  const { items, time, canLog } = plate;
  const { startLogging, finishLogging, markLogged } = usePlateLoggingGuard();
  const day = context?.day;
  const { mutateAsync } = logEntries;
  const timeZone = profileTimeZone.data === undefined ? undefined : (profileTimeZone.data ?? "UTC");

  const logPlate = useCallback(async (): Promise<LogPlateResult> => {
    if (!canLog || timeZone === undefined || !startLogging()) {
      return { ok: false, wasIgnored: true };
    }
    const zone = timeZone;

    // Writes the plate, and says when it was logged. Undefined means nothing was written.
    async function writePlate() {
      // "Now" is the moment Log foods is pressed. A past day takes the current clock time on that day.
      const opening = openingLoggedAt(new Date(), day === undefined ? undefined : { day }, zone);
      const { loggedAt, localDate } = time.isNow
        ? opening
        : clockTimeOn(opening.localDate, time.time, zone);
      const when = { loggedAt: loggedAt.toISOString(), localDate };
      const foods = await loadFoods(client, items);
      const entries = items.map((item) => entryOfRow(item, foods, when));
      const loggable = entries.filter((entry) => entry !== undefined);
      if (loggable.length !== items.length) {
        return undefined;
      }
      await mutateAsync(loggable);

      return { loggedAt, localDate };
    }

    // The failure is not kept: it can quote a food or an amount, which is health data.
    const written = await writePlate().catch(() => undefined);
    if (written === undefined) {
      finishLogging();

      return { ok: false };
    }

    // The plate is logged, so the log stays held: the sheet is closing and its provider goes with it, and
    // a second press in that time would log the plate again.
    toast.show({
      message: describeLoggedPlate(items.map(plateItemName)),
      tone: "success",
      icon: "Check",
    });
    const hour = parseClockTime(formatClockTime(written.loggedAt, zone))?.hour;
    // The sheet's guard lets a close through once the plate is logged, so the close waits for that render.
    markLogged(() => {
      closeSheet();
      router.push(diaryHref(written.localDate, hour));
    });

    return { ok: true };
  }, [
    canLog,
    timeZone,
    startLogging,
    finishLogging,
    markLogged,
    day,
    time,
    client,
    items,
    mutateAsync,
    toast,
    closeSheet,
    router,
  ]);

  return { logPlate };
}
