import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/suggestion";
import {
  allHot,
  bandsOnly,
  detailForFreshToday,
  detailForThursday,
  forFreshToday,
  forThursday,
  forToday,
  goldenAdd,
  noRoomOnLegs,
  prioritiesCovered,
  plannedRepRanges,
  strengthGoals,
  strengthOnLegs,
  strengthSession,
  twoAdds,
  vTaperGoals,
  vTaperSession,
} from "./suggestionInputs";
import {
  describeNothingToSuggest,
  describeSuggestionAccepted,
  describeSuggestionCard,
  describeSuggestionDetail,
  EXERCISE_PROPER_WORDS,
  SUGGESTION_ACCEPTED,
  SUGGESTION_CARD,
  SUGGESTION_DETAIL,
  SUGGESTION_NO_GOAL,
} from "../../src/copy";

import type {
  NothingToSuggest,
  PlanAdjusted,
  SuggestedSession,
  SuggestionReason,
} from "../../src/training";

/*
 * The words of the suggestion card, its detail, the accepted card and toast, and the nothing-to-add card
 * (KEY-418, canvas version 30, boards `suggestion · *`). The suggestions are what `suggestSession` gives for
 * the golden week on Wednesday 14 October 2026, 12:00 (the cases of Zee's agreed document on KEY-396,
 * Part 4), so every number in a sentence is checked against the data it came from. The strings are
 * literals from the boards, except where the pull request says a board does not draw one.
 */

describe("the card for the golden suggestion, for a day that is tomorrow", () => {
  const card = describeSuggestionCard(goldenAdd, forThursday);

  it("should name the day in the label and the sentence, as the board does", () => {
    expect(card.label).toBe("Suggested for Thursday");
    expect(card.sentence).toBe(
      "Add 3 sets of incline dumbbell press to the end of Thursday's Legs.",
    );
  });

  it("should head the card with the planned day and the exercise added", () => {
    // The board writes "Legs, plus incline press": no data holds a shorter name, so the catalogue's is used.
    expect(card.headline).toBe("Legs, plus incline dumbbell press");
  });

  it("should give the three reasons of the board, each from the suggestion's own numbers", () => {
    expect(card.reasons).toStrictEqual([
      {
        kind: "volume",
        text: "Upper chest: 4.8 sets in the last 7 days, target 12, a V-taper priority",
      },
      { kind: "heat", text: "Upper chest is ready now: heat 13 %, light" },
      { kind: "length", text: "Thursday goes from 16 to 19 sets, about 60 minutes" },
    ]);
  });

  it("should offer Add to Thursday and Not now", () => {
    expect(card.primaryAction).toBe("Add to Thursday");
    expect(card.dismissAction).toBe("Not now");
  });

  it("should name the card, the link, the reasons list and each button with the day", () => {
    expect(card.cardName).toBe("Suggestion for Thursday");
    expect(card.linkName).toBe(
      "Suggested for Thursday: Legs, plus incline dumbbell press. See why",
    );
    expect(card.reasonsName).toBe("Why Ki-Lo suggests this for Thursday");
    expect(card.primaryActionName).toBe("Add to Thursday");
    expect(card.dismissActionName).toBe("Not now for Thursday's suggestion");
  });
});

describe("the card for the same suggestion, for today", () => {
  const card = describeSuggestionCard(goldenAdd, forToday);

  it("should offer Start and not Add to Thursday", () => {
    expect(card.primaryAction).toBe("Start");
    expect(card.primaryActionName).toBe("Start Legs with the added exercise");
  });

  it("should say today where the board says Thursday", () => {
    expect(card.label).toBe("Suggested for today");
    expect(card.sentence).toBe("Add 3 sets of incline dumbbell press to the end of today's Legs.");
    expect(card.reasons.at(-1)).toStrictEqual({
      kind: "length",
      text: "Today goes from 16 to 19 sets, about 60 minutes",
    });
    expect(card.cardName).toBe("Suggestion for today");
    expect(card.dismissActionName).toBe("Not now for today's suggestion");
  });
});

