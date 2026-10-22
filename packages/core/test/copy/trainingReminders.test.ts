import { describe, expect, it } from "vitest";

import {
  describeTrainingReminder,
  MUSCLE_NAMES,
  TRAINING_REMINDER_TITLES,
  TRAINING_REMINDER_TYPES,
  TRAINING_REMINDER_VARIANTS,
} from "../../src/copy";
import { bench, curl, row, squat } from "../training/plans";

describe("the training reminder copy", () => {
  it("should name the three reminder types", () => {
    expect(TRAINING_REMINDER_TYPES).toEqual(["train", "progress", "ease"]);
  });

  it("should have one title for each type", () => {
    expect(TRAINING_REMINDER_TITLES).toEqual({
      train: "Time to train",
      progress: "See your progress",
      ease: "Take it easy",
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
    ]);

    for (const sentence of sentences) {
      expect(sentence).not.toMatch(/\d/);
      expect(sentence).not.toMatch(/\b(kg|reps?|sets)\b/i);
      for (const word of wordsNotToSay) {
        expect(sentence.toLowerCase()).not.toContain(word.toLowerCase());
      }
    }
  });
});
