import { keys } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  measuredCheckinRow,
  renderSetupFlow,
  resetSetupBackend,
  savedProfile,
  savedProgram,
  savedWeighIn,
  setupBackend,
  signInSetupClient,
  weighInRow,
} from "./support";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const motion = vi.hoisted(() => ({ isReduced: true }));
vi.mock("@/lib/motion", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/motion")>()),
  useReducedMotion: () => motion.isReduced,
}));

const ESTIMATE_RECALCULATE = "/setup/estimate?mode=recalculate";
const ESTIMATE_FIRST_RUN = "/setup/estimate?mode=first-run";

// The golden samples of setup.md. The default rows are the main one: male, born 14 March 1991, 180 cm, 80.0 kg,
// lightly active, lose 0.5% a week, moderate protein, balanced.
const FLOOR_SAMPLE = {
  profile: {
    ...savedProfile,
    sex: "female",
    birth_date: "1996-03-14",
    height_cm: 160,
    activity: "sedentary",
  },
  program: { ...savedProgram, rate_pct_per_week: 1.0 },
  weighIn: { weight_kg: 55, local_date: "2026-10-21" },
};
const DEFICIT_CAP_SAMPLE = {
  profile: { ...savedProfile, birth_date: "1986-03-14", height_cm: 175, activity: "moderate" },
  program: { ...savedProgram, rate_pct_per_week: 1.0 },
  weighIn: { weight_kg: 130, local_date: "2026-10-21" },
};

function givenMainSample() {
  setupBackend.profile = { ...savedProfile };
  setupBackend.program = { ...savedProgram };
  setupBackend.weighIn = { ...savedWeighIn };
}

function givenSample(sample: {
  profile: Record<string, unknown>;
  program: Record<string, unknown>;
  weighIn: Record<string, unknown>;
}) {
  setupBackend.profile = sample.profile;
  setupBackend.program = sample.program;
  setupBackend.weighIn = sample.weighIn;
}

function givenMeasuredSample() {
  givenMainSample();
  setupBackend.program = { ...savedProgram, rate_pct_per_week: 0.25 };
  setupBackend.weighIn = { weight_kg: 79.02, local_date: "2026-10-22" };
  setupBackend.weighIns = [weighInRow("2026-10-22", 79.02)];
  setupBackend.snapshots = [measuredCheckinRow("2026-10-23", 2579.54)];
}

async function openEstimate(address = ESTIMATE_RECALCULATE) {
  await signInSetupClient();
  const view = renderSetupFlow(router, address);
  await screen.findByRole("group", { name: "Calorie target, estimate" });
  // A recalculation holds Save targets while the programme reads load, so a press waits for them.
  await waitFor(() => {
    expect(startButton().disabled).toBe(false);
  });
  // The harness follows the router to the address it is given, which here is a page outside the wizard. The real
  // app unmounts the wizard instead, so the page stays as it is drawn and the call is only watched.
  router.replace.mockImplementation(() => undefined);
  return view;
}

const card = () => screen.getByRole("group", { name: "Calorie target, estimate" });
const startButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: /^(Start|Save targets)$/ });
const figures = () => {
  const tiles = within(card())
    .getAllByRole("definition")
    .map((tile) => tile.textContent);
  const numeral = within(card())
    .getAllByText(/^[\d,]+$/)
    .at(-1)?.textContent;
  const expenditure = within(
    screen.getByRole("region", { name: "Estimated expenditure" }),
  ).getByText(/^[\d,]+$/).textContent;
  return { kcal: numeral, tiles, expenditure };
};
const writesOfKind = (kind: (typeof setupBackend.writes)[number]["kind"]) =>
  setupBackend.writes.filter((write) => write.kind === kind);

