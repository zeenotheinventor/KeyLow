import { describe, expect, it } from "vitest";

import {
  describeTrainingReminder,
  MUSCLE_NAMES,
  NAMED_TRAIN_REMINDER_VARIANTS,
  MISSED_MERGED_REMINDER_VARIANTS,
  TRAIN_REMINDER_NAMES_ROUTINE_DAY,
  TRAINING_REMINDER_DAY_SLOT,
  TRAINING_REMINDER_TITLES,
  TRAINING_REMINDER_TYPES,
  TRAINING_REMINDER_VARIANTS,
} from "../../src/copy";
import { bench, curl, row, squat } from "../training/plans";

describe("the training reminder copy", () => {
  it("should name the five reminder types", () => {
    expect(TRAINING_REMINDER_TYPES).toEqual(["train", "progress", "ease", "missed", "checkin"]);
  });

  it("should have one title for each type", () => {
    expect(TRAINING_REMINDER_TITLES).toEqual({
      train: "Time to train",
      progress: "See your progress",
      ease: "Take it easy",
      missed: "A fresh start",
      checkin: "Checking in",
    });
  });

  it.each(TRAINING_REMINDER_TYPES)("should have 5 to 8 different variants of %s", (type) => {
    const variants = TRAINING_REMINDER_VARIANTS[type];

    expect(variants.length).toBeGreaterThanOrEqual(5);
    expect(variants.length).toBeLessThanOrEqual(8);
    expect(new Set(variants.map(({ body }) => body)).size).toBe(variants.length);
  });

  it("should have 8 variants of Time to train, so a week of days all differ", () => {
    expect(TRAINING_REMINDER_VARIANTS.train).toHaveLength(8);
  });

  it("should give each variant a stable id of its type and number", () => {
    for (const type of TRAINING_REMINDER_TYPES) {
      expect(TRAINING_REMINDER_VARIANTS[type].map(({ id }) => id)).toEqual(
        TRAINING_REMINDER_VARIANTS[type].map((_, index) => `${type}-${index + 1}`),
      );
    }
  });

  it("should read a variant by its type and id", () => {
    expect(describeTrainingReminder("train", "train-1")).toEqual({
      title: "Time to train",
      body: TRAINING_REMINDER_VARIANTS.train[0]?.body,
    });
    expect(describeTrainingReminder("ease", "ease-3").body).toBe(
      TRAINING_REMINDER_VARIANTS.ease[2]?.body,
    );
  });

  it("should throw a RangeError for an id with no variant of the type", () => {
    expect(() => describeTrainingReminder("train", "")).toThrow(RangeError);
    expect(() => describeTrainingReminder("progress", "train-1")).toThrow(RangeError);
    expect(() => describeTrainingReminder("ease", "ease-99")).toThrow(RangeError);
  });

  it("should carry no number, exercise, muscle or day on the lock screen", () => {
    const wordsNotToSay = [
      ...Object.values(MUSCLE_NAMES),
      ...[bench, squat, row, curl].map(({ name }) => name),
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];
    const sentences = TRAINING_REMINDER_TYPES.flatMap((type) => [
      TRAINING_REMINDER_TITLES[type],
      ...TRAINING_REMINDER_VARIANTS[type].map(({ body }) => body),
    ]).concat(MISSED_MERGED_REMINDER_VARIANTS.map(({ body }) => body));

    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/\d/);
      expect(sentence).not.toMatch(/\b(kg|reps?|sets)\b/i);
      for (const word of wordsNotToSay) {
        expect(sentence.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });
});

describe("the named Time to train copy", () => {
  it("should be switched on while the working decision stands", () => {
    expect(TRAIN_REMINDER_NAMES_ROUTINE_DAY).toBe(true);
  });

  it("should have 8 variants, with ids of their own that no generic id shares", () => {
    const genericIds = TRAINING_REMINDER_VARIANTS.train.map(({ id }) => id);

    expect(NAMED_TRAIN_REMINDER_VARIANTS.map(({ id }) => id)).toEqual(
      NAMED_TRAIN_REMINDER_VARIANTS.map((_, index) => `train-named-${index + 1}`),
    );
    expect(NAMED_TRAIN_REMINDER_VARIANTS).toHaveLength(8);
    expect(genericIds.filter((id) => id.startsWith("train-named"))).toEqual([]);
  });

  it("should have one day slot in each body, and different bodies", () => {
    for (const { body } of NAMED_TRAIN_REMINDER_VARIANTS) {
      expect(body.split(TRAINING_REMINDER_DAY_SLOT)).toHaveLength(2);
    }
    expect(new Set(NAMED_TRAIN_REMINDER_VARIANTS.map(({ body }) => body)).size).toBe(8);
  });

  it("should put the day name in the slot, under the same title", () => {
    const { title, body } = describeTrainingReminder("train", "train-named-1", "Upper A");

    expect(title).toBe("Time to train");
    expect(body).toBe(
      NAMED_TRAIN_REMINDER_VARIANTS[0]?.body.replace(TRAINING_REMINDER_DAY_SLOT, "Upper A"),
    );
    expect(body).toContain("Upper A");
  });

  it("should keep a dollar sign in a day name as it is", () => {
    expect(describeTrainingReminder("train", "train-named-1", "$& day").body).toContain("$& day");
  });

  it("should trim the day name", () => {
    expect(describeTrainingReminder("train", "train-named-2", "  Pull  ").body).toContain(" Pull");
    expect(describeTrainingReminder("train", "train-named-2", "  Pull  ").body).not.toContain("  ");
  });

  it("should throw a RangeError for a named id with no day name", () => {
    expect(() => describeTrainingReminder("train", "train-named-1")).toThrow(RangeError);
    expect(() => describeTrainingReminder("train", "train-named-1", "   ")).toThrow(RangeError);
  });

  it("should throw a RangeError for a named id of another type", () => {
    expect(() => describeTrainingReminder("ease", "train-named-1", "Upper A")).toThrow(RangeError);
  });

  it("should ignore a day name for a generic variant", () => {
    expect(describeTrainingReminder("train", "train-1", "Upper A")).toEqual(
      describeTrainingReminder("train", "train-1"),
    );
  });

  it("should carry only the day name as dynamic text, and no digit, unit, muscle or weekday", () => {
    const wordsNotToSay = [
      ...Object.values(MUSCLE_NAMES),
      ...[bench, squat, row, curl].map(({ name }) => name),
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ];

    for (const { id, body } of NAMED_TRAIN_REMINDER_VARIANTS) {
      const neutral = describeTrainingReminder("train", id, "Alpha").body;

      expect(neutral.replace("Alpha", "")).toBe(body.replace(TRAINING_REMINDER_DAY_SLOT, ""));
      expect(neutral).not.toMatch(/\d/);
      expect(neutral).not.toMatch(/\b(kg|reps?|sets)\b/i);
      expect(neutral).not.toContain("\u2014");
      for (const word of wordsNotToSay) {
        expect(neutral.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });
});

describe("the missed day and check-in copy", () => {
  it.each([
    ["missed", 6],
    ["checkin", 6],
  ] as const)(
    "should have %s bodies of its own, each with an id of its type and number",
    (type, count) => {
      expect(TRAINING_REMINDER_VARIANTS[type].map(({ id }) => id)).toEqual(
        Array.from({ length: count }, (_, index) => `${type}-${index + 1}`),
      );
    },
  );

  it("should have 6 merged bodies for a missed day that is also a train day, with ids of their own", () => {
    expect(MISSED_MERGED_REMINDER_VARIANTS.map(({ id }) => id)).toEqual(
      Array.from({ length: 6 }, (_, index) => `missed-merged-${index + 1}`),
    );
    expect(new Set(MISSED_MERGED_REMINDER_VARIANTS.map(({ body }) => body)).size).toBe(6);
    expect(TRAINING_REMINDER_VARIANTS.missed.map(({ id }) => id)).not.toContain("missed-merged-1");
  });

  it("should read a merged variant under the missed title, and only for missed", () => {
    expect(describeTrainingReminder("missed", "missed-merged-2")).toEqual({
      title: "A fresh start",
      body: MISSED_MERGED_REMINDER_VARIANTS[1]?.body,
    });
    expect(() => describeTrainingReminder("checkin", "missed-merged-1")).toThrow(RangeError);
    expect(() => describeTrainingReminder("train", "missed-merged-1")).toThrow(RangeError);
  });

  it("should keep the missed words kind, with no count of days and no weekday", () => {
    const sentences = [
      ...TRAINING_REMINDER_VARIANTS.missed,
      ...TRAINING_REMINDER_VARIANTS.checkin,
      ...MISSED_MERGED_REMINDER_VARIANTS,
    ].map(({ body }) => body);

    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/\d|\b(two|three|four|several|days)\b/i);
      expect(sentence).not.toMatch(/\b(missed|failed|should have|behind)\b/i);
    }
  });
});
