import {
  allowedGoalsOf,
  describeStepProgress,
  initialSetupWizardState,
  isStepComplete,
  setupWizardReducer,
} from "../../components/SetupScreen/setupDraftReducer";

import type { SetupWizardState } from "../../components/SetupScreen/setupDraftReducer";

const TODAY = "2026-10-23";

const stateAt = (
  step: SetupWizardState["step"],
  draft: SetupWizardState["draft"],
): SetupWizardState => ({
  ...initialSetupWizardState,
  draft,
  step,
});

describe("setupWizardReducer", () => {
  describe("the start", () => {
    it("should open on the sex step with nothing answered", () => {
      expect(initialSetupWizardState).toEqual({
        draft: {},
        step: "sex",
        hasLoadedSavedAnswers: false,
        hasEditedBirthDate: false,
        hasEditedBody: false,
        weightFromWeighInOn: undefined,
        unchosenDefaults: [],
      });
    });
  });

  describe("choosing a sex", () => {
    it("should keep the chosen sex in the draft", () => {
      const state = setupWizardReducer(initialSetupWizardState, { type: "sexChosen", sex: "male" });

      expect(state.draft).toEqual({ sex: "male" });
    });

    it("should keep the answers already given when another sex is chosen", () => {
      const state = setupWizardReducer(stateAt("sex", { sex: "male", birthDate: "1991-03-14" }), {
        type: "sexChosen",
        sex: "female",
      });

      expect(state.draft).toEqual({ sex: "female", birthDate: "1991-03-14" });
    });

    it("should keep Prefer not to say as other", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "sexChosen",
        sex: "other",
      });

      expect(state.draft.sex).toBe("other");
    });
  });

  describe("continuing", () => {
    it("should stay on the sex step until a sex is chosen", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "continued",
        today: TODAY,
      });

      expect(state.step).toBe("sex");
    });

    it("should move from the sex step to the birth date step once a sex is chosen", () => {
      const chosen = setupWizardReducer(initialSetupWizardState, {
        type: "sexChosen",
        sex: "male",
      });

      const state = setupWizardReducer(chosen, { type: "continued", today: TODAY });

      expect(state.step).toBe("birthDate");
    });

    it("should stay on the birth date step while there is no birth date", () => {
      const state = setupWizardReducer(stateAt("birthDate", {}), {
        type: "continued",
        today: TODAY,
      });

      expect(state.step).toBe("birthDate");
    });

    it("should stay on the birth date step when the saved birth date is under 13 today", () => {
      const state = setupWizardReducer(
        stateAt("birthDate", { sex: "male", birthDate: "2015-06-02" }),
        { type: "continued", today: TODAY },
      );

      expect(state.step).toBe("birthDate");
    });

    it("should move from the birth date step to the body step on a valid birth date", () => {
      const state = setupWizardReducer(
        stateAt("birthDate", { sex: "male", birthDate: "1991-03-14" }),
        { type: "continued", today: TODAY },
      );

      expect(state.step).toBe("body");
    });

    it("should stay on the body step while the height and the weight are not both given", () => {
      const state = setupWizardReducer(stateAt("body", { heightCm: 180 }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.step).toBe("body");
    });

    it("should move from the body step to the activity step once the height and the weight are valid", () => {
      const state = setupWizardReducer(
        stateAt("body", { heightCm: 180, weightKg: 80, weightUnit: "kg", heightUnit: "cm" }),
        { type: "continued", today: TODAY },
      );

      expect(state.step).toBe("activity");
    });

    it("should stay on the estimate, which is not a question and has no way to be answered here", () => {
      const state = setupWizardReducer(
        stateAt("estimate", { heightCm: 180, weightKg: 80, goal: "lose" }),
        { type: "continued", today: TODAY },
      );

      expect(state.step).toBe("estimate");
    });

    it("should stay on the activity step until an activity is chosen", () => {
      const state = setupWizardReducer(stateAt("activity", {}), {
        type: "continued",
        today: TODAY,
      });

      expect(state.step).toBe("activity");
    });

    it("should move from the activity step to the goal step once an activity is chosen", () => {
      const state = setupWizardReducer(stateAt("activity", { activity: "light" }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.step).toBe("goal");
    });

    it("should stay on the goal step until a goal is chosen", () => {
      const state = setupWizardReducer(stateAt("goal", {}), { type: "continued", today: TODAY });

      expect(state.step).toBe("goal");
    });

    it.each(["lose", "gain"] as const)(
      "should move from the goal step to the rate step for the goal %s",
      (goal) => {
        const state = setupWizardReducer(stateAt("goal", { goal }), {
          type: "continued",
          today: TODAY,
        });

        expect(state.step).toBe("rate");
      },
    );

    it("should move from the goal step straight to the protein step for maintain", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "maintain", ratePctPerWeek: 0 }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.step).toBe("protein");
    });

    it("should move from the rate step to the protein step, from the protein step to the diet step and from the diet step to the estimate", () => {
      const draft = { goal: "lose", ratePctPerWeek: 0.5 } as const;
      const atRate = stateAt("rate", draft);

      const atProtein = setupWizardReducer(atRate, { type: "continued", today: TODAY });
      const atDiet = setupWizardReducer(atProtein, { type: "continued", today: TODAY });
      const atEstimate = setupWizardReducer(atDiet, { type: "continued", today: TODAY });

      expect([atProtein.step, atDiet.step, atEstimate.step]).toEqual([
        "protein",
        "diet",
        "estimate",
      ]);
    });
  });

  describe("choosing an activity", () => {
    it("should keep the chosen activity and the answers already given", () => {
      const state = setupWizardReducer(stateAt("activity", { sex: "male" }), {
        type: "activityChosen",
        activity: "very",
      });

      expect(state.draft).toEqual({ sex: "male", activity: "very" });
    });
  });

  describe("choosing a goal", () => {
    it("should keep the chosen goal with that goal's default rate", () => {
      const state = setupWizardReducer(stateAt("goal", {}), { type: "goalChosen", goal: "lose" });

      expect(state.draft).toEqual({ goal: "lose", ratePctPerWeek: 0.5 });
    });

    it("should reset the rate to 0.25 when the goal changes from lose to gain", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "lose", ratePctPerWeek: 1.0 }), {
        type: "goalChosen",
        goal: "gain",
      });

      expect(state.draft).toEqual({ goal: "gain", ratePctPerWeek: 0.25 });
    });

    it("should keep a rate chosen for the goal when the same goal is chosen again", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "lose", ratePctPerWeek: 1.0 }), {
        type: "goalChosen",
        goal: "lose",
      });

      expect(state.draft).toEqual({ goal: "lose", ratePctPerWeek: 1.0 });
    });

    it("should give maintain a rate of 0", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "lose", ratePctPerWeek: 0.5 }), {
        type: "goalChosen",
        goal: "maintain",
      });

      expect(state.draft).toEqual({ goal: "maintain", ratePctPerWeek: 0 });
    });

    it("should count seven steps from the moment maintain is chosen", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "lose", ratePctPerWeek: 0.5 }), {
        type: "goalChosen",
        goal: "maintain",
      });

      expect(describeStepProgress(state.draft, state.step).subtitle).toBe("Step 5 of 7");
    });
  });

  describe("choosing a rate, a protein preset and a diet style", () => {
    it("should keep the chosen rate", () => {
      const state = setupWizardReducer(stateAt("rate", { goal: "lose", ratePctPerWeek: 0.5 }), {
        type: "rateChosen",
        ratePctPerWeek: 0.75,
      });

      expect(state.draft).toEqual({ goal: "lose", ratePctPerWeek: 0.75 });
    });

    it("should keep the chosen protein preset", () => {
      const state = setupWizardReducer(stateAt("protein", {}), {
        type: "proteinChosen",
        proteinPreset: "very_high",
      });

      expect(state.draft).toEqual({ proteinPreset: "very_high" });
    });

    it("should keep the chosen diet style", () => {
      const state = setupWizardReducer(stateAt("diet", {}), {
        type: "dietChosen",
        dietStyle: "low_carb",
      });

      expect(state.draft).toEqual({ dietStyle: "low_carb" });
    });
  });

  describe("arriving at a step that has a default", () => {
    it("should choose 0.5 on arrival at the rate step for a lose goal that has no rate", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "lose" }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.draft.ratePctPerWeek).toBe(0.5);
    });

    it("should choose 0.25 on arrival at the rate step for a gain goal that has no rate", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "gain" }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.draft.ratePctPerWeek).toBe(0.25);
    });

    it("should keep a saved rate that is a preset of its goal", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "lose", ratePctPerWeek: 0.75 }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.draft.ratePctPerWeek).toBe(0.75);
    });

    it("should snap a saved rate that is not a preset of its goal to the nearest preset", () => {
      const lose = setupWizardReducer(stateAt("goal", { goal: "lose", ratePctPerWeek: 0.6 }), {
        type: "continued",
        today: TODAY,
      });
      const gain = setupWizardReducer(stateAt("goal", { goal: "gain", ratePctPerWeek: 0.4 }), {
        type: "continued",
        today: TODAY,
      });

      expect([lose.draft.ratePctPerWeek, gain.draft.ratePctPerWeek]).toEqual([0.5, 0.5]);
    });

    it("should snap a lose rate that is halfway between two presets to the slower one", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "lose", ratePctPerWeek: 0.625 }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.draft.ratePctPerWeek).toBe(0.5);
    });

    it("should choose Moderate on arrival at the protein step when no preset is chosen", () => {
      const state = setupWizardReducer(stateAt("rate", { goal: "lose", ratePctPerWeek: 0.5 }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.draft.proteinPreset).toBe("moderate");
    });

    it("should keep the protein preset that is already chosen", () => {
      const state = setupWizardReducer(
        stateAt("rate", { goal: "lose", ratePctPerWeek: 0.5, proteinPreset: "high" }),
        { type: "continued", today: TODAY },
      );

      expect(state.draft.proteinPreset).toBe("high");
    });

    it("should choose Moderate on arrival at the protein step from the goal step for maintain", () => {
      const state = setupWizardReducer(stateAt("goal", { goal: "maintain", ratePctPerWeek: 0 }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.draft.proteinPreset).toBe("moderate");
    });

    it("should choose Balanced on arrival at the diet step when no style is chosen", () => {
      const state = setupWizardReducer(stateAt("protein", { proteinPreset: "high" }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.draft.dietStyle).toBe("balanced");
    });

    it("should keep the diet style that is already chosen", () => {
      const state = setupWizardReducer(
        stateAt("protein", { proteinPreset: "high", dietStyle: "low_fat" }),
        { type: "continued", today: TODAY },
      );

      expect(state.draft.dietStyle).toBe("low_fat");
    });

    it("should choose nothing on arrival at the activity step or the goal step", () => {
      const atActivity = setupWizardReducer(stateAt("body", { heightCm: 180, weightKg: 80 }), {
        type: "continued",
        today: TODAY,
      });
      const atGoal = setupWizardReducer(stateAt("activity", { activity: "light" }), {
        type: "continued",
        today: TODAY,
      });

      expect(atActivity.draft).toEqual({ heightCm: 180, weightKg: 80 });
      expect(atGoal.draft).toEqual({ activity: "light" });
    });
  });

  describe("changing the height and the weight", () => {
    const kilograms: { heightCm: number; weightKg: number; weightUnit: "kg" } = {
      heightCm: 180,
      weightKg: 80,
      weightUnit: "kg",
    };

    it("should keep the height and the weight, in kilograms and centimetres, with their units in the draft", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "bodyChanged",
        ...kilograms,
      });

      expect(state.draft).toEqual({
        heightCm: 180,
        weightKg: 80,
        weightUnit: "kg",
        heightUnit: "cm",
      });
    });

    it("should keep feet and inches as the height unit when the weight unit is pounds", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "bodyChanged",
        heightCm: 180,
        weightKg: 80.0137,
        weightUnit: "lb",
      });

      expect(state.draft).toEqual({
        heightCm: 180,
        weightKg: 80.0137,
        weightUnit: "lb",
        heightUnit: "ft_in",
      });
    });

    it("should keep the answers already given", () => {
      const state = setupWizardReducer(stateAt("body", { sex: "male", birthDate: "1991-03-14" }), {
        type: "bodyChanged",
        ...kilograms,
      });

      expect(state.draft).toEqual({
        sex: "male",
        birthDate: "1991-03-14",
        heightCm: 180,
        weightKg: 80,
        weightUnit: "kg",
        heightUnit: "cm",
      });
    });

    it("should remove a height or a weight that is no longer usable, and keep the units", () => {
      const state = setupWizardReducer(
        stateAt("body", { heightCm: 180, weightKg: 80, weightUnit: "kg", heightUnit: "cm" }),
        { type: "bodyChanged", heightCm: undefined, weightKg: undefined, weightUnit: "lb" },
      );

      expect(state.draft).toEqual({ weightUnit: "lb", heightUnit: "ft_in" });
    });

    it("should say the body has been edited", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "bodyChanged",
        ...kilograms,
      });

      expect(state.hasEditedBody).toBe(true);
    });

    it("should keep the weigh-in's date for the weight while the weight is the same number, whatever the unit", () => {
      const prefilled = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { weightKg: 80, weightUnit: "kg", heightUnit: "cm" },
        weighInDate: "2026-10-21",
      });

      const state = setupWizardReducer(prefilled, {
        type: "bodyChanged",
        heightCm: undefined,
        weightKg: 80,
        weightUnit: "lb",
      });

      expect(state.weightFromWeighInOn).toBe("2026-10-21");
    });

    it("should drop the weigh-in's date once the weight is a different number", () => {
      const prefilled = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { weightKg: 80, weightUnit: "kg", heightUnit: "cm" },
        weighInDate: "2026-10-21",
      });

      const state = setupWizardReducer(prefilled, {
        type: "bodyChanged",
        heightCm: undefined,
        weightKg: 80.1,
        weightUnit: "kg",
      });

      expect(state.weightFromWeighInOn).toBeUndefined();
    });

    it("should not bring the weigh-in's date back when the weight is typed back to the weigh-in's number", () => {
      const prefilled = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { weightKg: 80, weightUnit: "kg", heightUnit: "cm" },
        weighInDate: "2026-10-21",
      });
      const changed = setupWizardReducer(prefilled, {
        type: "bodyChanged",
        heightCm: undefined,
        weightKg: undefined,
        weightUnit: "kg",
      });

      const state = setupWizardReducer(changed, {
        type: "bodyChanged",
        heightCm: undefined,
        weightKg: 80,
        weightUnit: "kg",
      });

      expect(state.weightFromWeighInOn).toBeUndefined();
    });
  });

  describe("going back", () => {
    it("should stay on the first step", () => {
      const state = setupWizardReducer(initialSetupWizardState, { type: "wentBack" });

      expect(state.step).toBe("sex");
    });

    it("should go from the birth date step to the sex step and keep every answer", () => {
      const state = setupWizardReducer(
        stateAt("birthDate", { sex: "female", birthDate: "1991-03-14" }),
        { type: "wentBack" },
      );

      expect(state).toEqual(stateAt("sex", { sex: "female", birthDate: "1991-03-14" }));
    });

    it("should skip the rate step on the way back from protein when the goal is maintain", () => {
      const state = setupWizardReducer(stateAt("protein", { goal: "maintain" }), {
        type: "wentBack",
      });

      expect(state.step).toBe("goal");
    });

    it("should go back to the rate step from protein when the goal is lose", () => {
      const state = setupWizardReducer(stateAt("protein", { goal: "lose" }), { type: "wentBack" });

      expect(state.step).toBe("rate");
    });
  });

  describe("a default chosen on arrival and the saved answers that arrive late", () => {
    const AT_RATE = stateAt("rate", { goal: "lose", ratePctPerWeek: 0.5 });
    const arriveAtDiet = (state: SetupWizardState) =>
      [1, 2].reduce(
        (current) => setupWizardReducer(current, { type: "continued", today: TODAY }),
        state,
      );
    const lateSavedAnswers = (saved: SetupWizardState["draft"]) => ({
      type: "savedAnswersLoaded" as const,
      saved,
      today: TODAY,
    });

    it("should let a late saved protein preset replace the Moderate that was chosen for the person", () => {
      const atDiet = arriveAtDiet(AT_RATE);
      expect(atDiet.draft.proteinPreset).toBe("moderate");

      const state = setupWizardReducer(atDiet, lateSavedAnswers({ proteinPreset: "very_high" }));

      expect(state.draft.proteinPreset).toBe("very_high");
    });

    it("should let a late saved diet style replace the Balanced that was chosen for the person", () => {
      const atDiet = arriveAtDiet(AT_RATE);
      expect(atDiet.draft.dietStyle).toBe("balanced");

      const state = setupWizardReducer(atDiet, lateSavedAnswers({ dietStyle: "low_carb" }));

      expect(state.draft.dietStyle).toBe("low_carb");
    });

    it("should keep a protein preset the person pressed over a late saved one", () => {
      const chosen = setupWizardReducer(arriveAtDiet(AT_RATE), {
        type: "proteinChosen",
        proteinPreset: "high",
      });

      const state = setupWizardReducer(chosen, lateSavedAnswers({ proteinPreset: "very_high" }));

      expect(state.draft.proteinPreset).toBe("high");
    });

    it("should keep a diet style the person pressed over a late saved one", () => {
      const chosen = setupWizardReducer(arriveAtDiet(AT_RATE), {
        type: "dietChosen",
        dietStyle: "low_fat",
      });

      const state = setupWizardReducer(chosen, lateSavedAnswers({ dietStyle: "low_carb" }));

      expect(state.draft.dietStyle).toBe("low_fat");
    });

    it("should keep the defaults when the saved answers hold neither", () => {
      const state = setupWizardReducer(arriveAtDiet(AT_RATE), lateSavedAnswers({}));

      expect(state.draft.proteinPreset).toBe("moderate");
      expect(state.draft.dietStyle).toBe("balanced");
    });

    it("should keep the protein default for the saved diet when only the diet was saved", () => {
      const state = setupWizardReducer(
        arriveAtDiet(AT_RATE),
        lateSavedAnswers({ dietStyle: "low_fat" }),
      );

      expect(state.draft.proteinPreset).toBe("moderate");
      expect(state.draft.dietStyle).toBe("low_fat");
    });

    it("should not let the saved rate be dropped, because the person may have changed the goal", () => {
      const state = setupWizardReducer(AT_RATE, lateSavedAnswers({ ratePctPerWeek: 0.75 }));

      expect(state.draft.ratePctPerWeek).toBe(0.5);
    });
  });

  describe("changing the birth date", () => {
    it("should keep a valid birth date in the draft", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "birthDateChanged",
        birthDate: "1991-03-14",
        today: TODAY,
      });

      expect(state.draft).toEqual({ birthDate: "1991-03-14" });
    });

    it("should keep the answers already given when the birth date changes", () => {
      const state = setupWizardReducer(stateAt("birthDate", { sex: "male", heightCm: 180 }), {
        type: "birthDateChanged",
        birthDate: "1991-03-14",
        today: TODAY,
      });

      expect(state.draft).toEqual({ sex: "male", heightCm: 180, birthDate: "1991-03-14" });
    });

    it("should remove the birth date from the draft when it is no longer valid", () => {
      const state = setupWizardReducer(
        stateAt("birthDate", { sex: "male", birthDate: "1991-03-14" }),
        { type: "birthDateChanged", birthDate: undefined, today: TODAY },
      );

      expect(state.draft).toEqual({ sex: "male" });
    });

    it("should clear a Lose goal and its rate when the new birth date makes the person 16", () => {
      const state = setupWizardReducer(
        stateAt("birthDate", { birthDate: "1991-03-14", goal: "lose", ratePctPerWeek: 0.75 }),
        { type: "birthDateChanged", birthDate: "2010-05-01", today: TODAY },
      );

      expect(state.draft).toEqual({
        birthDate: "2010-05-01",
        goal: "maintain",
        ratePctPerWeek: 0,
      });
    });

    it("should keep a Lose goal and its rate when the new birth date makes the person 18", () => {
      const state = setupWizardReducer(
        stateAt("birthDate", { birthDate: "1991-03-14", goal: "lose", ratePctPerWeek: 0.75 }),
        { type: "birthDateChanged", birthDate: "2008-10-23", today: TODAY },
      );

      expect(state.draft).toEqual({
        birthDate: "2008-10-23",
        goal: "lose",
        ratePctPerWeek: 0.75,
      });
    });
  });

  describe("loading the saved answers", () => {
    it("should fill the draft from the saved answers", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { sex: "male", birthDate: "1991-03-14" },
      });

      expect(state.draft).toEqual({ sex: "male", birthDate: "1991-03-14" });
      expect(state.step).toBe("sex");
    });

    it("should say the saved answers have been loaded", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: {},
      });

      expect(state.hasLoadedSavedAnswers).toBe(true);
    });

    it("should load the saved answers once, so a later read cannot undo what the person did since", () => {
      const loaded = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { sex: "male" },
      });
      const changed = setupWizardReducer(loaded, { type: "sexChosen", sex: "female" });

      const state = setupWizardReducer(changed, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { sex: "male", birthDate: "1991-03-14" },
      });

      expect(state.draft).toEqual({ sex: "female" });
    });

    it("should clear a saved Lose goal when the birth date typed during the load makes the person 16", () => {
      const typed = setupWizardReducer(stateAt("birthDate", {}), {
        type: "birthDateChanged",
        birthDate: "2010-05-01",
        today: TODAY,
      });

      const state = setupWizardReducer(typed, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { goal: "lose", ratePctPerWeek: 0.5 },
      });

      expect(state.draft).toEqual({ birthDate: "2010-05-01", goal: "maintain", ratePctPerWeek: 0 });
    });

    it("should keep a saved Lose goal when the birth date typed during the load makes the person 18", () => {
      const typed = setupWizardReducer(stateAt("birthDate", {}), {
        type: "birthDateChanged",
        birthDate: "2008-10-23",
        today: TODAY,
      });

      const state = setupWizardReducer(typed, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { goal: "lose", ratePctPerWeek: 0.5 },
      });

      expect(state.draft).toEqual({ birthDate: "2008-10-23", goal: "lose", ratePctPerWeek: 0.5 });
    });

    it("should leave the saved birth date out once the person has edited the birth date, even to an unusable one", () => {
      const edited = setupWizardReducer(stateAt("birthDate", {}), {
        type: "birthDateChanged",
        birthDate: undefined,
        today: TODAY,
      });

      const state = setupWizardReducer(edited, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { sex: "male", birthDate: "1991-03-14" },
      });

      expect(state.draft).toEqual({ sex: "male" });
    });

    it("should lay the saved height, the weight from the weigh-in and the units under the draft, and note the weigh-in's date", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { heightCm: 180, weightKg: 80, weightUnit: "lb", heightUnit: "ft_in" },
        weighInDate: "2026-10-21",
      });

      expect(state.draft).toEqual({
        heightCm: 180,
        weightKg: 80,
        weightUnit: "lb",
        heightUnit: "ft_in",
      });
      expect(state.weightFromWeighInOn).toBe("2026-10-21");
    });

    it("should note no weigh-in date when there is no weight from a weigh-in", () => {
      const state = setupWizardReducer(initialSetupWizardState, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { heightCm: 180, weightUnit: "kg", heightUnit: "cm" },
      });

      expect(state.weightFromWeighInOn).toBeUndefined();
    });

    it("should leave the saved height, weight and units out once the person has edited the body", () => {
      const edited = setupWizardReducer(initialSetupWizardState, {
        type: "bodyChanged",
        heightCm: undefined,
        weightKg: undefined,
        weightUnit: "lb",
      });

      const state = setupWizardReducer(edited, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { sex: "male", heightCm: 180, weightKg: 80, weightUnit: "kg", heightUnit: "cm" },
        weighInDate: "2026-10-21",
      });

      expect(state.draft).toEqual({ sex: "male", weightUnit: "lb", heightUnit: "ft_in" });
      expect(state.weightFromWeighInOn).toBeUndefined();
    });

    it("should not replace an answer the person has already given", () => {
      const answered = setupWizardReducer(initialSetupWizardState, {
        type: "sexChosen",
        sex: "female",
      });

      const state = setupWizardReducer(answered, {
        type: "savedAnswersLoaded",
        today: TODAY,
        saved: { sex: "male", birthDate: "1991-03-14" },
      });

      expect(state.draft).toEqual({ sex: "female", birthDate: "1991-03-14" });
    });
  });
});