describe("the card when two exercises are added", () => {
  const card = describeSuggestionCard(twoAdds, forThursday);

  it("should list both in the sentence", () => {
    expect(card.sentence).toBe(
      "Add 3 sets of incline dumbbell press and 3 sets of side lateral raise to the end of Thursday's Legs.",
    );
    expect(card.headline).toBe("Legs, plus incline dumbbell press and side lateral raise");
  });

  it("should say last 7 days of the logged sets for every pick", () => {
    const volumeLines = card.reasons.filter((reason) => reason.kind === "volume");
    expect(volumeLines.map((reason) => reason.text)).toStrictEqual([
      "Upper chest: 4.8 sets in the last 7 days, target 12, a V-taper priority",
      "Side delts: 5.5 sets in the last 7 days, target 10, a V-taper priority",
    ]);
  });

  it("should read the length from the data: 16 to 22 sets, about 70 minutes", () => {
    expect(card.reasons.at(-1)?.text).toBe("Thursday goes from 16 to 22 sets, about 70 minutes");
  });
});

describe("the card of a fresh session, which is always for today", () => {
  const card = describeSuggestionCard(vTaperSession, forFreshToday);

  it("should offer Start", () => {
    expect(card.primaryAction).toBe("Start");
    expect(card.primaryActionName).toBe("Start the suggested session");
  });

  it("should state the session from its own exercises, sets and minutes", () => {
    expect(card.label).toBe("Suggested for today");
    expect(card.headline).toBe("A session built for your week");
    expect(card.sentence).toBe("A session of 6 exercises and 18 sets, about 55 min.");
  });

  it("should give the first pick's reasons and no length line", () => {
    expect(card.reasons.map((reason) => reason.kind)).toStrictEqual(["volume", "heat"]);
  });
});

describe("the priority a reason names", () => {
  const lead = strengthSession.exercises[0]?.reasons[0];
  if (lead === undefined) {
    throw new Error("The strength session has a first reason");
  }
  const strengthWith = (
    reason: SuggestionReason,
    goals: typeof strengthGoals,
  ): string | undefined => {
    const first = strengthSession.exercises[0];
    if (first === undefined) {
      throw new Error("The strength session has an exercise");
    }
    const session: SuggestedSession = {
      ...strengthSession,
      exercises: [{ ...first, reasons: [reason] }],
    };
    return describeSuggestionCard(session, { ...forFreshToday, goals }).reasons[0]?.text;
  };

  it("should call a priority of 3 that no focus raised a top priority", () => {
    expect(strengthWith(lead, strengthGoals)).toBe(
      "Lower back: 0 sets in the last 7 days, target 10, a top priority",
    );
  });

  it("should call a priority of 2 that no focus raised an important priority", () => {
    expect(strengthWith({ ...lead, priority: 2 }, strengthGoals)).toBe(
      "Lower back: 0 sets in the last 7 days, target 10, an important priority",
    );
  });

  it("should call a priority of 1 a priority to keep up", () => {
    expect(strengthWith({ ...lead, priority: 1 }, strengthGoals)).toBe(
      "Lower back: 0 sets in the last 7 days, target 10, a priority to keep up",
    );
  });

  it("should name the focus that raised the muscle, with the right article", () => {
    const arms = { ...strengthGoals, focus: ["arms"] } satisfies typeof strengthGoals;
    expect(strengthWith({ ...lead, muscle_id: "biceps", priority: 3 }, arms)).toBe(
      "Biceps: 0 sets in the last 7 days, target 10, an arms priority",
    );
    const chest = { ...strengthGoals, focus: ["chest"] } satisfies typeof strengthGoals;
    expect(strengthWith({ ...lead, muscle_id: "chest_upper", priority: 3 }, chest)).toBe(
      "Upper chest: 0 sets in the last 7 days, target 10, a chest priority",
    );
  });

  it("should not name a focus that raised the muscle to a different priority", () => {
    // The V-taper focus raises upper chest to 3, so at 2 the goal's own base gave it.
    const vTaper = { ...strengthGoals, focus: ["v_taper"] } satisfies typeof strengthGoals;
    expect(strengthWith({ ...lead, muscle_id: "chest_upper", priority: 2 }, vTaper)).toBe(
      "Upper chest: 0 sets in the last 7 days, target 10, an important priority",
    );
  });
});

