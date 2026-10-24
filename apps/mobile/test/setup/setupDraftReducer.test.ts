import {
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

    it("should stay on a step that is not built yet", () => {
      const state = setupWizardReducer(stateAt("activity", { heightCm: 180, weightKg: 80 }), {
        type: "continued",
        today: TODAY,
      });

      expect(state.step).toBe("activity");
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