beforeEach(() => {
  // Only the date is faked, so the read and the timers of the page run as they do.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB");
  resetSetupBackend();
  motion.isReduced = true;
  router.push.mockReset();
  router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the estimate, the golden samples", () => {
  it("should draw the main sample: 1,970 kcal, P 128, C 218, F 65, expenditure 2,413", async () => {
    givenMainSample();
    await openEstimate();

    expect(figures()).toEqual({
      kcal: "1,970",
      tiles: ["128 g", "218 g", "65 g"],
      expenditure: "2,413",
    });
    expect(screen.getByText("To lose about 0.4 kg a week (0.5% of your weight).")).toBeTruthy();
  });

  it("should draw the floor, whose line replaces the rate line: 1,200 kcal, P 88, C 127, F 38, expenditure 1,487", async () => {
    givenSample(FLOOR_SAMPLE);
    await openEstimate();

    expect(figures()).toEqual({
      kcal: "1,200",
      tiles: ["88 g", "127 g", "38 g"],
      expenditure: "1,487",
    });
    expect(
      within(card()).getByText(/^Raised to 1,200 kcal, the lowest target Ki-Lo sets/),
    ).toBeTruthy();
    expect(within(card()).queryByText(/^To lose about/)).toBeNull();
  });

  it("should draw the deficit cap: 2,390 kcal, P 208, C 234, F 69, expenditure 3,408", async () => {
    givenSample(DEFICIT_CAP_SAMPLE);
    await openEstimate();

    expect(figures()).toEqual({
      kcal: "2,390",
      tiles: ["208 g", "234 g", "69 g"],
      expenditure: "3,408",
    });
    expect(within(card()).getByText(/^Kept to a 30% deficit, the most Ki-Lo sets/)).toBeTruthy();
  });

  it("should draw the measured estimate after a check-in: 2,360 kcal, P 126, C 280, F 82, expenditure 2,580", async () => {
    givenMainSample();
    setupBackend.program = { ...savedProgram, rate_pct_per_week: 0.25 };
    setupBackend.weighIn = { weight_kg: 79.02, local_date: "2026-10-22" };
    setupBackend.weighIns = [weighInRow("2026-10-22", 79.02)];
    setupBackend.snapshots = [measuredCheckinRow("2026-10-23", 2579.54)];
    await openEstimate();

    expect(await screen.findByText("Your new targets")).toBeTruthy();
    expect(figures()).toEqual({
      kcal: "2,360",
      tiles: ["126 g", "280 g", "82 g"],
      expenditure: "2,580",
    });
    expect(screen.getByText("Measured from your weigh-ins and food log")).toBeTruthy();
    expect(
      screen.getByText(
        /^Ki-Lo measured your expenditure at your last check-in, on Friday 23 October/,
      ),
    ).toBeTruthy();
  });

  it("should say the expenditure was carried forward when no check-in measured", async () => {
    givenMainSample();
    setupBackend.weighIns = [weighInRow("2026-10-22", 80)];
    setupBackend.snapshots = [
      {
        ...measuredCheckinRow("2026-10-20", 2580),
        measurement: {
          eligible: false,
          reasons: ["weigh_days"],
          spanDays: 14,
          weighDays: 5,
          completeDays: 12,
        },
      },
    ];
    await openEstimate();

    expect(await screen.findByText("Carried forward from your last check-in")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "Your new targets" })).toBeTruthy();
  });
});

describe("the shape of the estimate", () => {
  it("should have the caption, a full bar named Setup complete and the legal line", async () => {
    givenMainSample();
    await openEstimate();

    expect(screen.getByText("Your estimate")).toBeTruthy();
    expect(
      screen.getByRole("progressbar", { name: "Setup complete" }).getAttribute("aria-valuenow"),
    ).toBe("100");
    expect(screen.getByText(/are not medical advice/)).toBeTruthy();
    expect(within(card()).getByText("Estimate")).toBeTruthy();
  });

  it("should say Start with Back on the first run, and Save targets with Close and Back in a recalculation", async () => {
    givenMainSample();
    const first = await openEstimate(ESTIMATE_FIRST_RUN);
    expect(startButton().textContent).toBe("Start");
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
    first.unmount();

    await openEstimate(ESTIMATE_RECALCULATE);
    expect(startButton().textContent).toBe("Save targets");
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  });

  it("should go back to the diet step and close to Targets", async () => {
    givenMainSample();
    await openEstimate();

    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(router.push).toHaveBeenCalledWith("/setup/diet?mode=recalculate");
  });

  it("should close to Targets at once", async () => {
    givenMainSample();
    await openEstimate();

    await userEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(router.replace).toHaveBeenCalledWith("/more/targets");
  });

  it("should open the estimate from the diet step now that Continue is on there", async () => {
    givenMainSample();
    await signInSetupClient();
    renderSetupFlow(router, "/setup/diet?mode=recalculate");

    await userEvent.click(
      await screen.findByRole<HTMLButtonElement>("button", { name: "Continue" }),
    );

    expect(router.push).toHaveBeenCalledWith(ESTIMATE_RECALCULATE);
    expect(await screen.findByRole("group", { name: "Calorie target, estimate" })).toBeTruthy();
  });
});