describe("isStepComplete", () => {
  it("should be false for the sex step until a sex is chosen", () => {
    expect(isStepComplete({}, "sex", TODAY)).toBe(false);
    expect(isStepComplete({ sex: "other" }, "sex", TODAY)).toBe(true);
  });

  it("should be true for the birth date step on the day someone turns 13", () => {
    expect(isStepComplete({ birthDate: "2013-10-23" }, "birthDate", TODAY)).toBe(true);
  });

  it("should be false for the birth date step the day before someone turns 13", () => {
    expect(isStepComplete({ birthDate: "2013-10-24" }, "birthDate", TODAY)).toBe(false);
  });
});

describe("isStepComplete on the body step", () => {
  const body = { heightCm: 180, weightKg: 80 };

  it("should be false until both the height and the weight are given", () => {
    expect(isStepComplete({}, "body", TODAY)).toBe(false);
    expect(isStepComplete({ heightCm: 180 }, "body", TODAY)).toBe(false);
    expect(isStepComplete({ weightKg: 80 }, "body", TODAY)).toBe(false);
    expect(isStepComplete(body, "body", TODAY)).toBe(true);
  });

  it.each([
    [100, true],
    [250, true],
    [99.9, false],
    [250.1, false],
  ])("should judge a height of %s cm to be %s", (heightCm, isComplete) => {
    expect(isStepComplete({ ...body, heightCm }, "body", TODAY)).toBe(isComplete);
  });

  it.each([
    [20, true],
    [400, true],
    [19.9, false],
    [400.1, false],
  ])("should judge a weight of %s kg to be %s", (weightKg, isComplete) => {
    expect(isStepComplete({ ...body, weightKg }, "body", TODAY)).toBe(isComplete);
  });
});

