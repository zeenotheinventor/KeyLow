import { keys } from "@keylow/api-client";
import { SAVE_FAILED_BANNER, SETUP_SHELL } from "@keylow/core/copy";
import { act, cleanup, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  renderSetupFlow,
  resetSetupBackend,
  savedProfile,
  setupBackend,
  signInSetupClient,
} from "./support";

const router = vi.hoisted(() => ({
  push: vi.fn<(href: string) => void>(),
  replace: vi.fn<(href: string) => void>(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
}));

const NOT_SET_UP = { ...savedProfile, onboarding_completed_at: null };
const escapeButton = () => screen.findByRole("button", { name: SETUP_SHELL.setOwnTargetsLabel });
// The harness follows a replace to the address it is given, so the page is held where it is drawn.
function renderAt(address: string) {
  const rendered = renderSetupFlow(router, address);
  router.replace.mockImplementation(() => undefined);
  return rendered;
}
const profileWrites = () => setupBackend.writes.filter((write) => write.kind === "profile");

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-23T12:00:00Z"));
  vi.spyOn(navigator, "language", "get").mockReturnValue("en-GB");
  resetSetupBackend();
  await signInSetupClient();
  setupBackend.profile = NOT_SET_UP;
  router.push.mockReset();
  router.replace.mockReset();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("I'll set my own targets", () => {
  it("should be on the first run's first step, as a button left of Continue", async () => {
    renderAt("/setup?mode=first-run");

    const escape = await escapeButton();
    const continueButton = screen.getByRole("button", { name: "Continue" });

    expect(
      escape.compareDocumentPosition(continueButton) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("should not be on a recalculation's first step", async () => {
    renderAt("/setup?mode=recalculate");
    await screen.findByRole("heading", { level: 1 });

    expect(screen.queryByRole("button", { name: SETUP_SHELL.setOwnTargetsLabel })).toBeNull();
  });

  it("should not be on a later step of the first run, which has Back", async () => {
    renderAt("/setup?mode=first-run");
    await userEvent.click(await screen.findByRole("radio", { name: /^Prefer not to say/ }));
    await userEvent.click(await screen.findByRole("button", { name: "Continue" }));

    await screen.findByRole("button", { name: "Back" });

    expect(screen.queryByRole("button", { name: SETUP_SHELL.setOwnTargetsLabel })).toBeNull();
  });

  it("should mark the account set up with that column only, then open Targets", async () => {
    const { queryClient } = renderAt("/setup?mode=first-run");
    const escape = await escapeButton();
    // The read that follows the write never answers, so what the cache says is what the write left there.
    setupBackend.status = "pending";

    await userEvent.click(escape);

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledExactlyOnceWith("/more/targets");
    });
    expect(profileWrites().map((write) => Object.keys(write.body))).toEqual([
      ["onboarding_completed_at"],
    ]);
    expect(setupBackend.writes).toHaveLength(1);
    expect(queryClient.getQueryData(keys.profiles.setupState)).toMatchObject({ isSetUp: true });
  });

  it("should stay busy while the write runs, and write once for a double press", async () => {
    setupBackend.holdingWrite = true;
    renderAt("/setup?mode=first-run");
    const escape = await escapeButton();

    await userEvent.click(escape);
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });
    await userEvent.click(escape);

    expect(escape.getAttribute("aria-busy")).toBe("true");
    expect(escape.hasAttribute("disabled")).toBe(true);
    expect(screen.getByRole("button", { name: "Continue" }).hasAttribute("disabled")).toBe(true);
    expect(setupBackend.writes).toHaveLength(1);
    setupBackend.releaseWrite?.();
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledOnce();
    });
  });

  it("should show the save failed line above the buttons when the write fails, and stay on the page", async () => {
    setupBackend.failingWrite = true;
    setupBackend.holdingWrite = true;
    renderAt("/setup?mode=first-run");

    await userEvent.click(await escapeButton());
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });
    // The pressed button was turned off, so focus has gone elsewhere by the time the write fails.
    act(() => {
      screen.getByRole("heading", { level: 1 }).focus();
    });
    setupBackend.releaseWrite?.();

    const banner = await screen.findByText(SAVE_FAILED_BANNER);
    const escape = await escapeButton();
    expect(banner.compareDocumentPosition(escape) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(router.replace).not.toHaveBeenCalled();
    expect(escape.hasAttribute("disabled")).toBe(false);
    await waitFor(() => {
      expect(document.activeElement).toBe(escape);
    });
  });

  it("should retry on the next press and leave when it works", async () => {
    setupBackend.failingWrite = true;
    renderAt("/setup?mode=first-run");
    await userEvent.click(await escapeButton());
    await screen.findByText(SAVE_FAILED_BANNER);
    setupBackend.failingWrite = false;

    await userEvent.click(await escapeButton());

    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledExactlyOnceWith("/more/targets");
    });
    expect(profileWrites()).toHaveLength(2);
    expect(screen.queryByText(SAVE_FAILED_BANNER)).toBeNull();
  });

  it("should not read the programme or the targets, which the escape does not change", async () => {
    const { queryClient } = renderAt("/setup?mode=first-run");

    await userEvent.click(await escapeButton());
    await waitFor(() => {
      expect(router.replace).toHaveBeenCalledOnce();
    });

    expect(queryClient.getQueryState(keys.profiles.targets)).toBeUndefined();
    expect(queryClient.getQueryState(keys.program.summary)).toBeUndefined();
  });

  it("should not open Targets for a page that has gone while the write ran", async () => {
    setupBackend.holdingWrite = true;
    const { leave } = renderAt("/setup?mode=first-run");
    await userEvent.click(await escapeButton());
    await waitFor(() => {
      expect(setupBackend.writes).toHaveLength(1);
    });

    leave();
    await act(async () => {
      setupBackend.releaseWrite?.();
      await Promise.resolve();
    });

    expect(router.replace).not.toHaveBeenCalled();
  });
});