describe("saving, the first run", () => {
  it("should write the weigh-in, the programme, the profile and the recompute once, and land on the Diary", async () => {
    givenMainSample();
    await openEstimate(ESTIMATE_FIRST_RUN);

    await userEvent.click(startButton());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/diary");
    });
    expect(setupBackend.writes.map((write) => write.kind)).toEqual([
      "program-update",
      "profile",
      "recompute",
    ]);
    expect(writesOfKind("profile")[0]?.body).toMatchObject({
      target_kcal: 1970,
      target_protein_g: 128,
      target_carbs_g: 218,
      target_fat_g: 65,
    });
    expect(screen.queryByText("Targets saved")).toBeNull();
  });

  it("should add the weigh-in only when the weight is not the latest one", async () => {
    givenMainSample();
    setupBackend.weighIn = { weight_kg: 80, local_date: "2026-10-21" };
    await openEstimate(ESTIMATE_FIRST_RUN);
    await userEvent.click(startButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });

    expect(writesOfKind("weigh-in")).toHaveLength(0);
  });
});

describe("the unit and the weigh-in the save carries", () => {
  it("should send the unit when none is stored, and write the weigh-in of a weight that is not the latest", async () => {
    setupBackend.profile = { ...savedProfile, weight_unit: null };
    setupBackend.program = { ...savedProgram };
    setupBackend.weighIn = { weight_kg: 81.5, local_date: "2026-10-21" };
    await openEstimate(ESTIMATE_FIRST_RUN);
    await userEvent.click(startButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });

    expect(writesOfKind("profile")[0]?.body).toMatchObject({ weight_unit: "kg" });
    // The latest weigh-in is the draft's weight here, so no second row is added for the same figure.
    expect(writesOfKind("weigh-in")).toHaveLength(0);
  });

  it("should keep a stored unit and not send one", async () => {
    setupBackend.profile = { ...savedProfile, weight_unit: "lb" };
    setupBackend.program = { ...savedProgram };
    setupBackend.weighIn = { ...savedWeighIn };
    await openEstimate(ESTIMATE_FIRST_RUN);
    await userEvent.click(startButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });

    expect(Object.keys(writesOfKind("profile")[0]?.body ?? {})).not.toContain("weight_unit");
  });
});

describe("saving, a recalculation", () => {
  it("should return to Targets with the toast Targets saved", async () => {
    givenMainSample();
    await openEstimate();

    await userEvent.click(startButton());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/more/targets");
    });
    expect(await screen.findByText("Targets saved")).toBeTruthy();
  });

  it("should drop the targets and the programme reads, and nothing else, without waiting for a refetch", async () => {
    givenMainSample();
    const { queryClient } = await openEstimate();
    const removed = vi.spyOn(queryClient, "removeQueries");

    await userEvent.click(startButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });

    expect(removed.mock.calls.map(([filters]) => filters?.queryKey)).toEqual([
      keys.profiles.targets,
      keys.program.all,
    ]);
  });

  it("should keep the measured figures it drew while the reads they came from are dropped", async () => {
    givenMainSample();
    setupBackend.program = { ...savedProgram, rate_pct_per_week: 0.25 };
    setupBackend.weighIn = { weight_kg: 79.02, local_date: "2026-10-22" };
    setupBackend.weighIns = [weighInRow("2026-10-22", 79.02)];
    setupBackend.snapshots = [measuredCheckinRow("2026-10-23", 2579.54)];
    setupBackend.holdingWrite = true;
    const { goTo } = await openEstimate();
    await screen.findByText("Your new targets");
    await userEvent.click(startButton());
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });

    // The history is dropped by the save and is not read again before the page goes, as on a slow connection.
    setupBackend.holdingSnapshots = true;
    act(() => {
      setupBackend.holdingWrite = false;
      setupBackend.releaseWrite?.();
    });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });
    // Anything that draws the page again, as the navigation under way does, makes the dropped reads start empty.
    act(() => {
      goTo(`${ESTIMATE_RECALCULATE}&redrawn=1`);
    });
    await waitFor(() => {
      expect(setupBackend.releaseSnapshots).toBeDefined();
    });

    expect(screen.getByRole("heading", { level: 1, name: "Your new targets" })).toBeTruthy();
    expect(figures()).toEqual({
      kcal: "2,360",
      tiles: ["126 g", "280 g", "82 g"],
      expenditure: "2,580",
    });
  });

  it("should show the toast for a person who left mid-save, and not send them anywhere", async () => {
    givenMainSample();
    setupBackend.holdingWrite = true;
    const { leave } = await openEstimate();
    await userEvent.click(startButton());
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });

    act(() => {
      leave();
    });
    act(() => {
      setupBackend.holdingWrite = false;
      setupBackend.releaseWrite?.();
    });

    expect(await screen.findByText("Targets saved")).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("one save per press", () => {
  it("should save once on a double press, and stay busy until the page has gone", async () => {
    givenMainSample();
    setupBackend.holdingWrite = true;
    await openEstimate();
    const start = startButton();

    await userEvent.dblClick(start);
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });

    expect(start.getAttribute("aria-busy")).toBe("true");
    expect(screen.getByRole("img", { name: "Saving" })).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Back" }).disabled).toBe(true);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Close" }).disabled).toBe(true);

    act(() => {
      setupBackend.holdingWrite = false;
      setupBackend.releaseWrite?.();
    });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledTimes(1);
    });
    expect(writesOfKind("program-update")).toHaveLength(1);
    expect(writesOfKind("profile")).toHaveLength(1);
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Back" }).disabled).toBe(true);
  });
});

