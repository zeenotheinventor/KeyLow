import { onlineManager } from "@tanstack/react-query";
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderSetupFlow,
  resetSetupBackend,
  savedProfile,
  savedWeighIn,
  setupBackend,
} from "./support";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const isChecked = (element: HTMLElement) => element.getAttribute("aria-checked") === "true";
const continueButton = () => screen.findByRole<HTMLButtonElement>("button", { name: "Continue" });
const heading = (name: string) => screen.findByRole("heading", { level: 1, name });
const reducerStep = () => screen.getByRole("status", { name: "Reducer step" }).textContent;

const savedProgram = {
  id: "33333333-3333-4333-8333-333333333333",
  goal: "lose",
  rate_pct_per_week: 0.5,
  protein_g_per_kg: 1.6,
  fat_fraction_of_remaining: 0.3,
  split_preset: "balanced",
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB");
  resetSetupBackend();
  router.push.mockReset();
  router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

/** The first run from the first step to the activity question, with the golden sample's birth date or another. */
async function walkToActivity(birthDate: readonly [string, string, string] = ["14", "03", "1991"]) {
  renderSetupFlow(router);
  await userEvent.click(await screen.findByRole("radio", { name: "Male" }));
  await userEvent.click(await continueButton());
  await heading("When were you born?");
  const [day, month, year] = birthDate;
  await userEvent.type(screen.getByRole("textbox", { name: "Day of birth" }), day);
  await userEvent.type(screen.getByRole("textbox", { name: "Month of birth" }), month);
  await userEvent.type(screen.getByRole("textbox", { name: "Year of birth" }), year);
  await userEvent.click(await continueButton());
  await userEvent.type(
    await screen.findByRole("textbox", { name: "Height in centimetres" }),
    "180",
  );
  await userEvent.type(screen.getByRole("textbox", { name: "Weight in kilograms" }), "80.0");
  await userEvent.click(await continueButton());
  await heading("How active are you?");
}

async function chooseAndContinue(name: string | RegExp) {
  await userEvent.click(await screen.findByRole("radio", { name }));
  await userEvent.click(await continueButton());
}

describe("the activity step", () => {
  it("should show the five levels with nothing chosen and Continue off, in step 4 of 8", async () => {
    await walkToActivity();

    expect(screen.getByText("Activity · Step 4 of 8")).toBeTruthy();
    expect(screen.getByRole("progressbar", { name: "Step 4 of 8" })).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "How active are you?" });
    const levels = within(group).getAllByRole("radio");
    expect(levels).toHaveLength(5);
    expect(levels.some(isChecked)).toBe(false);
    expect((await continueButton()).disabled).toBe(true);
  });

  it("should turn Continue on once a level is chosen and open the goal at its own address", async () => {
    await walkToActivity();

    await userEvent.click(screen.getByRole("radio", { name: /^Lightly active/ }));
    expect((await continueButton()).disabled).toBe(false);
    await userEvent.click(await continueButton());

    expect(router.push).toHaveBeenLastCalledWith("/setup/goal?mode=first-run");
    expect(await heading("What is your goal?")).toBeTruthy();
  });
});

