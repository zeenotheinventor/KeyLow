import { describe, expect, it } from "vitest";

import { keys } from "../src/queryKeys";

const SESSION_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const EXERCISE_ID = "77777777-7777-4777-8777-777777777777";
const ROUTINE_ID = "88888888-8888-4888-8888-888888888888";

describe("keys.profiles", () => {
  it("should expose the profiles root key", () => {
    expect(keys.profiles.all).toEqual(["profiles"]);
  });

  it("should build a detail key scoped to the profile id", () => {
    expect(keys.profiles.detail("user-1")).toEqual(["profiles", "user-1"]);
  });

  it("should expose a key for the signed in user's terms acceptance, under the profiles root", () => {
    expect(keys.profiles.termsAcceptance).toEqual(["profiles", "terms-acceptance"]);
  });

  it("should expose keys for the signed in user's targets and time zone, under the profiles root", () => {
    expect(keys.profiles.targets).toEqual(["profiles", "targets"]);
    expect(keys.profiles.timeZone).toEqual(["profiles", "time-zone"]);
  });

  it("should expose a key for the signed in user's weight unit, under the profiles root", () => {
    expect(keys.profiles.weightUnit).toEqual(["profiles", "weight-unit"]);
  });
});

describe("keys.foods", () => {
  it("should expose the foods root key", () => {
    expect(keys.foods.all).toEqual(["foods"]);
  });

  it("should build a detail key scoped to the food id", () => {
    expect(keys.foods.detail("food-1")).toEqual(["foods", "food-1"]);
  });

  it("should build a portions key nested under the food detail key", () => {
    expect(keys.foods.portions("food-1")).toEqual(["foods", "food-1", "portions"]);
  });

  it("should build a search key scoped to the query text", () => {
    expect(keys.foods.search("chicken")).toEqual(["foods", "search", "chicken"]);
  });

  it("should build an Open Food Facts search key scoped to the query text", () => {
    expect(keys.foods.offSearch("chicken")).toEqual(["foods", "off-search", "chicken"]);
  });

  it("should build a barcode key scoped to the code", () => {
    expect(keys.foods.barcode("0036000291452")).toEqual(["foods", "barcode", "0036000291452"]);
  });

  it("should expose a key for the list of the user's own foods", () => {
    expect(keys.foods.own).toEqual(["foods", "own"]);
  });

  it("should nest every foods key under the foods root so one invalidation covers them all", () => {
    const rootLength = keys.foods.all.length;

    for (const key of [
      keys.foods.detail("food-1"),
      keys.foods.portions("food-1"),
      keys.foods.search("chicken"),
      keys.foods.offSearch("chicken"),
      keys.foods.barcode("0036000291452"),
      keys.foods.own,
    ]) {
      expect(key.slice(0, rootLength)).toEqual(keys.foods.all);
    }
  });
});

describe("keys.diary", () => {
  it("should expose the diary root key", () => {
    expect(keys.diary.all).toEqual(["diary"]);
  });

  it("should build a day key scoped to the local date", () => {
    expect(keys.diary.day("2026-10-15")).toEqual(["diary", "day", "2026-10-15"]);
  });

  it("should build a week key scoped to the Monday", () => {
    expect(keys.diary.week("2026-10-12")).toEqual(["diary", "week", "2026-10-12"]);
  });

  it("should build a complete days key scoped to the month", () => {
    expect(keys.diary.completeDays("2026-10")).toEqual(["diary", "complete-days", "2026-10"]);
  });

  it("should expose a key for the recent foods", () => {
    expect(keys.diary.recentFoods).toEqual(["diary", "recent-foods"]);
  });

  it("should expose the prefix of every day key and of every week key, for invalidating them all", () => {
    expect(keys.diary.days).toEqual(["diary", "day"]);
    expect(keys.diary.weeks).toEqual(["diary", "week"]);
    expect(keys.diary.day("2026-10-15").slice(0, 2)).toEqual(keys.diary.days);
    expect(keys.diary.week("2026-10-12").slice(0, 2)).toEqual(keys.diary.weeks);
  });

  it("should key one entry under the prefix of every entry key", () => {
    expect(keys.diary.entries).toEqual(["diary", "entry"]);
    expect(keys.diary.entry("entry-1")).toEqual(["diary", "entry", "entry-1"]);
  });

  it("should expose the prefix of every complete-days key", () => {
    expect(keys.diary.completeDaysAll).toEqual(["diary", "complete-days"]);
    expect(keys.diary.completeDays("2026-10").slice(0, 2)).toEqual(keys.diary.completeDaysAll);
  });

  it("should nest every diary key under the diary root so one invalidation covers them all", () => {
    for (const key of [
      keys.diary.entry("entry-1"),
      keys.diary.day("2026-10-15"),
      keys.diary.week("2026-10-12"),
      keys.diary.completeDays("2026-10"),
      keys.diary.recentFoods,
    ]) {
      expect(key.slice(0, 1)).toEqual(keys.diary.all);
    }
  });
});