describe("two presses before the page has drawn the first", () => {
  it("should still save once, because the guard is a ref and not the button's state", async () => {
    givenMainSample();
    setupBackend.holdingWrite = true;
    await openEstimate();
    const start = startButton();

    act(() => {
      fireEvent.click(start);
      fireEvent.click(start);
    });
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });
    act(() => {
      setupBackend.holdingWrite = false;
      setupBackend.releaseWrite?.();
    });
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledTimes(1);
    });

    expect(writesOfKind("program-update")).toHaveLength(1);
    expect(writesOfKind("profile")).toHaveLength(1);
  });
});

describe("a failed save", () => {
  it("should show the failed banner with Save targets live, and the next press retry and succeed", async () => {
    givenMainSample();
    setupBackend.failingWrite = true;
    await openEstimate();

    await userEvent.click(startButton());

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Not saved. Check your connection and try again.",
    );
    expect(startButton().disabled).toBe(false);
    expect(router.replace).not.toHaveBeenCalled();

    setupBackend.failingWrite = false;
    await userEvent.click(startButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/more/targets");
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should put focus back on the button, which lost it while the save ran", async () => {
    // A browser drops focus from a button that is turned off. jsdom keeps it, so the loss is made here.
    givenMainSample();
    setupBackend.holdingWrite = true;
    setupBackend.failingWrite = true;
    await openEstimate();
    const start = startButton();
    await userEvent.click(start);
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });
    act(() => {
      screen.getByRole("heading", { level: 1 }).focus();
    });
    expect(document.activeElement).not.toBe(start);

    act(() => {
      setupBackend.holdingWrite = false;
      setupBackend.releaseWrite?.();
    });

    await screen.findByRole("alert");
    expect(document.activeElement).toBe(start);
  });

  it("should draw the figures as they are again after a failure, not as they were when it was pressed", async () => {
    givenMeasuredSample();
    setupBackend.failingWrite = true;
    const { queryClient } = await openEstimate();
    await screen.findByText("Your new targets");
    await userEvent.click(startButton());
    await screen.findByRole("alert");

    act(() => {
      queryClient.setQueryData(keys.program.expenditureHistory(52), [
        {
          id: "44444444-4444-4444-8444-444444444444",
          asOfDate: "2026-10-23",
          kind: "checkin",
          muKcal: 2600,
          varKcal2: 13_700,
          measurement: {
            eligible: false,
            reasons: ["weigh_days"],
            spanDays: 14,
            weighDays: 5,
            completeDays: 12,
          },
        },
      ]);
    });

    expect(await screen.findByText("Carried forward from your last check-in")).toBeTruthy();
    expect(figures().expenditure).toBe("2,600");
  });
});

