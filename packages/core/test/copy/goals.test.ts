import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import { samples } from "./samples/goals";
import {
  describeGoalAnswerRows,
  describeGoalAnswersSentence,
  describeGoalSetOn,
  describeMinutesOption,
  describeOptionName,
  describePriorities,
  describeQuestionStep,
  describeQuestionStepName,
  DAYS_PER_WEEK_OPTIONS,
  EQUIPMENT_OPTIONS,
  EXPERIENCE_OPTIONS,
  FOCUS_OPTIONS,
  FULL_GYM,
  GOAL_ANSWER_ROWS,
  GOAL_ERRORS,
  GOAL_OPTIONS,
  GOAL_QUESTIONNAIRE,
  GOAL_QUESTION_STEPS,
  GOAL_QUESTIONS,
  GOAL_SCREEN,
  GOAL_SUMMARY,
  MINUTES_PRESETS,
  SENTENCE_GROUP_ORDER,
} from "../../src/copy";
import * as goalsCopy from "../../src/copy/goals";
import {
  deriveMusclePriority,
  EQUIPMENT,
  GOAL_PRESETS_V1,
  MUSCLE_GROUPS,
  summarisePriorities,
} from "../../src/training";
import { routine as goldenRoutine } from "../training/goldenWeekInputs";

import type { GoalAnswers, PrioritySummary } from "../../src/training";

/*
 * The words of the goal questionnaire, the priorities summary and the goal screen (KEY-417, canvas version 30,
 * boards `goals · *` and `web-goals · questionnaire`). The golden V-taper and strength answers are the ones
 * KEY-399 pins (`prioritySummary.test.ts`), rendered here to their sentences. The experience help line is the
 * wording Zee agreed in the KEY-396 document, Part 2, not the board's.
 */

const fullGym = EQUIPMENT.filter((equipment) => equipment !== "other");

const vTaperAnswers: GoalAnswers = {
  goal: "aesthetic",
  focus: ["v_taper"],
  days_per_week: 4,
  session_minutes: 60,
  equipment: [...fullGym],
  experience: "intermediate",
};

const strengthAnswers: GoalAnswers = { ...vTaperAnswers, goal: "strength", focus: [] };

const summaryFor = (answers: GoalAnswers): PrioritySummary =>
  summarisePriorities(answers, deriveMusclePriority(answers, GOAL_PRESETS_V1), goldenRoutine);

const emptySummary: PrioritySummary = {
  first: [],
  keptUp: [],
  notTargeted: [],
  answers: vTaperAnswers,
};

