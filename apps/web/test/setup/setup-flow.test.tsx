import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor, within } from "@testing-library/react";
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
const reducerStep = () => screen.getByRole("status", { name: "Reducer step" }).textContent;
const tryAgain = () => screen.getByRole("button", { name: "Try again" });

beforeEach(() => {
  // Only the date is faked, so the read and the timers of the page run as they do.
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

describe("the first step", () => {
  it("should ask the sex, with the caption, the bar and Continue waiting for an answer", async () => {
    renderSetupFlow(router);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What is your sex?" }),
    ).toBeTruthy();
    expect(screen.getByText("About you · Step 1 of 8")).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Step 1 of 8" });
    expect(bar.getAttribute("aria-valuenow")).toBe("11");
    expect((await continueButton()).disabled).toBe(true);
    for (const card of screen.getAllByRole("radio")) {
      expect(isChecked(card)).toBe(false);
    }
  });

  it("should move focus to the question", async () => {
    renderSetupFlow(router);

    const title = await screen.findByRole("heading", { level: 1 });

    expect(document.activeElement).toBe(title);
  });

  it("should fill the bar from core's fraction, as a custom property a class reads", async () => {
    renderSetupFlow(router);

    const fill = (await screen.findByRole("progressbar")).firstElementChild;

    expect(fill?.getAttribute("style")).toContain("--progress: 11.1");
    expect(fill?.className).toContain("w-[var(--progress)]");
  });

  it("should have neither Back nor Close on the first run, whose escape is not here yet", async () => {
    renderSetupFlow(router);
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });

  it("should open the birth date with the mode on the address once a sex is chosen", async () => {
    renderSetupFlow(router);

    await userEvent.click(await screen.findByRole("radio", { name: /^Prefer not to say/ }));
    await userEvent.click(await continueButton());

    expect(router.push).toHaveBeenCalledWith("/setup/birth-date?mode=first-run");
    expect(
      await screen.findByRole("heading", { level: 1, name: "When were you born?" }),
    ).toBeTruthy();
    expect(screen.getByText("About you · Step 2 of 8")).toBeTruthy();
    expect(reducerStep()).toBe("birthDate");
  });
});

describe("About you, the golden sample", () => {
  async function walkToBirthDate() {
    const view = renderSetupFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: "Male" }));
    await userEvent.click(await continueButton());
    await screen.findByRole("heading", { level: 1, name: "When were you born?" });
    return view;
  }

  async function typeBirthDate(day: string, month: string, year: string) {
    await userEvent.type(screen.getByRole("textbox", { name: "Day of birth" }), day);
    await userEvent.type(screen.getByRole("textbox", { name: "Month of birth" }), month);
    await userEvent.type(screen.getByRole("textbox", { name: "Year of birth" }), year);
  }

  it("should say 'You are 35.' for 14 March 1991 on 23 October 2026", async () => {
    await walkToBirthDate();
    await typeBirthDate("14", "03", "1991");

    expect(screen.getByText("You are 35.")).toBeTruthy();
    expect((await continueButton()).disabled).toBe(false);
  });

  it("should take 180 cm and 80.0 kg and open the activity step", async () => {
    await walkToBirthDate();
    await typeBirthDate("14", "03", "1991");
    await userEvent.click(await continueButton());
    expect(router.push).toHaveBeenLastCalledWith("/setup/body?mode=first-run");

    await userEvent.type(
      await screen.findByRole("textbox", { name: "Height in centimetres" }),
      "180",
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Weight in kilograms" }), "80.0");
    await userEvent.click(await continueButton());

    expect(router.push).toHaveBeenLastCalledWith("/setup/activity?mode=first-run");
  });

  it("should refuse under 13 with the line, Continue off and the three fields invalid", async () => {
    await walkToBirthDate();
    await typeBirthDate("02", "06", "2015");

    expect((await screen.findByRole("alert")).textContent).toBe(
      "You need to be 13 or over to use Ki-Lo.",
    );
    expect((await continueButton()).disabled).toBe(true);
    for (const name of ["Day of birth", "Month of birth", "Year of birth"]) {
      expect(screen.getByRole("textbox", { name }).getAttribute("aria-invalid")).toBe("true");
    }
  });

  it("should refuse a date in the future", async () => {
    await walkToBirthDate();
    await typeBirthDate("24", "10", "2026");

    expect((await screen.findByRole("alert")).textContent).toBe("Enter a date before today.");
    expect((await continueButton()).disabled).toBe(true);
  });

  it("should refuse a height and a weight outside the bounds in core's words", async () => {
    await walkToBirthDate();
    await typeBirthDate("14", "03", "1991");
    await userEvent.click(await continueButton());
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Height in centimetres" }),
      "18",
    );
    await userEvent.type(screen.getByRole("textbox", { name: "Weight in kilograms" }), "4");
    await userEvent.tab();

    const alerts = (await screen.findAllByRole("alert")).map((alert) => alert.textContent);
    expect(alerts).toEqual([
      "Enter a height between 100 and 250 cm.",
      "Enter a weight between 20 and 400 kg.",
    ]);
    expect((await continueButton()).disabled).toBe(true);
  });
});

