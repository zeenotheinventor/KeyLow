import { describe, expect, it } from "vitest";

import { formatMuscleShares } from "../../../scripts/exercises/muscleShares";
import {
  categoryExclusion,
  mapEquipment,
  mapExerciseMuscles,
  mapMechanic,
  mergeShares,
} from "../../../scripts/exercises/rules";
import { sourceExercise } from "../../support/sourceExercise";

import type { SourceExercise } from "../../../scripts/exercises/sourceExercise";

const mapped = (fields: Partial<SourceExercise> & Pick<SourceExercise, "name">): string =>
  formatMuscleShares(mapExerciseMuscles(sourceExercise(fields)));

describe("the shoulder split", () => {
  it("should make overhead pressing front-delt primary with the side delt secondary", () => {
    expect(
      mapped({
        name: "Standing Military Press",
        primaryMuscles: ["shoulders"],
        secondaryMuscles: ["triceps"],
      }),
    ).toBe("delt_front:primary:1.0;delt_side:secondary:0.5;triceps:secondary:0.5");
  });

  it.each(["Side Lateral Raise", "Upright Barbell Row", "Lateral Raise - With Bands"])(
    "should make %s side-delt primary",
    (name) => {
      expect(mapped({ name, primaryMuscles: ["shoulders"] })).toBe("delt_side:primary:1.0");
    },
  );

  it.each([
    "Face Pull",
    "Reverse Flyes",
    "Cable Rear Delt Fly",
    "Band Pull Apart",
    "Bent Over Low-Pulley Side Lateral",
    "External Rotation",
  ])("should make %s rear-delt primary", (name) => {
    expect(mapped({ name, primaryMuscles: ["shoulders"] })).toBe("delt_rear:primary:1.0");
  });

  it("should make a front raise front-delt primary without the side delt", () => {
    expect(mapped({ name: "Front Dumbbell Raise", primaryMuscles: ["shoulders"] })).toBe(
      "delt_front:primary:1.0",
    );
  });

  it("should make an upright row side-delt primary even when the source lists traps first", () => {
    expect(
      mapped({
        name: "Upright Cable Row",
        primaryMuscles: ["traps"],
        secondaryMuscles: ["shoulders"],
      }),
    ).toBe("delt_side:primary:1.0;traps_upper:secondary:0.5");
  });

  it("should read shoulders listed as secondary as the rear delt on a pull and the front delt on a push", () => {
    expect(
      mapped({
        name: "Wide-Grip Lat Pulldown",
        primaryMuscles: ["lats"],
        secondaryMuscles: ["shoulders"],
      }),
    ).toBe("lats:primary:1.0;delt_rear:secondary:0.5");
    expect(
      mapped({ name: "Pushups", primaryMuscles: ["chest"], secondaryMuscles: ["shoulders"] }),
    ).toBe("chest_lower:primary:1.0;chest_upper:secondary:0.6;delt_front:secondary:0.5");
  });

  it("should not read the 'chin' inside 'machine' as a chin-up", () => {
    expect(
      mapped({
        name: "Smith Machine Incline Bench Press",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["shoulders"],
      }),
    ).toBe("chest_upper:primary:1.0;chest_lower:secondary:0.5;delt_front:secondary:0.5");
  });
});

describe("the chest split", () => {
  it("should give a flat bench press the ADR 0005 map", () => {
    expect(
      mapped({
        name: "Barbell Bench Press - Medium Grip",
        primaryMuscles: ["chest"],
        secondaryMuscles: ["shoulders", "triceps"],
      }),
    ).toBe(
      "chest_lower:primary:1.0;chest_upper:secondary:0.6;delt_front:secondary:0.5;triceps:secondary:0.5",
    );
  });

  it.each([
    "Incline Dumbbell Press",
    "Decline Push-Up",
    "Push-Ups With Feet Elevated",
    "Low Cable Crossover",
  ])("should make %s upper-chest primary", (name) => {
    expect(mapped({ name, primaryMuscles: ["chest"] })).toBe(
      "chest_upper:primary:1.0;chest_lower:secondary:0.5",
    );
  });

  it.each(["Decline Barbell Bench Press", "Dips - Chest Version", "Incline Push-Up"])(
    "should make %s lower-chest primary with a light upper chest",
    (name) => {
      expect(mapped({ name, primaryMuscles: ["chest"] })).toBe(
        "chest_lower:primary:1.0;chest_upper:secondary:0.3",
      );
    },
  );

  it("should read chest listed as secondary as the upper chest on a shoulder press and the lower chest on a dip", () => {
    expect(
      mapped({
        name: "Barbell Shoulder Press",
        primaryMuscles: ["shoulders"],
        secondaryMuscles: ["chest"],
      }),
    ).toBe("delt_front:primary:1.0;chest_upper:secondary:0.5;delt_side:secondary:0.5");
    expect(
      mapped({ name: "Bench Dips", primaryMuscles: ["triceps"], secondaryMuscles: ["chest"] }),
    ).toBe("triceps:primary:1.0;chest_lower:secondary:0.5");
  });
});