describe("the questions", () => {
  it("should be six, in the order of the boards", () => {
    expect(GOAL_QUESTION_STEPS).toStrictEqual([
      "goal",
      "focus",
      "days",
      "minutes",
      "equipment",
      "experience",
    ]);
  });

  it("should write the titles and help lines of the boards", () => {
    expect(GOAL_QUESTIONS).toStrictEqual({
      goal: {
        title: "What are you training for?",
        help: "This sets which muscles come first and how your sets and reps are planned.",
        note: null,
      },
      focus: {
        title: "Anything to focus on?",
        help: "Pick any that matter to you, or Overall.",
        note: null,
      },
      days: {
        title: "How many days a week?",
        help: "The days you can train in a normal week.",
        note: "Your routine keeps its own days. This only shapes suggestions.",
      },
      minutes: {
        title: "How long is a session?",
        help: "From arriving to leaving, warm-ups included.",
        note: "Other takes 15 to 180 minutes.",
      },
      equipment: {
        title: "What can you use?",
        help: "Suggestions only use what you pick.",
        note: "Full gym picks everything but Other.",
      },
      experience: {
        title: "How long have you trained?",
        help: "This sets how many sets Ki-Lo suggests for each exercise it adds.",
        note: null,
      },
    });
  });

  it("should not keep the board's experience help line, which says the wrong thing", () => {
    expect(collectStrings(GOAL_QUESTIONS).join("\n")).not.toContain("a week your muscles");
  });

  it("should word the goal options", () => {
    expect(GOAL_OPTIONS).toStrictEqual({
      aesthetic: {
        label: "Look better",
        description: "Build muscle where it shows, in proportion",
      },
      strength: {
        label: "Get stronger",
        description: "Lift more on the squat, bench, deadlift and overhead press",
      },
      hybrid: { label: "Both", description: "Strength on the big lifts, size everywhere else" },
    });
  });

  it("should word the six focus options", () => {
    expect(FOCUS_OPTIONS).toStrictEqual({
      v_taper: { label: "V-taper", description: "Wider shoulders and back, a narrower waist" },
      chest: { label: "Chest", description: "Upper and lower chest" },
      arms: { label: "Arms", description: "Biceps, triceps and forearms" },
      glutes: { label: "Glutes", description: "Glutes and side glutes" },
      legs: { label: "Legs", description: "Quads, hamstrings and calves" },
      overall: { label: "Overall", description: "No one area first" },
    });
  });

  it("should word the three experience options", () => {
    expect(EXPERIENCE_OPTIONS).toStrictEqual({
      beginner: { label: "Beginner", description: "Under a year of steady training" },
      intermediate: { label: "Intermediate", description: "One to three years" },
      advanced: { label: "Advanced", description: "More than three years" },
    });
  });

  it("should name the ten equipment values and the Full gym shortcut", () => {
    expect(Object.values(EQUIPMENT_OPTIONS).map((option) => option.label)).toStrictEqual([
      "Barbell",
      "Dumbbell",
      "Kettlebell",
      "Cable",
      "Machine",
      "Smith machine",
      "EZ bar",
      "Band",
      "Bodyweight",
      "Other",
    ]);
    expect(FULL_GYM.label).toBe("Full gym");
  });

  it("should make Full gym every equipment value but Other", () => {
    expect(FULL_GYM.equipment).toStrictEqual(fullGym);
    expect(FULL_GYM.equipment).not.toContain("other");
  });

  it("should offer one to seven days a week", () => {
    expect(DAYS_PER_WEEK_OPTIONS).toStrictEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("should offer the minutes presets and Other", () => {
    expect(MINUTES_PRESETS.map(describeMinutesOption)).toStrictEqual([
      "30 min",
      "45 min",
      "60 min",
      "75 min",
      "90 min",
    ]);
    expect(GOAL_QUESTIONNAIRE.otherMinutesOption).toBe("Other");
  });
});

describe("the questionnaire frame", () => {
  it("should write the step label of the boards", () => {
    expect(describeQuestionStep(1)).toBe("Your goal · 1 of 6");
    expect(describeQuestionStep(6)).toBe("Your goal · 6 of 6");
  });

  it("should name the step for a screen reader", () => {
    expect(describeQuestionStepName(1)).toBe("Question 1 of 6");
    expect(describeQuestionStepName(4)).toBe("Question 4 of 6");
  });

  it("should state the rule for a step that is not one of the six, without quoting it", () => {
    for (const step of [0, 7, 1.5, Number.NaN]) {
      expect(() => describeQuestionStep(step)).toThrow(
        new RangeError("A question step must be a whole number from 1 to 6"),
      );
      expect(() => describeQuestionStepName(step)).toThrow(RangeError);
    }
  });

  it("should write the buttons and the close line", () => {
    expect(GOAL_QUESTIONNAIRE).toMatchObject({
      backAction: "Back",
      nextAction: "Next",
      finalAction: "See your priorities",
      cancelAction: "Cancel",
      closeLabel: "Close, your answers are not saved",
      closeConfirmation: "Your answers are not saved",
      progressName: "Questions answered",
    });
  });

  it("should write the close question's sentence and its two buttons", () => {
    expect(GOAL_QUESTIONNAIRE).toMatchObject({
      closeBody: "Close now and the answers you have given are discarded.",
      closeConfirmAction: "Close",
      closeKeepAction: "Keep answering",
    });
  });

  it("should name an option card by its label and description", () => {
    expect(describeOptionName(GOAL_OPTIONS.aesthetic)).toBe(
      "Look better. Build muscle where it shows, in proportion",
    );
  });
});

describe("the errors", () => {
  it("should state the minutes rule", () => {
    expect(GOAL_ERRORS.minutes).toBe("Enter minutes from 15 to 180.");
  });

  it("should state the save failure rule", () => {
    expect(GOAL_ERRORS.save).toBe("Your goal did not save. Check your connection, then try again.");
  });
});

describe("describeGoalAnswersSentence", () => {
  it("should write the golden V-taper answers", () => {
    expect(describeGoalAnswersSentence(vTaperAnswers)).toBe(
      "From your answers: look better, V-taper, 4 days a week, 60 minutes, full gym, intermediate.",
    );
  });

  it("should leave the focus out when the strength user chose none", () => {
    expect(describeGoalAnswersSentence(strengthAnswers)).toBe(
      "From your answers: get stronger, 4 days a week, 60 minutes, full gym, intermediate.",
    );
  });

  it("should join several focuses as one item", () => {
    expect(
      describeGoalAnswersSentence({ ...vTaperAnswers, focus: ["v_taper", "chest", "arms"] }),
    ).toBe(
      "From your answers: look better, V-taper, chest and arms, 4 days a week, 60 minutes, full gym, intermediate.",
    );
  });

  it("should write both goals when the user chose both", () => {
    expect(describeGoalAnswersSentence({ ...vTaperAnswers, goal: "hybrid" })).toContain(
      "look better and get stronger, V-taper",
    );
  });

  it("should list the equipment when it is not a full gym", () => {
    expect(
      describeGoalAnswersSentence({
        ...vTaperAnswers,
        equipment: ["dumbbell", "ez_bar", "bodyweight"],
      }),
    ).toBe(
      "From your answers: look better, V-taper, 4 days a week, 60 minutes, dumbbell, EZ bar and bodyweight, intermediate.",
    );
  });

  it("should not call a full gym with Other a full gym", () => {
    expect(describeGoalAnswersSentence({ ...vTaperAnswers, equipment: [...EQUIPMENT] })).toContain(
      "60 minutes, barbell, dumbbell, kettlebell, cable, machine, Smith machine, EZ bar, band, bodyweight and other equipment, intermediate.",
    );
  });

  it("should read a full gym whatever order the equipment was chosen in", () => {
    expect(
      describeGoalAnswersSentence({ ...vTaperAnswers, equipment: [...fullGym].reverse() }),
    ).toContain("60 minutes, full gym, intermediate");
  });

  it("should say no equipment when none was chosen", () => {
    expect(describeGoalAnswersSentence({ ...vTaperAnswers, equipment: [] })).toContain(
      "60 minutes, no equipment, intermediate",
    );
  });

  it("should keep the day singular for one day", () => {
    expect(describeGoalAnswersSentence({ ...vTaperAnswers, days_per_week: 1 })).toContain(
      "1 day a week",
    );
  });
});

describe("the order and phrases of several answers", () => {
  it("should name focuses in the order of the focus list, as the summary does", () => {
    const answers: GoalAnswers = { ...vTaperAnswers, focus: ["arms", "v_taper"] };

    expect(describeGoalAnswersSentence(answers)).toContain("look better, V-taper and arms, 4 days");
    expect(describeGoalAnswerRows(answers)[1]?.value).toBe("V-taper and arms");
    expect(describePriorities(summaryFor(answers)).answers).toBe(
      describeGoalAnswersSentence(answers),
    );
  });

  it("should name equipment in the order of the equipment list", () => {
    const answers: GoalAnswers = {
      ...vTaperAnswers,
      equipment: ["bodyweight", "barbell", "cable"],
    };

    expect(describeGoalAnswersSentence(answers)).toContain(
      "60 minutes, barbell, cable and bodyweight,",
    );
    expect(describeGoalAnswerRows(answers)[4]?.value).toBe("Barbell, cable and bodyweight");
  });

  it("should call the overall focus the overall focus, so it never reads as a bare word", () => {
    const answers: GoalAnswers = { ...vTaperAnswers, focus: ["overall"] };

    expect(describeGoalAnswersSentence(answers)).toContain("look better, overall focus, 4 days");
    expect(describeGoalAnswerRows(answers)[1]?.value).toBe("Overall focus");
  });

  it("should call the other equipment other equipment", () => {
    const answers: GoalAnswers = { ...vTaperAnswers, equipment: ["dumbbell", "other"] };

    expect(describeGoalAnswersSentence(answers)).toContain(
      "60 minutes, dumbbell and other equipment,",
    );
    expect(describeGoalAnswerRows(answers)[4]?.value).toBe("Dumbbell and other equipment");
  });
});

describe("the order muscles are named in", () => {
  it("should hold every muscle group once, so a new group cannot sort first unnoticed", () => {
    expect([...SENTENCE_GROUP_ORDER].sort()).toStrictEqual([...MUSCLE_GROUPS].sort());
  });
});

describe("describePriorities for the golden V-taper answers", () => {
  const priorities = describePriorities(summaryFor(vTaperAnswers));

  it("should write the answers line", () => {
    expect(priorities.answers).toBe(
      "From your answers: look better, V-taper, 4 days a week, 60 minutes, full gym, intermediate.",
    );
  });

  it("should put side delts, lats and upper chest first, in the order of the board", () => {
    expect(priorities.rows[0]).toStrictEqual({
      group: "first",
      title: "Side delts, lats and upper chest come first",
      detail: "Suggestions fill them before anything else.",
    });
  });

  it("should keep up the rest with the experience line Zee agreed on KEY-396", () => {
    expect(priorities.rows[1]).toStrictEqual({
      group: "keptUp",
      title: "Everything else in your routine is kept up",
      detail: "Exercises Ki-Lo adds get 3 sets each, from your experience.",
    });
  });

  it("should name every muscle the routine and the goal both leave out, and no reason", () => {
    expect(priorities.rows[2]).toStrictEqual({
      group: "notTargeted",
      title:
        "Upper traps, abs, obliques, side glutes, adductors, shins and neck get no direct work",
      detail: null,
    });
  });

  it("should write the row that restates the days, minutes and equipment", () => {
    expect(priorities.rows[3]).toStrictEqual({
      group: "fit",
      title: "4 days a week, about 60 minutes, full gym",
      detail: "Suggestions fit inside these and keep your routine as it is.",
    });
  });

  it("should write the legend under the body map", () => {
    expect(priorities.legend).toBe(
      "Gold muscles come first, blue ones are kept up. Grey ones are not targeted.",
    );
  });

  it("should have four rows and nothing about a waist", () => {
    expect(priorities.rows).toHaveLength(4);
    expect(JSON.stringify(priorities)).not.toContain("waist");
  });
});

describe("describePriorities for the strength answers", () => {
  const priorities = describePriorities(summaryFor(strengthAnswers));

  it("should write the answers line without a focus", () => {
    expect(priorities.answers).toBe(
      "From your answers: get stronger, 4 days a week, 60 minutes, full gym, intermediate.",
    );
  });

  it("should name the six muscles of the big lifts first", () => {
    expect(priorities.rows[0]?.title).toBe(
      "Front delts, lower back, lower chest, glutes, quads and hamstrings come first",
    );
  });

  it("should leave calves kept up, because the golden routine trains them", () => {
    expect(priorities.rows[2]?.title).toBe(
      "Abs, obliques, side glutes, adductors, shins and neck get no direct work",
    );
  });

  it("should take the sets from the presets for the user's experience, not from a caller", () => {
    const detailFor = (experience: GoalAnswers["experience"]) =>
      describePriorities(summaryFor({ ...strengthAnswers, experience })).rows[1]?.detail;

    expect(detailFor("beginner")).toBe(
      "Exercises Ki-Lo adds get 2 sets each, from your experience.",
    );
    expect(detailFor("intermediate")).toBe(
      "Exercises Ki-Lo adds get 3 sets each, from your experience.",
    );
    expect(detailFor("advanced")).toBe(
      "Exercises Ki-Lo adds get 4 sets each, from your experience.",
    );
  });
});

describe("describePriorities for lists of one, two and three muscles", () => {
  const rowTitle = (group: "first" | "notTargeted", muscles: PrioritySummary["first"]) =>
    describePriorities({ ...emptySummary, [group]: muscles }).rows.find(
      (row) => row.group === group,
    )?.title;

  it("should agree a single plural name with come", () => {
    expect(rowTitle("first", ["lats"])).toBe("Lats come first");
  });

  it("should agree a single singular name with comes", () => {
    expect(rowTitle("first", ["lower_back"])).toBe("Lower back comes first");
  });

  it("should join two muscles with and", () => {
    expect(rowTitle("first", ["delt_side", "lats"])).toBe("Side delts and lats come first");
  });

  it("should join three muscles with commas and a last and", () => {
    expect(rowTitle("first", ["chest_upper", "delt_side", "lats"])).toBe(
      "Side delts, lats and upper chest come first",
    );
  });

  it("should write obliques alone as the board does", () => {
    expect(rowTitle("notTargeted", ["obliques"])).toBe("Obliques get no direct work");
  });

  it("should agree a single singular name with gets", () => {
    expect(rowTitle("notTargeted", ["neck"])).toBe("Neck gets no direct work");
  });

  it("should join two and three not-targeted muscles", () => {
    expect(rowTitle("notTargeted", ["abs", "obliques"])).toBe(
      "Abs and obliques get no direct work",
    );
    expect(rowTitle("notTargeted", ["abs", "obliques", "neck"])).toBe(
      "Abs, obliques and neck get no direct work",
    );
  });

  it("should order muscles by the shoulders, back, chest, arms, core, legs, neck groups, then by the list", () => {
    expect(rowTitle("first", ["quads", "biceps", "chest_lower", "lats", "delt_rear"])).toBe(
      "Rear delts, lats, lower chest, biceps and quads come first",
    );
  });

  it("should leave out a row whose group is empty", () => {
    expect(describePriorities(emptySummary).rows.map((row) => row.group)).toStrictEqual(["fit"]);
  });

  it("should leave the summary it was given as it was", () => {
    const summary: PrioritySummary = {
      ...emptySummary,
      first: ["chest_upper", "lats", "delt_side"],
    };
    describePriorities(summary);

    expect(summary.first).toStrictEqual(["chest_upper", "lats", "delt_side"]);
  });
});

describe("the priorities summary screen", () => {
  it("should write the header and the save button", () => {
    expect(GOAL_SUMMARY).toStrictEqual({
      title: "Your priorities",
      backLabel: "Back to the questions",
      saveAction: "Save goal",
      prioritiesSectionName: "Priorities",
      bodyMapFrontName: "Your priorities on the body map, front",
      bodyMapBackName: "Your priorities on the body map, back",
    });
  });
});

describe("the goal screen", () => {
  it("should write the fixed words", () => {
    expect(GOAL_SCREEN).toStrictEqual({
      title: "Goal",
      backLabel: "Back to Train",
      changeNote:
        "Changing an answer starts your new goal from today. Suggestions you already took keep their reasons.",
      prioritiesAction: "See your priorities",
    });
  });

  it("should label the six answer rows", () => {
    expect(GOAL_ANSWER_ROWS).toStrictEqual({
      goal: "Goal",
      focus: "Focus",
      days: "Days a week",
      minutes: "Session",
      equipment: "Equipment",
      experience: "Experience",
    });
  });

  it("should write the golden V-taper rows as the board draws them", () => {
    expect(describeGoalAnswerRows(vTaperAnswers)).toStrictEqual([
      { step: "goal", label: "Goal", value: "Look better", name: "Goal: Look better. Change" },
      { step: "focus", label: "Focus", value: "V-taper", name: "Focus: V-taper. Change" },
      { step: "days", label: "Days a week", value: "4", name: "Days a week: 4. Change" },
      {
        step: "minutes",
        label: "Session",
        value: "60 minutes",
        name: "Session: 60 minutes. Change",
      },
      {
        step: "equipment",
        label: "Equipment",
        value: "Full gym",
        name: "Equipment: Full gym. Change",
      },
      {
        step: "experience",
        label: "Experience",
        value: "Intermediate",
        name: "Experience: Intermediate. Change",
      },
    ]);
  });

  it("should write several focuses, a partial kit and no focus in the row values", () => {
    const rows = describeGoalAnswerRows({
      ...vTaperAnswers,
      goal: "hybrid",
      focus: ["v_taper", "chest", "arms"],
      equipment: ["barbell", "ez_bar"],
    });

    expect(rows.map((row) => row.value)).toStrictEqual([
      "Both",
      "V-taper, chest and arms",
      "4",
      "60 minutes",
      "Barbell and EZ bar",
      "Intermediate",
    ]);
    expect(describeGoalAnswerRows(strengthAnswers)[1]?.value).toBe("None");
    expect(describeGoalAnswerRows({ ...strengthAnswers, equipment: [] })[4]?.value).toBe("None");
  });

  it("should write the date the goal was set on, as the board does", () => {
    expect(describeGoalSetOn("2026-09-21")).toBe("Set on Mon 21 Sep");
  });
});

describe("the voice of the goals copy", () => {
  const sentences = [
    ...Object.values(goalsCopy).flatMap(collectStrings),
    ...Object.values(samples).flatMap((call) => call()),
  ];

  it("should find a good number of sentences to check", () => {
    expect(sentences.length).toBeGreaterThan(80);
  });

  it("should have a sample row for every function it exports", () => {
    const functionNames = Object.entries(goalsCopy)
      .filter(([, value]) => typeof value === "function")
      .map(([name]) => name);

    expect(functionNames.filter((name) => !(name in samples))).toStrictEqual([]);
  });

  it("should use no em dash, no semicolon and no exclamation mark", () => {
    for (const sentence of sentences) {
      expect(sentence).not.toContain("—");
      expect(sentence).not.toContain(";");
      expect(sentence).not.toContain("!");
    }
  });
});