describe("pounds, feet and inches", () => {
  it("should follow the unit chosen, and keep the answer whole through a switch", async () => {
    setupBackend.profile = { ...savedProfile };
    setupBackend.weighIn = { ...savedWeighIn };
    renderSetupFlow(router, "/setup/body?mode=recalculate");

    await waitFor(() => {
      expect(
        screen.getByRole<HTMLInputElement>("textbox", { name: "Height in centimetres" }).value,
      ).toBe("180");
    });
    await userEvent.click(screen.getByRole("radio", { name: "lb, ft, in" }));

    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Height, feet" }).value).toBe("5");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Height, inches" }).value).toBe(
      "11",
    );
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Weight in pounds" }).value).toBe(
      "176.4",
    );
  });

  it("should say where a prefilled weight came from, until the weight changes", async () => {
    setupBackend.profile = { ...savedProfile };
    setupBackend.weighIn = { ...savedWeighIn };
    renderSetupFlow(router, "/setup/body?mode=recalculate");

    expect(await screen.findByText("From your weigh-in on 21 Oct")).toBeTruthy();
    await userEvent.type(screen.getByRole("textbox", { name: "Weight in kilograms" }), "1");

    expect(screen.queryByText("From your weigh-in on 21 Oct")).toBeNull();
  });
});

describe("Back", () => {
  it("should go to the previous step's address and keep the answers", async () => {
    renderSetupFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: "Female" }));
    await userEvent.click(await continueButton());
    await screen.findByRole("heading", { level: 1, name: "When were you born?" });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.push).toHaveBeenLastCalledWith("/setup?mode=first-run");
    expect(isChecked(await screen.findByRole("radio", { name: "Female" }))).toBe(true);
  });

  it("should keep the mode on Back, and Close, in a recalculation", async () => {
    setupBackend.profile = { ...savedProfile };
    renderSetupFlow(router, "/setup/birth-date?mode=recalculate");
    await waitFor(() => {
      expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Year of birth" }).value).toBe(
        "1991",
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Back" }));

    expect(router.push).toHaveBeenLastCalledWith("/setup?mode=recalculate");
    expect(await screen.findByRole("button", { name: "Close" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  });

  it("should tell the reducer the step when the browser's Back changes the address", async () => {
    const { goTo } = renderSetupFlow(router);
    await userEvent.click(await screen.findByRole("radio", { name: "Female" }));
    await userEvent.click(await continueButton());
    await screen.findByRole("heading", { level: 1, name: "When were you born?" });
    expect(reducerStep()).toBe("birthDate");

    act(() => {
      goTo("/setup?mode=first-run");
    });

    await waitFor(() => {
      expect(reducerStep()).toBe("sex");
    });
    expect(isChecked(screen.getByRole("radio", { name: "Female" }))).toBe(true);
  });
});

describe("mode", () => {
  it("should show Close on a recalculation, and leave for Targets at once with no dialog", async () => {
    setupBackend.profile = { ...savedProfile };
    renderSetupFlow(router, "/setup?mode=recalculate");

    await userEvent.click(await screen.findByRole("button", { name: "Close" }));

    expect(router.replace).toHaveBeenCalledWith("/more/targets");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("should carry the mode on the next address", async () => {
    setupBackend.profile = { ...savedProfile };
    renderSetupFlow(router, "/setup?mode=recalculate");
    await waitFor(() => {
      expect(isChecked(screen.getByRole("radio", { name: "Male" }))).toBe(true);
    });

    await userEvent.click(await continueButton());

    expect(router.push).toHaveBeenCalledWith("/setup/birth-date?mode=recalculate");
  });

  it("should open a recalculation for a mistyped mode, which has Close", async () => {
    renderSetupFlow(router, "/setup?mode=nonsense");

    expect(await screen.findByRole("button", { name: "Close" })).toBeTruthy();
  });
});

describe("an address that is not ready", () => {
  it("should send /setup/body with nothing answered to /setup, keeping the mode", async () => {
    renderSetupFlow(router, "/setup/body?mode=first-run");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/setup?mode=first-run");
    });
    expect(
      await screen.findByRole("heading", { level: 1, name: "What is your sex?" }),
    ).toBeTruthy();
  });

  it("should stop the estimate on an empty draft", async () => {
    renderSetupFlow(router, "/setup/estimate?mode=first-run");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/setup?mode=first-run");
    });
  });

  it("should not tell the reducer of a step it has stopped", async () => {
    renderSetupFlow(router, "/setup/protein?mode=first-run");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalled();
    });
    expect(reducerStep()).not.toBe("protein");
  });

  it("should send a name that is not a step to the first step", async () => {
    renderSetupFlow(router, "/setup/2?mode=first-run");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/setup?mode=first-run");
    });
  });

  it("should not bounce a recalculation while its saved answers are still arriving", async () => {
    setupBackend.profile = { ...savedProfile };
    setupBackend.weighIn = { ...savedWeighIn };
    renderSetupFlow(router, "/setup/body?mode=recalculate");

    expect(
      (await screen.findByRole<HTMLInputElement>("textbox", { name: "Weight in kilograms" })).value,
    ).toBe("80.0");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should bounce a deep address once the read has failed and left nothing answered", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup/body?mode=recalculate");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/setup?mode=recalculate");
    });
  });

  it("should bounce a deep address when the browser is offline and nothing is cached", async () => {
    onlineManager.setOnline(false);
    renderSetupFlow(router, "/setup/body?mode=recalculate");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/setup?mode=recalculate");
    });
  });
});