describe("the back", () => {
  it("should make a row both lats and mid-traps primary", () => {
    expect(
      mapped({
        name: "Bent Over Barbell Row",
        primaryMuscles: ["middle back"],
        secondaryMuscles: ["biceps", "lats", "shoulders"],
      }),
    ).toBe("lats:primary:1.0;traps_mid:primary:1.0;delt_rear:secondary:0.5;biceps:secondary:0.5");
  });

  it("should keep a pull-up lats primary with the mid traps secondary", () => {
    expect(
      mapped({
        name: "Pullups",
        primaryMuscles: ["lats"],
        secondaryMuscles: ["biceps", "middle back"],
      }),
    ).toBe("lats:primary:1.0;traps_mid:secondary:0.5;biceps:secondary:0.5");
  });

  it("should map traps to the upper traps and lower back to lower_back", () => {
    expect(mapped({ name: "Barbell Shrug", primaryMuscles: ["traps"] })).toBe(
      "traps_upper:primary:1.0",
    );
    expect(mapped({ name: "Hyperextensions", primaryMuscles: ["lower back"] })).toBe(
      "lower_back:primary:1.0",
    );
  });

  it("should make the lower back secondary on a hinge and a stabiliser elsewhere", () => {
    expect(
      mapped({
        name: "Romanian Deadlift",
        primaryMuscles: ["hamstrings"],
        secondaryMuscles: ["lower back"],
      }),
    ).toBe("hamstrings:primary:1.0;lower_back:secondary:0.5");
    expect(
      mapped({
        name: "Barbell Squat",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: ["lower back"],
      }),
    ).toBe("quads:primary:1.0;lower_back:stabiliser:0.2");
  });
});

describe("the core", () => {
  it("should map abdominals to abs", () => {
    expect(mapped({ name: "Cable Crunch", primaryMuscles: ["abdominals"] })).toBe(
      "abs:primary:1.0",
    );
  });

  it.each([
    "Russian Twist",
    "Dumbbell Side Bend",
    "Standing Cable Wood Chop",
    "Oblique Crunches",
    "Pallof Press",
  ])("should make %s obliques primary with abs secondary", (name) => {
    expect(mapped({ name, primaryMuscles: ["abdominals"] })).toBe(
      "obliques:primary:1.0;abs:secondary:0.5",
    );
  });

  it("should make abdominals listed as secondary a stabiliser", () => {
    expect(
      mapped({ name: "Push-Up Wide", primaryMuscles: ["chest"], secondaryMuscles: ["abdominals"] }),
    ).toBe("chest_lower:primary:1.0;chest_upper:secondary:0.6;abs:stabiliser:0.2");
  });
});