describe("offline", () => {
  it("should turn Start off and say why, with the answers still on the page", async () => {
    givenMainSample();
    await openEstimate();

    act(() => {
      onlineManager.setOnline(false);
    });

    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(
      screen.getByText("Your answers stay on this page. Saving needs a connection."),
    ).toBeTruthy();
    expect(screen.queryByText(/last saved diary/)).toBeNull();
    expect(startButton().disabled).toBe(true);
    expect(figures().kcal).toBe("1,970");
  });

  it("should replace an earlier failed save with the offline banner, and not bring it back online", async () => {
    givenMainSample();
    setupBackend.failingWrite = true;
    await openEstimate();
    await userEvent.click(startButton());
    await screen.findByRole("alert");

    act(() => {
      onlineManager.setOnline(false);
    });
    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(screen.queryByText("Not saved. Check your connection and try again.")).toBeNull();

    act(() => {
      onlineManager.setOnline(true);
    });
    await waitFor(() => {
      expect(screen.queryByText("You're offline")).toBeNull();
    });
    expect(screen.queryByText("Not saved. Check your connection and try again.")).toBeNull();
  });

  it("should not save when the press is made offline", async () => {
    givenMainSample();
    await openEstimate();
    act(() => {
      onlineManager.setOnline(false);
    });
    await screen.findByText("You're offline");

    await userEvent.click(startButton());

    expect(setupBackend.writes).toEqual([]);
  });
});

describe("the hold while the saved answers are not known", () => {
  // The answers are given by walking the steps with the saved setup unreadable, which is how a person reaches the
  // estimate after a failed read. Nothing is signed in more than a save needs.
  async function walkToEstimateWithoutSavedAnswers() {
    await signInSetupClient();
    renderSetupFlow(router, "/setup?mode=recalculate");
    const next = async () => {
      await userEvent.click(await screen.findByRole("button", { name: "Continue" }));
    };
    await userEvent.click(await screen.findByRole("radio", { name: "Male" }));
    await next();
    await userEvent.type(await screen.findByRole("textbox", { name: "Day of birth" }), "14");
    await userEvent.type(screen.getByRole("textbox", { name: "Month of birth" }), "03");
    await userEvent.type(screen.getByRole("textbox", { name: "Year of birth" }), "1991");
    await next();
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Height in centimetres" }),
      "180",
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Weight in kilograms" }), "80.0");
    await next();
    await userEvent.click(await screen.findByRole("radio", { name: /^Lightly active/ }));
    await next();
    await userEvent.click(await screen.findByRole("radio", { name: /^Lose weight/ }));
    await next();
    await userEvent.click(await screen.findByRole("radio", { name: /0\.5%/ }));
    await next();
    await userEvent.click(await screen.findByRole("radio", { name: /^Moderate/ }));
    await next();
    await userEvent.click(await screen.findByRole("radio", { name: /^Balanced/ }));
    await next();
    await screen.findByRole("group", { name: "Calorie target, estimate" });
  }

  it("should hold Save targets with the read-failed banner after a failed read, and give no skeleton", async () => {
    setupBackend.status = "error";
    await walkToEstimateWithoutSavedAnswers();

    expect(startButton().disabled).toBe(true);
    const banner = await screen.findByRole("alert");
    expect(
      within(banner).getByText(
        "Couldn't load your saved answers. Ki-Lo needs them before it can save.",
      ),
    ).toBeTruthy();
    expect(screen.queryByLabelText("Loading your answers")).toBeNull();
    expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
    await userEvent.click(startButton());
    expect(setupBackend.writes).toEqual([]);
  });

  it("should stay held with the banner after a failed retry, and turn Save targets on when a retry succeeds with no reload", async () => {
    setupBackend.status = "error";
    await walkToEstimateWithoutSavedAnswers();
    await screen.findByRole("alert");

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(setupBackend.reads).toBeGreaterThan(1);
    });
    expect(startButton().disabled).toBe(true);
    expect(await screen.findByRole("alert")).toBeTruthy();

    givenMainSample();
    setupBackend.status = "ready";
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(startButton().disabled).toBe(false);
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should save after a retry that succeeds with the stored unit kept and no duplicate weigh-in", async () => {
    // The person gave 80 kg by hand while the read was down. The stored unit is pounds and the latest weigh-in is 80 kg.
    setupBackend.status = "error";
    await walkToEstimateWithoutSavedAnswers();
    await screen.findByRole("alert");
    setupBackend.profile = { ...savedProfile, weight_unit: "lb" };
    setupBackend.program = { ...savedProgram };
    setupBackend.weighIn = { ...savedWeighIn };
    setupBackend.status = "ready";
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => {
      expect(startButton().disabled).toBe(false);
    });

    await userEvent.click(startButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/more/targets");
    });

    expect(writesOfKind("weigh-in")).toHaveLength(0);
    expect(Object.keys(writesOfKind("profile")[0]?.body ?? {})).not.toContain("weight_unit");
  });

  it("should keep the banner and turn Try again off while the retry runs", async () => {
    setupBackend.status = "error";
    await walkToEstimateWithoutSavedAnswers();
    await screen.findByRole("alert");
    setupBackend.status = "pending";

    await userEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Try again" }).getAttribute("aria-disabled")).toBe(
        "true",
      );
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(startButton().disabled).toBe(true);
    expect(screen.queryByLabelText("Loading your answers")).toBeNull();
  });

  it("should hold Start with no banner while the read is only pending", async () => {
    // Opened offline, the read waits for the connection and the steps open at once. Back online the read runs
    // and never answers: no data, and nothing has failed.
    onlineManager.setOnline(false);
    await walkToEstimateWithoutSavedAnswers();
    await screen.findByText("You're offline");
    setupBackend.status = "pending";

    act(() => {
      onlineManager.setOnline(true);
    });

    await waitFor(() => {
      expect(screen.queryByText("You're offline")).toBeNull();
    });
    expect(startButton().disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should let the offline banner win over the read-failed one", async () => {
    setupBackend.status = "error";
    await walkToEstimateWithoutSavedAnswers();
    await screen.findByRole("alert");

    act(() => {
      onlineManager.setOnline(false);
    });

    expect(await screen.findByText("You're offline")).toBeTruthy();
    expect(screen.queryByText(/Ki-Lo needs them before it can save/)).toBeNull();
  });
});