describe("the goal step", () => {
  it("should offer all three goals with the pregnancy note under them, and nothing chosen", async () => {
    await walkToActivity();
    await chooseAndContinue(/^Lightly active/);

    expect(screen.getByText("Goal · Step 5 of 8")).toBeTruthy();
    const goals = within(
      screen.getByRole("radiogroup", { name: "What is your goal?" }),
    ).getAllByRole("radio");
    expect(goals.map((goal) => goal.hasAttribute("disabled"))).toEqual([false, false, false]);
    expect(goals.some(isChecked)).toBe(false);
    expect(screen.getByText("Pregnant or breastfeeding?")).toBeTruthy();
    expect((await continueButton()).disabled).toBe(true);
  });

  it("should switch Lose off with its reason under 18, note the under 18 words and count seven steps once Maintain is chosen", async () => {
    await walkToActivity(["02", "06", "2010"]);
    await chooseAndContinue(/^Lightly active/);

    const lose = screen.getByRole("radio", { name: /^Lose weight/ });
    expect(lose.hasAttribute("disabled")).toBe(true);
    expect(lose.getAttribute("aria-label")).toBe("Lose weight, Not offered under 18");
    expect(screen.getByText("Talk to a health professional")).toBeTruthy();
    expect(screen.queryByText("Pregnant or breastfeeding?")).toBeNull();

    await userEvent.click(screen.getByRole("radio", { name: /^Maintain weight/ }));

    expect(screen.getByText("Goal · Step 5 of 7")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Step 5 of 7" }).getAttribute("aria-valuenow"),
    ).toBe("63");
  });

  it("should skip the rate after Maintain and open the protein step, which is step 6 of 7", async () => {
    await walkToActivity();
    await chooseAndContinue(/^Lightly active/);

    await chooseAndContinue(/^Maintain weight/);

    expect(router.push).toHaveBeenLastCalledWith("/setup/protein?mode=first-run");
    expect(await heading("How much protein?")).toBeTruthy();
    expect(screen.getByText("Macros · Step 6 of 7")).toBeTruthy();
  });
});

describe("the rate step", () => {
  async function walkToRate(goal: RegExp) {
    await walkToActivity();
    await chooseAndContinue(/^Lightly active/);
    await chooseAndContinue(goal);
  }

  it("should name the direction for Lose, choose 0.5% on arrival with the Suggested badge, and work the weekly amounts from 80 kg", async () => {
    await walkToRate(/^Lose weight/);

    expect(await heading("How fast do you want to lose weight?")).toBeTruthy();
    expect(screen.getByText("Goal · Step 6 of 8")).toBeTruthy();
    const group = screen.getByRole("radiogroup", { name: "How fast do you want to lose weight?" });
    const rates = within(group).getAllByRole("radio");
    expect(rates.map((rate) => rate.getAttribute("aria-label"))).toEqual([
      "0.25% a week, Gentle, and easy to keep up, about 0.2 kilograms a week",
      "0.5% a week, Suggested, A steady pace, about 0.4 kilograms a week",
      "0.75% a week, Faster, and harder to keep up, about 0.6 kilograms a week",
      "1.0% a week, The fastest Ki-Lo sets, about 0.8 kilograms a week",
    ]);
    expect(rates.map(isChecked)).toEqual([false, true, false, false]);
    expect((await continueButton()).disabled).toBe(false);
  });

  it("should name the direction for Gain, with 0.25% chosen and Suggested", async () => {
    await walkToRate(/^Gain weight/);

    expect(await heading("How fast do you want to gain weight?")).toBeTruthy();
    expect(
      screen.getByRole("radiogroup", { name: "How fast do you want to gain weight?" }),
    ).toBeTruthy();
    const suggested = screen.getByRole("radio", { name: /Suggested/ });
    expect(suggested.getAttribute("aria-label")).toContain("0.25% a week");
    expect(isChecked(suggested)).toBe(true);
  });

  it("should keep the Suggested badge on the default when another rate is chosen", async () => {
    await walkToRate(/^Lose weight/);

    await userEvent.click(screen.getByRole("radio", { name: /^0\.75% a week/ }));

    expect(isChecked(screen.getByRole("radio", { name: /^0\.75% a week/ }))).toBe(true);
    const suggested = screen.getByRole("radio", { name: /Suggested/ });
    expect(suggested.getAttribute("aria-label")).toContain("0.5% a week");
    expect(isChecked(suggested)).toBe(false);
  });

  it("should open the protein step for the chosen rate", async () => {
    await walkToRate(/^Lose weight/);

    await userEvent.click(await continueButton());

    expect(router.push).toHaveBeenLastCalledWith("/setup/protein?mode=first-run");
    expect(await heading("How much protein?")).toBeTruthy();
    expect(screen.getByText("Macros · Step 7 of 8")).toBeTruthy();
  });
});