describe("the legs", () => {
  it("should map glutes to glute_max and abduction to glute_med", () => {
    expect(
      mapped({
        name: "Barbell Hip Thrust",
        primaryMuscles: ["glutes"],
        secondaryMuscles: ["hamstrings"],
      }),
    ).toBe("glute_max:primary:1.0;hamstrings:secondary:0.5");
    expect(
      mapped({
        name: "Thigh Abductor",
        primaryMuscles: ["abductors"],
        secondaryMuscles: ["glutes"],
      }),
    ).toBe("glute_med:primary:1.0");
    expect(mapped({ name: "Monster Walk", primaryMuscles: ["glutes"] })).toBe(
      "glute_med:primary:1.0",
    );
  });

  it("should map abductors listed as secondary to glute_med", () => {
    expect(
      mapped({
        name: "Box Squat with Bands",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: ["abductors"],
      }),
    ).toBe("quads:primary:1.0;glute_med:secondary:0.5");
  });

  it("should put tibialis only on a dorsiflexion exercise", () => {
    expect(mapped({ name: "Smith Machine Reverse Calf Raises", primaryMuscles: ["calves"] })).toBe(
      "tibialis:primary:1.0",
    );
    expect(mapped({ name: "Standing Calf Raises", primaryMuscles: ["calves"] })).toBe(
      "calves:primary:1.0",
    );
  });

  it("should make calves listed as secondary a stabiliser except in triple extension", () => {
    expect(
      mapped({
        name: "Barbell Squat",
        primaryMuscles: ["quadriceps"],
        secondaryMuscles: ["calves"],
      }),
    ).toBe("quads:primary:1.0;calves:stabiliser:0.2");
    expect(
      mapped({ name: "Push Press", primaryMuscles: ["shoulders"], secondaryMuscles: ["calves"] }),
    ).toBe("delt_front:primary:1.0;delt_side:secondary:0.5;calves:secondary:0.5");
  });

  it("should map the remaining groups one to one", () => {
    expect(
      mapped({
        name: "Something",
        primaryMuscles: ["quadriceps", "hamstrings", "adductors", "neck"],
        secondaryMuscles: ["biceps", "triceps"],
      }),
    ).toBe(
      "quads:primary:1.0;hamstrings:primary:1.0;adductors:primary:1.0;neck:primary:1.0;biceps:secondary:0.5;triceps:secondary:0.5",
    );
  });
});

describe("the arms", () => {
  it("should make forearms secondary on arm work and a grip stabiliser elsewhere", () => {
    expect(
      mapped({ name: "Barbell Curl", primaryMuscles: ["biceps"], secondaryMuscles: ["forearms"] }),
    ).toBe("biceps:primary:1.0;forearms:secondary:0.5");
    expect(
      mapped({ name: "Chin-Up", primaryMuscles: ["lats"], secondaryMuscles: ["forearms"] }),
    ).toBe("lats:primary:1.0;forearms:stabiliser:0.2");
  });

  it.each(["Hammer Curls", "Reverse Cable Curl", "Zottman Curl"])(
    "should add forearms as secondary to %s even when the source lists none",
    (name) => {
      expect(mapped({ name, primaryMuscles: ["biceps"] })).toBe(
        "biceps:primary:1.0;forearms:secondary:0.5",
      );
    },
  );
});

describe("mergeShares", () => {
  it("should keep one share per muscle, the strongest role and then the larger weight", () => {
    expect(
      mergeShares([
        { muscle: "delt_side", role: "secondary", weight: 0.5 },
        { muscle: "delt_side", role: "primary", weight: 1 },
        { muscle: "abs", role: "stabiliser", weight: 0.2 },
        { muscle: "abs", role: "stabiliser", weight: 0.3 },
      ]),
    ).toEqual([
      { muscle: "delt_side", role: "primary", weight: 1 },
      { muscle: "abs", role: "stabiliser", weight: 0.3 },
    ]);
  });
});

describe("categoryExclusion", () => {
  it.each([
    ["stretching", "stretch"],
    ["cardio", "cardio"],
    ["plyometrics", "plyometric drill"],
    ["strength", undefined],
    ["powerlifting", undefined],
    ["olympic weightlifting", undefined],
    ["strongman", undefined],
  ])("should give the category %s the reason %s", (category, reason) => {
    expect(categoryExclusion(sourceExercise({ name: "Anything", category }))).toBe(reason);
  });
});

describe("mapMechanic and mapEquipment", () => {
  it("should keep the source's mechanic and fill a missing one from the secondary muscles", () => {
    expect(
      mapMechanic(
        sourceExercise({ name: "A", mechanic: "isolation", secondaryMuscles: ["calves"] }),
      ),
    ).toBe("isolation");
    expect(
      mapMechanic(sourceExercise({ name: "B", mechanic: null, secondaryMuscles: ["calves"] })),
    ).toBe("compound");
    expect(mapMechanic(sourceExercise({ name: "C", mechanic: null }))).toBe("isolation");
  });

  it("should write missing equipment as body only", () => {
    expect(mapEquipment(sourceExercise({ name: "Inverted Row", equipment: null }))).toBe(
      "body only",
    );
    expect(mapEquipment(sourceExercise({ name: "Cable Crunch", equipment: "cable" }))).toBe(
      "cable",
    );
  });
});