describe("the hold while a recalculation reads the programme", () => {
  it("should hold Save targets with no banner until the history has loaded, then turn it on", async () => {
    givenMainSample();
    setupBackend.holdingSnapshots = true;
    await signInSetupClient();
    renderSetupFlow(router, ESTIMATE_RECALCULATE);
    await screen.findByRole("group", { name: "Calorie target, estimate" });
    await waitFor(() => {
      expect(setupBackend.releaseSnapshots).toBeDefined();
    });

    expect(startButton().disabled).toBe(true);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("You're offline")).toBeNull();

    act(() => {
      setupBackend.releaseSnapshots?.();
    });
    await waitFor(() => {
      expect(startButton().disabled).toBe(false);
    });
  });

  it("should not hold the first run on reads it never makes, and make none of them", async () => {
    givenMainSample();
    setupBackend.holdingSnapshots = true;
    await openEstimate(ESTIMATE_FIRST_RUN);

    expect(startButton().disabled).toBe(false);
    expect(setupBackend.snapshotReads).toEqual([]);
    expect(setupBackend.weighInListReads).toBe(0);
  });

  it("should read a year of weekly check-ins, 52 weeks back from today", async () => {
    givenMainSample();
    await openEstimate();

    // 23 October 2026 less 364 days.
    expect(setupBackend.snapshotReads).toContain("gte.2025-10-24");
    expect(setupBackend.weighInListReads).toBeGreaterThan(0);
  });

  it("should draw the estimate of the answers, not a measured one, while the weight trend loads", async () => {
    givenMeasuredSample();
    setupBackend.holdingWeighIns = true;
    await signInSetupClient();
    const { queryClient } = renderSetupFlow(router, ESTIMATE_RECALCULATE);
    await screen.findByRole("group", { name: "Calorie target, estimate" });
    // The history has arrived, so only the trend is still being read.
    await waitFor(() => {
      expect(queryClient.getQueryData(keys.program.expenditureHistory(52))).toBeDefined();
    });
    await waitFor(() => {
      expect(setupBackend.releaseWeighIns).toBeDefined();
    });

    expect(screen.getByRole("heading", { level: 1, name: "Your starting targets" })).toBeTruthy();
    expect(startButton().disabled).toBe(true);

    act(() => {
      setupBackend.releaseWeighIns?.();
    });
    expect(await screen.findByText("Your new targets")).toBeTruthy();
  });
});