describe("reading the saved answers", () => {
  it("should draw the skeleton, named as loading, while the first request runs", async () => {
    setupBackend.status = "pending";
    renderSetupFlow(router);

    expect(await screen.findByRole("status", { name: "Loading your answers" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("should open the step at once for a read that is paused offline, with no skeleton", async () => {
    onlineManager.setOnline(false);
    renderSetupFlow(router);

    expect(
      await screen.findByRole("heading", { level: 1, name: "What is your sex?" }),
    ).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading your answers" })).toBeNull();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should fill the saved answers in under the step", async () => {
    setupBackend.profile = { ...savedProfile };
    renderSetupFlow(router, "/setup?mode=recalculate");

    await waitFor(() => {
      expect(isChecked(screen.getByRole("radio", { name: "Male" }))).toBe(true);
    });
  });

  it("should keep what was typed when the saved answers arrive late", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");
    await userEvent.click(await screen.findByRole("radio", { name: "Female" }));

    setupBackend.status = "ready";
    setupBackend.profile = { ...savedProfile };
    await userEvent.click(tryAgain());

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(isChecked(screen.getByRole("radio", { name: "Female" }))).toBe(true);
  });
});

describe("a read that fails and then succeeds", () => {
  it("should keep a half-typed birth date on the page when the retry's answers arrive", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");
    await userEvent.click(await screen.findByRole("radio", { name: "Male" }));
    await userEvent.click(await continueButton());
    await userEvent.type(await screen.findByRole("textbox", { name: "Day of birth" }), "1");
    await userEvent.type(screen.getByRole("textbox", { name: "Month of birth" }), "0");
    setupBackend.status = "ready";
    setupBackend.profile = { ...savedProfile };

    await userEvent.click(tryAgain());

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Day of birth" }).value).toBe("1");
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Month of birth" }).value).toBe(
      "0",
    );
  });
});

describe("the end of the built steps", () => {
  it("should keep Continue off on the last question, since the estimate is not built yet", async () => {
    setupBackend.profile = { ...savedProfile };
    setupBackend.program = {
      id: "33333333-3333-4333-8333-333333333333",
      goal: "lose",
      rate_pct_per_week: 0.5,
      protein_g_per_kg: 1.6,
      fat_fraction_of_remaining: 0.3,
      split_preset: "balanced",
    };
    setupBackend.weighIn = { ...savedWeighIn };
    renderSetupFlow(router, "/setup/diet?mode=recalculate");

    expect(
      await screen.findByRole("heading", { level: 1, name: "How do you like to eat?" }),
    ).toBeTruthy();
    await waitFor(() => {
      expect(router.replace).not.toHaveBeenCalled();
    });
    expect((await continueButton()).disabled).toBe(true);
  });
});

describe("a read that failed", () => {
  it("should keep the step usable, with the banner and Try again, and no skeleton", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");

    const banner = await screen.findByRole("alert");
    expect(banner.textContent).toContain(
      "Couldn't load your saved answers. You can still answer here.",
    );
    expect(within(banner).getByRole("button", { name: "Try again" })).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "What is your sex?" })).toBeTruthy();
    await userEvent.click(screen.getByRole("radio", { name: "Male" }));
    expect((await continueButton()).disabled).toBe(false);
    expect(screen.queryByRole("status", { name: "Loading your answers" })).toBeNull();
  });

  it("should dim Try again and keep the banner and the step while the retry runs", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");
    await screen.findByRole("alert");
    setupBackend.status = "pending";

    await userEvent.click(tryAgain());

    await waitFor(() => {
      expect(tryAgain().getAttribute("aria-disabled")).toBe("true");
    });
    expect(screen.getByRole("alert")).toBeTruthy();
    expect(screen.getByRole("heading", { level: 1, name: "What is your sex?" })).toBeTruthy();
    expect(screen.queryByRole("status", { name: "Loading your answers" })).toBeNull();
  });

  it("should not start a second read on a press while the retry runs", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");
    await screen.findByRole("alert");
    setupBackend.status = "pending";
    await userEvent.click(tryAgain());
    await waitFor(() => {
      expect(tryAgain().getAttribute("aria-disabled")).toBe("true");
    });
    const readsDuringRetry = setupBackend.reads;

    await userEvent.click(tryAgain());

    expect(setupBackend.reads).toBe(readsDuringRetry);
  });

  it("should make Try again live again when the retry also fails, with the step still on the page", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");
    await screen.findByRole("alert");

    await userEvent.click(tryAgain());

    await waitFor(() => {
      expect(setupBackend.reads).toBe(2);
    });
    await waitFor(() => {
      expect(tryAgain().hasAttribute("aria-disabled")).toBe(false);
    });
    expect(screen.queryByRole("status", { name: "Loading your answers" })).toBeNull();
    expect(screen.getByRole("heading", { level: 1, name: "What is your sex?" })).toBeTruthy();
  });

  it("should take the banner away and fill the answers in when the retry succeeds", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");
    await screen.findByRole("alert");
    setupBackend.status = "ready";
    setupBackend.profile = { ...savedProfile };

    await userEvent.click(tryAgain());

    await waitFor(() => {
      expect(screen.queryByRole("alert")).toBeNull();
    });
    expect(isChecked(screen.getByRole("radio", { name: "Male" }))).toBe(true);
  });

  it("should show no banner for a read that is merely pending", async () => {
    setupBackend.status = "pending";
    renderSetupFlow(router);
    await screen.findByRole("status", { name: "Loading your answers" });

    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("should carry the banner on a later step too", async () => {
    setupBackend.status = "error";
    renderSetupFlow(router, "/setup?mode=recalculate");
    await userEvent.click(await screen.findByRole("radio", { name: "Male" }));
    await userEvent.click(await continueButton());
    await screen.findByRole("heading", { level: 1, name: "When were you born?" });

    expect(screen.getByRole("alert").textContent).toContain("Couldn't load your saved answers.");
  });
});

describe("the units the body step starts in", () => {
  it("should start in pounds, feet and inches for a US browser with nothing stored", async () => {
    vi.spyOn(navigator, "language", "get").mockReturnValue("en-US");
    renderSetupFlow(router, "/setup?mode=first-run");
    await userEvent.click(await screen.findByRole("radio", { name: "Male" }));
    await userEvent.click(await continueButton());
    await userEvent.type(screen.getByRole("textbox", { name: "Day of birth" }), "14");
    await userEvent.type(screen.getByRole("textbox", { name: "Month of birth" }), "03");
    await userEvent.type(screen.getByRole("textbox", { name: "Year of birth" }), "1991");
    await userEvent.click(await continueButton());

    expect(await screen.findByRole("textbox", { name: "Height, feet" })).toBeTruthy();
    expect(screen.getByRole("textbox", { name: "Weight in pounds" })).toBeTruthy();
  });
});