describe("keys.recipes", () => {
  it("should expose the recipes root key", () => {
    expect(keys.recipes.all).toEqual(["recipes"]);
  });

  it("should build a list key scoped to whether archived recipes are included", () => {
    expect(keys.recipes.list(false)).toEqual(["recipes", "list", false]);
    expect(keys.recipes.list(true)).toEqual(["recipes", "list", true]);
  });

  it("should build a detail key scoped to the recipe id", () => {
    expect(keys.recipes.detail("recipe-1")).toEqual(["recipes", "detail", "recipe-1"]);
  });

  it("should build a refresh preview key scoped to the recipe id", () => {
    expect(keys.recipes.refresh("recipe-1")).toEqual(["recipes", "refresh", "recipe-1"]);
  });

  it("should build a search key scoped to the query text, live recipes only unless archived is asked for", () => {
    expect(keys.recipes.search("stew")).toEqual(["recipes", "search", "stew", false]);
    expect(keys.recipes.search("stew", true)).toEqual(["recipes", "search", "stew", true]);
  });

  it("should nest every recipes key under the recipes root so one invalidation covers them all", () => {
    for (const key of [
      keys.recipes.list(false),
      keys.recipes.detail("recipe-1"),
      keys.recipes.refresh("recipe-1"),
      keys.recipes.search("stew"),
    ]) {
      expect(key.slice(0, 1)).toEqual(keys.recipes.all);
    }
  });
});

describe("keys.weighIns", () => {
  it("should expose the weigh-ins root key", () => {
    expect(keys.weighIns.all).toEqual(["weigh-ins"]);
  });

  it("should expose the list key nested under the weigh-ins root", () => {
    expect(keys.weighIns.list).toEqual(["weigh-ins", "list"]);
    expect(keys.weighIns.list.slice(0, 1)).toEqual(keys.weighIns.all);
  });
});