describe("the detail for the golden suggestion", () => {
  const detail = describeSuggestionDetail(goldenAdd, detailForThursday);

  it("should write the title, the day line, the headline and the load line", () => {
    expect(detail.title).toBe("Suggested for Thursday");
    expect(detail.dayLine).toBe("Thursday 15 October · your planned Legs");
    expect(detail.headline).toBe("Legs, plus incline dumbbell press");
    expect(detail.loadLine).toBe("6 exercises · 19 sets · about 60 min");
  });

  it("should list the five planned exercises from the plan, with their targets", () => {
    expect(detail.rows.slice(0, 5)).toStrictEqual([
      { name: "Barbell squat", target: "3 × 5 to 8 · RIR 2", why: "From your plan", added: false },
      {
        name: "Romanian deadlift",
        target: "3 × 8 to 10 · RIR 2",
        why: "From your plan",
        added: false,
      },
      { name: "Leg press", target: "3 × 10 to 12 · RIR 1", why: "From your plan", added: false },
      {
        name: "Seated leg curl",
        target: "3 × 10 to 12 · RIR 1",
        why: "From your plan",
        added: false,
      },
      {
        name: "Standing calf raises",
        target: "4 × 10 to 15 · RIR 1",
        why: "From your plan",
        added: false,
      },
    ]);
  });

  it("should give the added exercise its target and why, ending with what did not fit", () => {
    expect(detail.rows[5]).toStrictEqual({
      name: "Incline dumbbell press",
      target: "3 × 8 to 10 · RIR 2",
      why: "Added. Upper chest is a V-taper priority, at 4.8 of 12 sets in the last 7 days, and ready now at heat 13 %. Side delts would not fit your 60 minutes.",
      added: true,
    });
  });

  it("should end with the footnote and offer Not now and Add to Thursday", () => {
    expect(detail.footnote).toBe(
      "Ki-Lo keeps your plan and adds what your week is short of. Muscles still hot are left out.",
    );
    expect(detail.dismissAction).toBe("Not now");
    expect(detail.primaryAction).toBe("Add to Thursday");
    expect(detail.backLabel).toBe("Back to Train");
    expect(detail.listName).toBe("Exercises for Thursday");
  });

  it("should offer Start for today", () => {
    const today = describeSuggestionDetail(goldenAdd, { ...detailForThursday, ...forToday });
    expect(today.primaryAction).toBe("Start");
    expect(today.title).toBe("Suggested for today");
  });

  it("should say last 7 days of the logged sets for every pick, and not say what fits when everything did", () => {
    const rows = describeSuggestionDetail(twoAdds, detailForThursday).rows.slice(5);
    expect(rows.map((row) => row.why)).toStrictEqual([
      "Added. Upper chest is a V-taper priority, at 4.8 of 12 sets in the last 7 days, and ready now at heat 13 %.",
      "Added. Side delts are a V-taper priority, at 5.5 of 10 sets in the last 7 days, and ready now at heat 12 %.",
    ]);
  });

  it("should throw a rule, never a value, for a planned exercise with no rep range", () => {
    expect(() =>
      describeSuggestionDetail(goldenAdd, { ...detailForThursday, plannedRepRanges: new Map() }),
    ).toThrow("A planned exercise must have a rep range");
  });
});

describe("the detail of a suggestion whose lead exercise has several reasons", () => {
  const detail = describeSuggestionDetail(strengthSession, {
    ...detailForFreshToday,
    goals: strengthGoals,
  });

  it("should read the deadlift's other primary muscles after the lead, joined in words", () => {
    expect(detail.rows[0]?.why).toBe(
      "Added. Lower back is a top priority, at 0 of 10 sets in the last 7 days, and ready now at heat 0 %. Glutes and hamstrings are short of target too.",
    );
  });

  it("should word a session with no plan to keep", () => {
    expect(detail.dayLine).toBe("Wednesday 14 October · built for your week");
    expect(detail.footnote).toBe(
      "Ki-Lo builds this from what your week is short of. Muscles still hot are left out.",
    );
  });
});

describe("a single other muscle and three other muscles after the lead", () => {
  const base = strengthSession.exercises[0];
  if (base === undefined) {
    throw new Error("The strength session has an exercise");
  }
  const lead = base.reasons[0];
  const second = base.reasons[1];
  const third = base.reasons[2];
  if (lead === undefined || second === undefined || third === undefined) {
    throw new Error("The deadlift has three reasons");
  }
  const withReasons = (reasons: typeof base.reasons): SuggestedSession => ({
    ...strengthSession,
    exercises: [{ ...base, reasons }, ...strengthSession.exercises.slice(1)],
  });
  const whyOf = (session: SuggestedSession): string | undefined =>
    describeSuggestionDetail(session, { ...detailForFreshToday, goals: strengthGoals }).rows[0]
      ?.why;

  it("should add no line for a lead with no other reason", () => {
    expect(whyOf(withReasons([lead]))).toBe(
      "Added. Lower back is a top priority, at 0 of 10 sets in the last 7 days, and ready now at heat 0 %.",
    );
  });

  it("should read one other muscle as a single name", () => {
    expect(whyOf(withReasons([lead, second]))).toContain(" Glutes are short of target too.");
  });

  it("should join three other muscles with a comma and and", () => {
    const fourth: SuggestionReason = { ...third, muscle_id: "calves" };
    expect(whyOf(withReasons([lead, second, third, fourth]))).toContain(
      " Glutes, hamstrings and calves are short of target too.",
    );
  });

  it("should use is for one other muscle whose name reads as one thing", () => {
    const lowerBack: SuggestionReason = { ...second, muscle_id: "lower_back" };
    expect(whyOf(withReasons([lead, lowerBack]))).toContain(" Lower back is short of target too.");
  });
});

