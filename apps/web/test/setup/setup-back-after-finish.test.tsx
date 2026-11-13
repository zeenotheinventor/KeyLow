import { SAVE_FAILED_BANNER } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderSetupFlow,
  resetSetupBackend,
  savedProfile,
  savedProgram,
  savedWeighIn,
  setupBackend,
  signInSetupClient,
} from "./support";
import { renderWithRouter } from "../ui/appRouter";

import { NoProgramView } from "@/components/program/NoProgramView";
import { EstimateTargetsRow } from "@/components/targets/TargetsScreen/EstimateTargetsRow";
import { forgetRecalculationSaved, wasRecalculationSaved } from "@/lib/setupRoutes";

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

const NOT_SET_UP = { ...savedProfile, onboarding_completed_at: null };

const startButton = () =>
  screen.getByRole<HTMLButtonElement>("button", { name: /^(Start|Save targets)$/ });
// The auth client may refresh its test token, which the fake database sees as a POST. It is not a save.
const writeKinds = () =>
  setupBackend.writes
    .filter((write) => !("refresh_token" in write.body))
    .map((write) => write.kind);

/** An account with answers saved, which is what the wizard reads after a finished setup. */
function givenSetUpAccount() {
  setupBackend.profile = { ...savedProfile };
  setupBackend.program = { ...savedProgram };
  setupBackend.weighIn = { ...savedWeighIn };
}

function givenNewAccount() {
  givenSetUpAccount();
  setupBackend.profile = NOT_SET_UP;
}

/** Opens the estimate, with Start or Save targets live, and holds the page there as the real app would. */
async function pressStartOn(address: string) {
  await signInSetupClient();
  const view = renderSetupFlow(router, address);
  await screen.findByRole("group", { name: "Calorie target, estimate" });
  await waitFor(() => {
    expect(startButton().disabled).toBe(false);
  });
  router.replace.mockImplementation(() => undefined);
  await userEvent.click(startButton());
  await waitFor(() => {
    expect(router.replace).toHaveBeenCalled();
  });
  router.replace.mockClear();
  return view;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB");
  resetSetupBackend();
  window.sessionStorage.clear();
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

describe("the first run, on an account that is already set up", () => {
  it("should replace a later step with the Diary and draw nothing, as the phone does", async () => {
    givenSetUpAccount();
    await signInSetupClient();

    renderSetupFlow(router, "/setup/estimate?mode=first-run");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/diary");
    });
    expect(screen.queryByRole("group", { name: "Calorie target, estimate" })).toBeNull();
    expect(setupBackend.writes).toEqual([]);
  });

  it("should replace the first step, so I'll set my own targets is not offered", async () => {
    givenSetUpAccount();
    await signInSetupClient();

    renderSetupFlow(router, "/setup?mode=first-run");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/diary");
    });
    expect(screen.queryByRole("button", { name: "I'll set my own targets" })).toBeNull();
  });

  it("should send the browser's Back after Start to the Diary, and save nothing again", async () => {
    givenNewAccount();
    const view = await pressStartOn("/setup/estimate?mode=first-run");
    expect(writeKinds()).toEqual(["program-update", "profile", "recompute"]);

    // Back lands on an earlier step of the wizard, which is a new page.
    view.goTo("/setup/body?mode=first-run");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/diary");
    });
    expect(screen.queryByRole("heading")).toBeNull();
    expect(writeKinds()).toEqual(["program-update", "profile", "recompute"]);
  });

  it("should leave a new account's first run as it was", async () => {
    givenNewAccount();
    await signInSetupClient();

    renderSetupFlow(router, "/setup?mode=first-run");

    expect(await screen.findByRole("button", { name: "I'll set my own targets" })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should not take the page from a step already drawn when the save marks the account set up", async () => {
    givenNewAccount();
    await signInSetupClient();
    renderSetupFlow(router, "/setup?mode=first-run");
    router.replace.mockImplementation(() => undefined);
    await userEvent.click(await screen.findByRole("button", { name: "I'll set my own targets" }));
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/more/targets");
    });
    // Let the cache's new answer reach the page before looking for a second move.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(router.replace).not.toHaveBeenCalledWith("/diary");
  });
});