describe("the protein and diet steps, the golden sample", () => {
  async function walkToProtein() {
    await walkToActivity();
    await chooseAndContinue(/^Lightly active/);
    await chooseAndContinue(/^Lose weight/);
    await userEvent.click(await continueButton());
    await heading("How much protein?");
  }

  it("should choose Moderate on arrival and show the grams a day at 80 kg", async () => {
    await walkToProtein();

    const group = screen.getByRole("radiogroup", { name: "How much protein?" });
    const presets = within(group).getAllByRole("radio");
    expect(presets.map((preset) => preset.getAttribute("aria-label"))).toEqual([
      "Moderate, 1.6 g per kg of body weight. Enough for most people, 128 g a day",
      "High, 2.0 g per kg. Suits regular strength training, 160 g a day",
      "Very high, 2.2 g per kg. Helps keep muscle while you lose weight, 176 g a day",
    ]);
    expect(presets.map(isChecked)).toEqual([true, false, false]);
    expect((await continueButton()).disabled).toBe(false);
  });

  it("should choose Balanced on arrival at step 8 of 8 and keep Continue off until the estimate is built", async () => {
    await walkToProtein();
    await userEvent.click(await continueButton());

    expect(await heading("How do you like to eat?")).toBeTruthy();
    expect(screen.getByText("Macros · Step 8 of 8")).toBeTruthy();
    expect(isChecked(screen.getByRole("radio", { name: /^Balanced/ }))).toBe(true);
    expect((await continueButton()).disabled).toBe(true);
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("should offer Balanced, Low fat and Low carb and no keto", async () => {
    await walkToProtein();
    await userEvent.click(await continueButton());

    const group = await screen.findByRole("radiogroup", { name: "How do you like to eat?" });
    expect(
      within(group)
        .getAllByRole("radio")
        .map((style) => style.getAttribute("aria-label")?.split(",")[0]),
    ).toEqual(["Balanced", "Low fat", "Low carb"]);
  });
});

describe("the weight and unit the amounts are worked from", () => {
  function savedLoseProgramAt(weightKg: number, weightUnit: "kg" | "lb") {
    setupBackend.profile = { ...savedProfile, weight_unit: weightUnit };
    setupBackend.weighIn = { ...savedWeighIn, weight_kg: weightKg };
    setupBackend.program = { ...savedProgram };
  }

  const weeklyAmounts = (group: HTMLElement) =>
    within(group)
      .getAllByRole("radio")
      .map((rate) => rate.getAttribute("aria-label")?.split(", ").at(-1));

  it("should write the weekly amounts in pounds for a pounds profile at 80 kg", async () => {
    savedLoseProgramAt(80, "lb");
    renderSetupFlow(router, "/setup/rate?mode=recalculate");

    const group = await screen.findByRole("radiogroup", {
      name: "How fast do you want to lose weight?",
    });

    expect(weeklyAmounts(group)).toEqual([
      "about 0.4 pounds a week",
      "about 0.9 pounds a week",
      "about 1.3 pounds a week",
      "about 1.8 pounds a week",
    ]);
  });

  it("should work the rates and the protein from a body weight other than 80 kg", async () => {
    savedLoseProgramAt(90.7, "lb");
    renderSetupFlow(router, "/setup/rate?mode=recalculate");

    const rates = await screen.findByRole("radiogroup", {
      name: "How fast do you want to lose weight?",
    });
    expect(weeklyAmounts(rates)).toEqual([
      "about 0.5 pounds a week",
      "about 1.0 pounds a week",
      "about 1.5 pounds a week",
      "about 2.0 pounds a week",
    ]);

    await userEvent.click(await continueButton());
    const protein = await screen.findByRole("radiogroup", { name: "How much protein?" });
    expect(
      within(protein)
        .getAllByRole("radio")
        .map((preset) => preset.getAttribute("aria-label")?.split(", ").at(-1)),
    ).toEqual(["145 g a day", "181 g a day", "200 g a day"]);
  });
});

describe("Back through steps 4 to 8", () => {
  it("should keep every answer, and take the rate away when the goal is changed to Maintain", async () => {
    await walkToActivity();
    await chooseAndContinue(/^Lightly active/);
    await chooseAndContinue(/^Lose weight/);
    await userEvent.click(await screen.findByRole("radio", { name: /^0\.75% a week/ }));
    await userEvent.click(await continueButton());
    await userEvent.click(await screen.findByRole("radio", { name: /^High/ }));

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.push).toHaveBeenLastCalledWith("/setup/rate?mode=first-run");
    expect(isChecked(await screen.findByRole("radio", { name: /^0\.75% a week/ }))).toBe(true);

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.push).toHaveBeenLastCalledWith("/setup/goal?mode=first-run");
    expect(isChecked(await screen.findByRole("radio", { name: /^Lose weight/ }))).toBe(true);

    await userEvent.click(screen.getByRole("radio", { name: /^Maintain weight/ }));
    await userEvent.click(await continueButton());

    expect(router.push).toHaveBeenLastCalledWith("/setup/protein?mode=first-run");
    expect(await heading("How much protein?")).toBeTruthy();
    expect(isChecked(screen.getByRole("radio", { name: /^High/ }))).toBe(true);
    expect(screen.getByText("Macros · Step 6 of 7")).toBeTruthy();
  });

  it("should go back from the protein step of a Maintain goal to the goal, not to the rate", async () => {
    await walkToActivity();
    await chooseAndContinue(/^Lightly active/);
    await chooseAndContinue(/^Maintain weight/);
    await heading("How much protein?");

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.push).toHaveBeenLastCalledWith("/setup/goal?mode=first-run");
  });
});