describe("the accepted card and toast", () => {
  const accepted = describeSuggestionAccepted(goldenAdd, forThursday);

  it("should write the card from the day's own sets and the exercise added", () => {
    expect(accepted.title).toBe("Thursday's Legs: 19 sets");
    expect(accepted.detail).toBe(
      "Now with 3 sets of incline dumbbell press. They count as planned.",
    );
    expect(accepted.cardName).toBe("Thursday");
  });

  it("should write the toast and its Undo", () => {
    expect(accepted.toast).toBe("Added to Thursday: 3 sets of incline dumbbell press");
    expect(accepted.undoAction).toBe("Undo");
    expect(accepted.undoActionName).toBe("Undo adding to Thursday");
  });

  it("should list every exercise added", () => {
    const both = describeSuggestionAccepted(twoAdds, forThursday);
    expect(both.title).toBe("Thursday's Legs: 22 sets");
    expect(both.toast).toBe(
      "Added to Thursday: 3 sets of incline dumbbell press and 3 sets of side lateral raise",
    );
  });
});

describe("the nothing-to-add card", () => {
  it("should write the board's card for a day that is tomorrow", () => {
    expect(describeNothingToSuggest(prioritiesCovered, forThursday)).toStrictEqual({
      cardName: "Suggestion for Thursday",
      title: "Nothing to add for Thursday",
      body: "Your plan already covers your priorities. Train as planned.",
    });
  });

  it("should write it for today", () => {
    const copy = describeNothingToSuggest(prioritiesCovered, forToday);
    expect(copy.title).toBe("Nothing to add for today");
    expect(copy.cardName).toBe("Suggestion for today");
  });

  it("should not speak of a plan when the day has none", () => {
    expect(describeNothingToSuggest(prioritiesCovered, forFreshToday).body).toBe(
      "Your training already covers your priorities.",
    );
  });

  it("should say what would not fit, from the suggestion's own muscle and minutes", () => {
    expect(noRoomOnLegs).toMatchObject({
      why: "no_room",
      no_room: { muscle_id: "chest_upper", minutes_if_added: 60 },
    });
    expect(
      describeNothingToSuggest(noRoomOnLegs, {
        ...forThursday,
        goals: { ...vTaperGoals, limit_minutes: 45 },
      }).body,
    ).toBe(
      "Adding upper chest work would take Thursday to about 60 min, over your 45 minutes. Train as planned.",
    );
  });

  it("should name the muscles that are still hot, from the skipped list", () => {
    expect(describeNothingToSuggest(allHot, forThursday).body).toBe(
      "The muscles your week is short of are still hot: lats and biceps. Train as planned.",
    );
  });

  it("should name a single hot muscle with no and", () => {
    const oneHot: NothingToSuggest = { ...allHot, skipped: [{ muscle_id: "lats", heat: 0.63 }] };
    expect(describeNothingToSuggest(oneHot, forThursday).body).toBe(
      "The muscles your week is short of are still hot: lats. Train as planned.",
    );
  });

  it("should say there is no exercise for the equipment the user picked", () => {
    expect(bandsOnly.why).toBe("no_exercise");
    expect(describeNothingToSuggest(bandsOnly, forThursday).body).toBe(
      "Ki-Lo has no exercise for the muscles your week is short of with the equipment you picked. Train as planned.",
    );
  });

  it("should end a fresh day's reasons without a plan to train", () => {
    expect(describeNothingToSuggest(bandsOnly, forFreshToday).body).toBe(
      "Ki-Lo has no exercise for the muscles your week is short of with the equipment you picked.",
    );
  });
});