describe("a recalculation whose save fails", () => {
  it("should show the error, leave no mark, and let a fresh recalculation open its step", async () => {
    givenSetUpAccount();
    await signInSetupClient();
    const view = renderSetupFlow(router, "/setup/estimate?mode=recalculate");
    await screen.findByRole("group", { name: "Calorie target, estimate" });
    await waitFor(() => {
      expect(startButton().disabled).toBe(false);
    });
    router.replace.mockImplementation(() => undefined);
    setupBackend.failingWrite = true;

    await userEvent.click(startButton());

    expect(await screen.findByText(SAVE_FAILED_BANNER)).toBeTruthy();
    expect(wasRecalculationSaved()).toBe(false);
    view.goTo("/setup/body?mode=recalculate");
    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("a recalculation, after Save targets", () => {
  it("should send the browser's Back to Targets, and save nothing again", async () => {
    givenSetUpAccount();
    const view = await pressStartOn("/setup/estimate?mode=recalculate");
    expect(router.replace).not.toHaveBeenCalled();
    expect(writeKinds()).toEqual(["program-update", "profile", "recompute"]);

    view.goTo("/setup/body?mode=recalculate");

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/more/targets");
    });
    expect(screen.queryByRole("heading")).toBeNull();
    expect(writeKinds()).toEqual(["program-update", "profile", "recompute"]);
  });

  it("should open a recalculation's step as it always did when nothing was saved", async () => {
    givenSetUpAccount();
    await signInSetupClient();

    renderSetupFlow(router, "/setup/body?mode=recalculate");

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("should still save and leave when the browser keeps no storage", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("storage is off");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage is off");
    });
    givenSetUpAccount();
    await signInSetupClient();
    renderSetupFlow(router, "/setup/estimate?mode=recalculate");
    await screen.findByRole("group", { name: "Calorie target, estimate" });
    await waitFor(() => {
      expect(startButton().disabled).toBe(false);
    });

    await userEvent.click(startButton());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledWith("/more/targets");
    });
  });

  it("should open a recalculation's step when the browser keeps no storage", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage is off");
    });
    givenSetUpAccount();
    await signInSetupClient();

    renderSetupFlow(router, "/setup/body?mode=recalculate");

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});

describe("Estimate my targets, after a saved recalculation", () => {
  it("should clear the mark as it opens the wizard, so a new recalculation opens", async () => {
    givenSetUpAccount();
    await pressStartOn("/setup/estimate?mode=recalculate");
    expect(wasRecalculationSaved()).toBe(true);
    cleanup();

    const { push } = renderWithRouter(<EstimateTargetsRow />);
    await userEvent.click(screen.getByRole("link", { name: /^Estimate my targets/ }));

    expect(push.mock.calls[0]?.[0]).toBe("/setup?mode=recalculate");
    expect(wasRecalculationSaved()).toBe(false);
  });

  it("should clear the mark when the programme page's Start opens the wizard", async () => {
    givenSetUpAccount();
    await pressStartOn("/setup/estimate?mode=recalculate");
    expect(wasRecalculationSaved()).toBe(true);
    cleanup();

    const { push } = renderWithRouter(<NoProgramView ownTargetKcal={null} />);
    await userEvent.click(screen.getByRole("link", { name: "Estimate my targets" }));

    expect(push.mock.calls[0]?.[0]).toBe("/setup?mode=recalculate");
    expect(wasRecalculationSaved()).toBe(false);
  });

  it("should not stop a new recalculation from opening its first step", async () => {
    givenSetUpAccount();
    await signInSetupClient();
    window.sessionStorage.clear();
    forgetRecalculationSaved();

    renderSetupFlow(router, "/setup?mode=recalculate");

    expect(await screen.findByRole("heading", { level: 1 })).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
