import { describe, expect, it } from "vitest";

import { collectStrings } from "./collectStrings";
import {
  EXERCISE_FORM,
  ROUTINE_EXERCISE_FORM,
  describeFormAndMusclesButton,
  describeFormPhoto,
  describeFormVideoLink,
} from "../../src/copy";

describe("the exercise form media copy", () => {
  it("should hold every word of the form media card", () => {
    expect(EXERCISE_FORM).toEqual({
      opensInYouTube: "Opens in YouTube",
      startLabel: "Start",
      endLabel: "End",
      loadingName: "Loading the form guide",
      unavailable: "The form guide isn't available right now.",
      imageFailedName: "Image not available",
    });
  });

  it("should use no em dash, double hyphen or semicolon", () => {
    for (const sentence of collectStrings(EXERCISE_FORM)) {
      expect(sentence).not.toMatch(/\u2014|--|;/);
    }
  });
});

describe("describeFormVideoLink", () => {
  it("should name the video, its channel and where it opens", () => {
    expect(describeFormVideoLink("Barbell back squat", "Strength Basics")).toBe(
      "Watch Barbell back squat by Strength Basics on YouTube",
    );
  });
});

describe("describeFormPhoto", () => {
  it("should name the exercise and the start position", () => {
    expect(describeFormPhoto("Barbell back squat", "start")).toBe(
      "Barbell back squat, start position",
    );
  });

  it("should name the exercise and the end position", () => {
    expect(describeFormPhoto("Barbell back squat", "end")).toBe("Barbell back squat, end position");
  });
});

describe("the routine editor's way to the form guide", () => {
  it("should name the menu item", () => {
    expect(ROUTINE_EXERCISE_FORM).toEqual({ menuAction: "Form and muscles" });
  });

  it("should use no em dash, double hyphen or semicolon", () => {
    for (const sentence of collectStrings(ROUTINE_EXERCISE_FORM)) {
      expect(sentence).not.toMatch(/\u2014|--|;/);
    }
  });
});

describe("describeFormAndMusclesButton", () => {
  it("should name the exercise whose form and muscles the button opens", () => {
    expect(describeFormAndMusclesButton("Barbell back squat")).toBe(
      "Form and muscles, Barbell back squat",
    );
  });
});