describe("the sets called the last 7 days are the logged sets", () => {
  it("should read 0 sets for the strength user on Legs, not the 2.1 sets the Legs plan gives", () => {
    const lead = strengthOnLegs.exercises.at(-1);
    expect(lead?.origin === "added" && lead.reasons[0]?.weekly_sets).toBeCloseTo(2.1);
    const card = describeSuggestionCard(strengthOnLegs, {
      ...forThursday,
      goals: strengthGoals,
    });
    expect(card.reasons[0]?.text).toBe(
      "Lower back: 0 sets in the last 7 days, target 10, a top priority",
    );
    const detail = describeSuggestionDetail(strengthOnLegs, {
      ...detailForThursday,
      goals: strengthGoals,
    });
    expect(detail.rows.at(-1)?.why).toContain("at 0 of 10 sets in the last 7 days");
  });
});

describe("ready now is only said of a muscle that is ready", () => {
  // The ready share of a muscle's capacity is 0.25 in v1.
  const withHeat = (heat: number): PlanAdjusted => ({
    ...goldenAdd,
    exercises: goldenAdd.exercises.map((exercise) =>
      exercise.origin === "added"
        ? { ...exercise, reasons: exercise.reasons.map((reason) => ({ ...reason, heat })) }
        : exercise,
    ),
  });
  const heatLineOf = (heat: number) =>
    describeSuggestionCard(withHeat(heat), forThursday).reasons[1]?.text;
  const whyOf = (heat: number) =>
    describeSuggestionDetail(withHeat(heat), detailForThursday).rows[5]?.why;

  it("should keep the claim at 13 % and exactly at the ready share", () => {
    expect(heatLineOf(0.13)).toBe("Upper chest is ready now: heat 13 %, light");
    expect(heatLineOf(0.25)).toBe("Upper chest is ready now: heat 25 %, warm");
  });

  it("should drop the claim at 30 % and at 45 %", () => {
    expect(heatLineOf(0.3)).toBe("Upper chest: heat 30 %, warm");
    expect(heatLineOf(0.45)).toBe("Upper chest: heat 45 %, hot");
  });

  it("should drop the claim from the detail too", () => {
    expect(whyOf(0.3)).toContain("in the last 7 days, and at heat 30 %.");
    expect(whyOf(0.3)).not.toContain("ready now");
    expect(whyOf(0.13)).toContain("in the last 7 days, and ready now at heat 13 %.");
  });
});

describe("exercise names inside sentences", () => {
  const curatedFile = path.join(
    import.meta.dirname,
    "..",
    "..",
    "..",
    "db",
    "data",
    "exercises",
    "exercises.curated.csv",
  );
  // The first two columns never hold a comma or a quote, so a split is enough to read the name.
  const [, ...curatedLines] = readFileSync(curatedFile, "utf8").split("\n").filter(Boolean);
  const curatedNames = curatedLines.map((line) => line.split(",")[1] ?? "");

  const lead = goldenAdd.exercises.at(-1);
  if (lead?.origin !== "added") {
    throw new Error("The golden suggestion adds an exercise");
  }
  const forms = (name: string) => {
    const withName: PlanAdjusted = {
      ...goldenAdd,
      exercises: [...goldenAdd.exercises.slice(0, 5), { ...lead, exercise_id: "named" }],
    };
    const plannedNames = new Map(
      goldenAdd.exercises.slice(0, 5).map((exercise) => [exercise.exercise_id, "Planned"]),
    );
    const named = {
      ...detailForThursday,
      exerciseNames: new Map([...plannedNames, ["named", name]]),
    };
    return {
      sentence: describeSuggestionAccepted(withName, named).toast.slice(
        "Added to Thursday: 3 sets of ".length,
      ),
      title: describeSuggestionDetail(withName, named).rows[5]?.name ?? "",
    };
  };

  it("should read the curated names of the library", () => {
    expect(curatedNames).toHaveLength(673);
  });

  it("should lowercase a common word and keep a proper word", () => {
    expect(forms("Barbell Squat").sentence).toBe("barbell squat");
    expect(forms("Romanian Deadlift").sentence).toBe("Romanian deadlift");
    expect(forms("Romanian Deadlift").title).toBe("Romanian deadlift");
    expect(forms("Barbell Squat").title).toBe("Barbell squat");
  });

  it("should keep a word with two capitals and a single capital before a hyphen", () => {
    expect(forms("EZ-Bar Curl").sentence).toBe("EZ-Bar curl");
    expect(forms("T-Bar Row").sentence).toBe("T-Bar row");
    expect(forms("JM Press").sentence).toBe("JM press");
  });

  it("should keep the name in a possessive", () => {
    expect(forms("Conan's Wheel").sentence).toBe("Conan's wheel");
  });

  it("should lowercase the words of a hyphenated name", () => {
    expect(forms("Close-Grip Bench Press").sentence).toBe("close-grip bench press");
  });

  it("should keep every proper word and every capitalised initialism of every curated name, in both forms", () => {
    for (const name of curatedNames) {
      const { sentence, title } = forms(name);
      for (const word of name.match(/\b[A-Z][a-z]+\b/g) ?? []) {
        const isProper = EXERCISE_PROPER_WORDS.has(word);
        const isAfterSingleCapital = new RegExp(`[A-Z]-${word}\\b`).test(name);
        const kept = isProper || isAfterSingleCapital;
        if (!kept) {
          expect(sentence).not.toMatch(new RegExp(`\\b${word}\\b`));
        }
      }
      for (const word of name.match(/\b[A-Z]{2,}\b/g) ?? []) {
        expect(sentence).toContain(word);
        expect(title).toContain(word);
      }
      for (const word of [...EXERCISE_PROPER_WORDS].filter((each) => name.includes(each))) {
        expect(sentence).toContain(word);
        expect(title).toContain(word);
      }
      expect(title.charAt(0)).toBe(title.charAt(0).toUpperCase());
      expect(title.slice(1)).toBe(sentence.slice(1));
    }
  });
});