describe("keys.training", () => {
  it("should expose the training root key", () => {
    expect(keys.training.all).toEqual(["training"]);
  });

  it("should key the sets by the first day of their window and nothing else", () => {
    expect(keys.training.sets("2026-10-03")).toEqual(["training", "sets", "2026-10-03"]);
  });

  it("should expose the key of whether any session was ever logged", () => {
    expect(keys.training.hasLoggedSession).toEqual(["training", "has-logged-session"]);
  });

  it("should expose the active routine key", () => {
    expect(keys.training.activeRoutine).toEqual(["training", "active-routine"]);
  });

  it("should key a week's sessions by the Monday", () => {
    expect(keys.training.weekSessions("2026-10-12")).toEqual([
      "training",
      "week-sessions",
      "2026-10-12",
    ]);
  });

  it("should expose the prefix of every sets key and of every week sessions key, for a persisted list", () => {
    expect(keys.training.setsAll).toEqual(["training", "sets"]);
    expect(keys.training.weekSessionsAll).toEqual(["training", "week-sessions"]);
    expect(keys.training.sets("2026-10-03").slice(0, 2)).toEqual(keys.training.setsAll);
    expect(keys.training.weekSessions("2026-10-12").slice(0, 2)).toEqual(
      keys.training.weekSessionsAll,
    );
  });

  it("should key a session by its id under the sessions prefix", () => {
    expect(keys.training.session(SESSION_ID)).toEqual(["training", "sessions", SESSION_ID]);
    expect(keys.training.sessionsAll).toEqual(["training", "sessions"]);
    expect(keys.training.session(SESSION_ID).slice(0, 2)).toEqual(keys.training.sessionsAll);
  });

  it("should expose the active session key", () => {
    expect(keys.training.activeSession).toEqual(["training", "active-session"]);
  });

  it("should key the last performance by the exercise, and by the session left out when one is", () => {
    expect(keys.training.lastPerformance(EXERCISE_ID)).toEqual([
      "training",
      "last-performance",
      EXERCISE_ID,
    ]);
    expect(keys.training.lastPerformance(EXERCISE_ID, SESSION_ID)).toEqual([
      "training",
      "last-performance",
      EXERCISE_ID,
      SESSION_ID,
    ]);
    expect(keys.training.lastPerformance(EXERCISE_ID, SESSION_ID).slice(0, 3)).toEqual(
      keys.training.lastPerformance(EXERCISE_ID),
    );
  });

  it("should expose the prefix of every last performance key, to refresh them all after a set is logged", () => {
    expect(keys.training.lastPerformanceAll).toEqual(["training", "last-performance"]);
    for (const key of [
      keys.training.lastPerformance(EXERCISE_ID),
      keys.training.lastPerformance(EXERCISE_ID, SESSION_ID),
    ]) {
      expect(key.slice(0, 2)).toEqual(keys.training.lastPerformanceAll);
    }
  });

  it("should not put the session reads under the prefix of any other training family", () => {
    for (const key of [
      keys.training.session(SESSION_ID),
      keys.training.activeSession,
      keys.training.lastPerformance(EXERCISE_ID, SESSION_ID),
    ]) {
      for (const prefix of [keys.training.setsAll, keys.training.weekSessionsAll]) {
        expect(key.slice(0, prefix.length)).not.toEqual(prefix);
      }
    }
  });

  it("should key the history of a week by its Monday, under the history prefix", () => {
    expect(keys.training.historyAll).toEqual(["training", "history"]);
    expect(keys.training.history("2026-10-12")).toEqual(["training", "history", "2026-10-12"]);
    expect(keys.training.history("2026-10-12").slice(0, 2)).toEqual(keys.training.historyAll);
  });

  it("should key the history list, the infinite read of weeks, under the history prefix and apart from every week", () => {
    expect(keys.training.historyList).toEqual(["training", "history", "list"]);
    expect(keys.training.historyList.slice(0, 2)).toEqual(keys.training.historyAll);
    expect(keys.training.history("2026-10-12")).not.toEqual(keys.training.historyList);
  });

  it("should keep the history prefix apart from the week sessions and the session reads", () => {
    for (const prefix of [
      keys.training.weekSessionsAll,
      keys.training.sessionsAll,
      keys.training.setsAll,
    ]) {
      expect(keys.training.history("2026-10-12").slice(0, prefix.length)).not.toEqual(prefix);
      expect(keys.training.historyList.slice(0, prefix.length)).not.toEqual(prefix);
    }
  });

  it("should hold fixed words and a date only in a history key, never a session, an exercise or a muscle", () => {
    for (const key of [keys.training.history("2026-10-12"), keys.training.historyList]) {
      for (const part of key) {
        expect(part).toMatch(/^(training|history|list|\d{4}-\d{2}-\d{2})$/);
      }
    }
  });

  it("should key the routine library by whether archived routines are included, under the routines prefix", () => {
    expect(keys.training.routines(false)).toEqual(["training", "routines", false]);
    expect(keys.training.routines(true)).toEqual(["training", "routines", true]);
    expect(keys.training.routinesAll).toEqual(["training", "routines"]);
    expect(keys.training.routines(true).slice(0, 2)).toEqual(keys.training.routinesAll);
  });

  it("should key one routine by its id under the routine prefix", () => {
    expect(keys.training.routine(ROUTINE_ID)).toEqual(["training", "routine", ROUTINE_ID]);
    expect(keys.training.routineAll).toEqual(["training", "routine"]);
    expect(keys.training.routine(ROUTINE_ID).slice(0, 2)).toEqual(keys.training.routineAll);
  });

  it("should key the current training goal with fixed words only", () => {
    expect(keys.training.goals).toEqual(["training", "goals"]);
  });

  it("should keep the goal history outside the prefix of the persisted current goal, and under the training root", () => {
    expect(keys.training.goalsHistory).toEqual(["training", "goals-history"]);
    expect(keys.training.goalsHistory.slice(0, 2)).not.toEqual(keys.training.goals);
    expect(keys.training.goalsHistory[0]).toBe(keys.training.all[0]);
  });

  it("should keep the routine reads apart from each other and from every other training prefix", () => {
    const prefixes = [
      keys.training.setsAll,
      keys.training.weekSessionsAll,
      keys.training.sessionsAll,
      keys.training.routinesAll,
      keys.training.routineAll,
      keys.training.activeRoutine,
    ];
    for (const key of [keys.training.routines(true), keys.training.routine(ROUTINE_ID)]) {
      expect(
        prefixes.filter((prefix) => key.slice(0, prefix.length).join() === prefix.join()),
      ).toHaveLength(1);
    }
  });

  it("should hold fixed words, a flag and an id only in a routine key, never a name or an exercise", () => {
    const words =
      /^(training|routines|routine|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
    for (const key of [keys.training.routines(false), keys.training.routine(ROUTINE_ID)]) {
      for (const part of key) {
        expect(typeof part === "boolean" || words.test(part)).toBe(true);
      }
    }
  });

  it("should nest every training key under the training root so one invalidation covers them all", () => {
    for (const key of [
      keys.training.sets("2026-10-03"),
      keys.training.activeRoutine,
      keys.training.weekSessions("2026-10-12"),
      keys.training.session(SESSION_ID),
      keys.training.activeSession,
      keys.training.lastPerformance(EXERCISE_ID),
    ]) {
      expect(key.slice(0, 1)).toEqual(keys.training.all);
    }
  });

  it("should hold dates, ids and fixed words only, so no key carries a set value, a load or a muscle", () => {
    const words =
      /^(training|sets|active-routine|week-sessions|sessions|active-session|last-performance|\d{4}-\d{2}-\d{2}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/;
    for (const key of [
      keys.training.sets("2026-10-03"),
      keys.training.activeRoutine,
      keys.training.weekSessions("2026-10-12"),
      keys.training.session(SESSION_ID),
      keys.training.activeSession,
      keys.training.lastPerformance(EXERCISE_ID, SESSION_ID),
    ]) {
      for (const part of key) {
        expect(part).toMatch(words);
      }
    }
  });
});