describe("the time zone the save is dated in", () => {
  it("should date a new weigh-in in the profile's zone, not the browser's", async () => {
    // 12:00 UTC on 23 October is 01:00 on the 24th in Auckland.
    setupBackend.profile = { ...savedProfile, timezone: "Pacific/Auckland" };
    setupBackend.program = { ...savedProgram };
    setupBackend.weighIn = { ...savedWeighIn };
    await signInSetupClient();
    renderSetupFlow(router, "/setup/body?mode=recalculate");
    const weight = await screen.findByRole<HTMLInputElement>("textbox", {
      name: "Weight in kilograms",
    });
    await userEvent.clear(weight);
    await userEvent.type(weight, "81");
    for (let step = 0; step < 6; step += 1) {
      await userEvent.click(await screen.findByRole("button", { name: "Continue" }));
    }
    await screen.findByRole("group", { name: "Calorie target, estimate" });
    await waitFor(() => {
      expect(startButton().disabled).toBe(false);
    });

    await userEvent.click(startButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });

    expect(writesOfKind("weigh-in")[0]?.body).toMatchObject({
      weight_kg: 81,
      tz: "Pacific/Auckland",
      local_date: "2026-10-24",
    });
  });
});

describe("the flourish", () => {
  it("should cut the tiles in 36 ms apart and let the final calories alone be read out", async () => {
    motion.isReduced = false;
    givenMainSample();
    await openEstimate();

    // The tiles are three terms and details in one description list, with the animation on each tile itself.
    const wrappers = within(card())
      .getAllByRole("definition")
      .map((amount) => amount.parentElement);
    expect(new Set(wrappers.map((tile) => tile?.closest("dl"))).size).toBe(1);
    expect(card().querySelectorAll("dl")).toHaveLength(1);
    expect(
      wrappers.map((wrapper) => wrapper?.className.match(/animation-delay:(\d+)ms/)?.[1]),
    ).toEqual(["160", "196", "232"]);
    for (const wrapper of wrappers) {
      expect(wrapper?.className).toContain("animate-kl-cut-in");
      expect(wrapper?.className).toContain("motion-reduce:animate-kl-fade-in");
    }
    const hidden = within(card())
      .getAllByText(/^[\d,]+$/)
      .find((figure) => figure.getAttribute("aria-hidden") === "true");
    expect(hidden?.className).toContain("animate-flash");
    expect(within(card()).getByText("1,970", { selector: ".sr-only" })).toBeTruthy();
    // The slash is the card's first child, and sits still under reduced motion.
    expect(card().firstElementChild?.className).toContain("animate-slash");
    expect(card().firstElementChild?.className).toContain("motion-reduce:animate-none");
  });

  it("should start the hidden figure below the target on the first frame, and count up to it", async () => {
    motion.isReduced = false;
    let clock = 0;
    let frames = new Map<number, FrameRequestCallback>();
    let lastFrameId = 0;
    vi.stubGlobal("requestAnimationFrame", (run: FrameRequestCallback) => {
      lastFrameId += 1;
      frames.set(lastFrameId, run);
      return lastFrameId;
    });
    vi.stubGlobal("cancelAnimationFrame", (id: number) => {
      frames.delete(id);
    });
    vi.spyOn(performance, "now").mockImplementation(() => clock);
    const hiddenFigure = () => {
      const [figure] = within(card()).getAllByText(/^[\d,]+$/, { selector: "span[aria-hidden]" });
      return Number((figure?.textContent ?? "").replaceAll(",", ""));
    };
    const frameAt = (time: number) => {
      clock = time;
      const due = [...frames.values()];
      frames = new Map();
      act(() => {
        for (const run of due) {
          run(time);
        }
      });
    };
    givenMainSample();
    await openEstimate();

    expect(hiddenFigure()).toBe(0);
    expect(within(card()).getByText("1,970", { selector: ".sr-only" })).toBeTruthy();
    frameAt(16);
    frameAt(116);
    const midway = hiddenFigure();
    expect(midway).toBeGreaterThan(0);
    expect(midway).toBeLessThan(1970);
    for (let time = 132; time <= 700; time += 16) {
      frameAt(time);
    }
    expect(hiddenFigure()).toBe(1970);
    vi.unstubAllGlobals();
  });
});