describe("the detail rows that the golden Legs day does not reach", () => {
  it("should read the length of two additions: 7 exercises, 22 sets, about 70 min", () => {
    expect(describeSuggestionDetail(twoAdds, detailForThursday).loadLine).toBe(
      "7 exercises · 22 sets · about 70 min",
    );
  });

  it("should leave RIR out of a planned row with none", () => {
    const withoutRir: PlanAdjusted = {
      ...goldenAdd,
      exercises: goldenAdd.exercises.map((exercise) =>
        exercise.origin === "plan" ? { ...exercise, target_rir: null } : exercise,
      ),
    };
    expect(describeSuggestionDetail(withoutRir, detailForThursday).rows[0]?.target).toBe(
      "3 × 5 to 8",
    );
  });

  it("should write one rep number when the lowest and highest are the same", () => {
    const first = goldenAdd.exercises[0];
    if (first?.origin !== "plan") {
      throw new Error("The golden day starts with a planned exercise");
    }
    const ranges = new Map(plannedRepRanges).set(first.routine_exercise_id, {
      repMin: 10,
      repMax: 10,
    });
    expect(
      describeSuggestionDetail(goldenAdd, { ...detailForThursday, plannedRepRanges: ranges })
        .rows[0]?.target,
    ).toBe("3 × 10 · RIR 2");
  });

  it("should put what did not fit on the last added row only, with two picks", () => {
    const twoWithNoRoom: PlanAdjusted = {
      ...twoAdds,
      no_room: { muscle_id: "lats", score: 5, minutes_if_added: 80 },
    };
    const rows = describeSuggestionDetail(twoWithNoRoom, detailForThursday).rows;
    expect(rows[5]?.why).not.toContain("would not fit");
    expect(rows[6]?.why).toMatch(/ Lats would not fit your 60 minutes\.$/);
    expect(rows.slice(0, 5).every((row) => !row.why.includes("would not fit"))).toBe(true);
  });
});

describe("the fixed words", () => {
  it("should hold the card's, the detail's, the accepted card's and the no-goal card's", () => {
    expect(SUGGESTION_CARD).toStrictEqual({ startAction: "Start", dismissAction: "Not now" });
    expect(SUGGESTION_DETAIL.backLabel).toBe("Back to Train");
    expect(SUGGESTION_ACCEPTED.undoAction).toBe("Undo");
    expect(SUGGESTION_NO_GOAL).toStrictEqual({
      sectionName: "Suggestions",
      title: "Set your goal",
      body: "Tell Ki-Lo what you are training for and it suggests your next session.",
      action: "Set your goal",
    });
  });
});

describe("the voice of every sentence", () => {
  const sentences = [
    ...Object.values(samples).flatMap((call) => call()),
    ...collectStrings(SUGGESTION_CARD),
    ...collectStrings(SUGGESTION_DETAIL),
    ...collectStrings(SUGGESTION_ACCEPTED),
    ...collectStrings(SUGGESTION_NO_GOAL),
  ];

  it("should find sentences to check", () => {
    expect(sentences.length).toBeGreaterThan(20);
  });

  it("should use no em dash and no ticket id", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toMatch(/\bKEY-\d+\b/);
    }
  });
});