describe("isStepComplete on the steps of the answers after the body", () => {
  it("should be false for the activity step until an activity is chosen", () => {
    expect(isStepComplete({}, "activity", TODAY)).toBe(false);
    expect(isStepComplete({ activity: "extra" }, "activity", TODAY)).toBe(true);
  });

  it("should be false for the goal step until a goal is chosen", () => {
    expect(isStepComplete({}, "goal", TODAY)).toBe(false);
    expect(isStepComplete({ goal: "maintain" }, "goal", TODAY)).toBe(true);
  });

  it("should be true for the rate step only when the rate is a preset of the goal", () => {
    expect(isStepComplete({ goal: "lose" }, "rate", TODAY)).toBe(false);
    expect(isStepComplete({ goal: "lose", ratePctPerWeek: 0.6 }, "rate", TODAY)).toBe(false);
    expect(isStepComplete({ goal: "lose", ratePctPerWeek: 1.0 }, "rate", TODAY)).toBe(true);
    expect(isStepComplete({ goal: "gain", ratePctPerWeek: 1.0 }, "rate", TODAY)).toBe(false);
    expect(isStepComplete({ goal: "gain", ratePctPerWeek: 0.1 }, "rate", TODAY)).toBe(true);
  });

  it("should be false for the protein step and the diet step until one is chosen", () => {
    expect(isStepComplete({}, "protein", TODAY)).toBe(false);
    expect(isStepComplete({ proteinPreset: "very_high" }, "protein", TODAY)).toBe(true);
    expect(isStepComplete({}, "diet", TODAY)).toBe(false);
    expect(isStepComplete({ dietStyle: "low_carb" }, "diet", TODAY)).toBe(true);
  });

  it("should be false for the estimate", () => {
    expect(isStepComplete({ goal: "lose", ratePctPerWeek: 0.5 }, "estimate", TODAY)).toBe(false);
  });
});