describe("a typed address", () => {
  function savedAnswers(goal: string) {
    setupBackend.profile = { ...savedProfile };
    setupBackend.weighIn = { ...savedWeighIn };
    setupBackend.program = {
      ...savedProgram,
      goal,
      rate_pct_per_week: goal === "gain" ? 0.25 : 0.5,
    };
  }

  it("should send /setup/rate with Maintain chosen on to the protein step", async () => {
    savedAnswers("maintain");
    renderSetupFlow(router, "/setup/rate?mode=recalculate");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/setup/protein?mode=recalculate");
    });
    expect(await heading("How much protein?")).toBeTruthy();
  });

  it("should show the rate step of a saved Lose goal at its address, with Continue on", async () => {
    savedAnswers("lose");
    renderSetupFlow(router, "/setup/rate?mode=recalculate");

    expect(await heading("How fast do you want to lose weight?")).toBeTruthy();
    expect((await continueButton()).disabled).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(reducerStep()).toBe("rate");
    });
  });
});

describe("the read's banner on steps 4 to 8", () => {
  it("should show on the activity step, and keep the answer the person gave when Try again brings the saved ones", async () => {
    setupBackend.status = "error";
    await walkToActivity();
    expect(screen.getByRole("alert").textContent).toContain(
      "Couldn't load your saved answers. You can still answer here.",
    );
    await userEvent.click(screen.getByRole("radio", { name: /^Very active/ }));
    setupBackend.status = "ready";
    setupBackend.profile = { ...savedProfile };

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(isChecked(screen.getByRole("radio", { name: /^Very active/ }))).toBe(true);
    expect(isChecked(screen.getByRole("radio", { name: /^Lightly active/ }))).toBe(false);
  });

  it("should show on the diet step too", async () => {
    setupBackend.status = "error";
    await walkToActivity();
    await chooseAndContinue(/^Lightly active/);
    await chooseAndContinue(/^Maintain weight/);
    await userEvent.click(await continueButton());

    expect(await heading("How do you like to eat?")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("Couldn't load your saved answers.");
  });
});

describe("offline", () => {
  it("should draw no notice on steps 4 to 8 and keep the answers", async () => {
    onlineManager.setOnline(false);
    await walkToActivity();

    await userEvent.click(screen.getByRole("radio", { name: /^Lightly active/ }));

    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("status", { name: /offline/i })).toBeNull();
    expect((await continueButton()).disabled).toBe(false);
  });
});