describe("allowedGoalsOf", () => {
  it("should offer all three goals from 18, on the day of the birthday", () => {
    expect(allowedGoalsOf({ birthDate: "2008-10-23" }, TODAY)).toEqual([
      "lose",
      "maintain",
      "gain",
    ]);
  });

  it("should not offer lose the day before the 18th birthday", () => {
    expect(allowedGoalsOf({ birthDate: "2008-10-24" }, TODAY)).toEqual(["maintain", "gain"]);
  });

  it("should not offer lose when there is no birth date, which is the safe side", () => {
    expect(allowedGoalsOf({}, TODAY)).toEqual(["maintain", "gain"]);
  });
});

describe("describeStepProgress", () => {
  it("should read Step 1 of 8 and fill a ninth of the bar on the sex step", () => {
    const progress = describeStepProgress({}, "sex");

    expect(progress.subtitle).toBe("Step 1 of 8");
    expect(progress.progressName).toBe("Step 1 of 8");
    expect(progress.percent).toBeCloseTo(11.11, 2);
  });

  it("should read Step 2 of 8 and fill two ninths on the birth date step", () => {
    const progress = describeStepProgress({}, "birthDate");

    expect(progress.subtitle).toBe("Step 2 of 8");
    expect(progress.percent).toBeCloseTo(22.22, 2);
  });

  it("should read Step 5 of 8 on the goal step when the goal is lose", () => {
    expect(describeStepProgress({ goal: "lose" }, "goal").subtitle).toBe("Step 5 of 8");
  });

  it("should read Step 5 of 7 on the goal step when the goal is maintain", () => {
    const progress = describeStepProgress({ goal: "maintain" }, "goal");

    expect(progress.subtitle).toBe("Step 5 of 7");
    expect(progress.percent).toBe(62.5);
  });

  it("should name the bar Setup complete, with no step line, on the estimate", () => {
    const progress = describeStepProgress({}, "estimate");

    expect(progress.subtitle).toBeUndefined();
    expect(progress.progressName).toBe("Setup complete");
    expect(progress.percent).toBe(100);
  });
});
