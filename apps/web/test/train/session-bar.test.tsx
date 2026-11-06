import { readFileSync } from "node:fs";
import path from "node:path";

import { useSessionBarView } from "@keylow/api-client";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { freshLegsOpen, goldenLegsOpen, legsRoutine } from "./sessionGolden";
import { renderWithTrain, resetTrainBackend, trainBackend } from "./support";
import { compileUtilities } from "../ui/compileUtilities";

import { SessionBarFrame } from "@/app/(dashboard)/SessionBar";
import { SessionBarLink } from "@/app/(dashboard)/SessionBar/SessionBarLink";

const { pathname } = vi.hoisted(() => ({ pathname: vi.fn<() => string>() }));

vi.mock("next/navigation", () => ({ usePathname: () => pathname() }));

// The real hook, so the test can count how often the frame asks for the open session.
vi.mock("@keylow/api-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@keylow/api-client")>();
  return { ...actual, useSessionBarView: vi.fn(actual.useSessionBarView) };
});

// The golden Legs session was started at 18:30 on Thursday 15 October, and it is 19:00.
const THURSDAY_1900 = new Date("2026-10-15T18:00:00Z");
const BAR_NAME = "Legs in progress, 30 minutes, 8 of 16 sets. Open session";

// The session, then its routine, the routine's days and the accepted suggestions are read one after another.
const flush = async () => {
  for (let round = 0; round < 6; round += 1) {
    await act(() => vi.advanceTimersByTimeAsync(10));
  }
};

const renderShell = (page: React.ReactNode = <main>Page content</main>) =>
  renderWithTrain(<SessionBarFrame>{page}</SessionBarFrame>);

describe("the session bar link", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(THURSDAY_1900);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const renderLink = (overrides: Partial<React.ComponentProps<typeof SessionBarLink>> = {}) =>
    renderWithTrain(
      <SessionBarLink
        dayName="Legs"
        startedAt="2026-10-15T18:30:00+01:00"
        setsLogged={8}
        setsPlanned={16}
        {...overrides}
      />,
    );

  it("should open the session, named by its day, whole minutes and sets", () => {
    renderLink();

    const link = screen.getByRole("link", { name: BAR_NAME });
    expect(link.getAttribute("href")).toBe("/train/session");
    expect(link.textContent).toBe("Legs30:00 · 8 of 16 sets");
  });

  it("should read Session and the sets alone for a free session", () => {
    renderLink({ dayName: null, setsLogged: 8, setsPlanned: 0 });

    const link = screen.getByRole("link", {
      name: "Session in progress, 30 minutes, 8 sets. Open session",
    });
    expect(link.textContent).toBe("Session30:00 · 8 sets");
  });

  it("should tick once a second while its name changes only by the minute", () => {
    renderLink();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    const link = screen.getByRole("link", { name: BAR_NAME });
    expect(link.textContent).toBe("Legs30:05 · 8 of 16 sets");
  });

  it("should never read a negative clock, even when the device clock is behind the start", () => {
    renderLink({ startedAt: "2026-10-15T19:30:00+01:00" });

    expect(screen.getByRole("link").textContent).toBe("Legs00:00 · 8 of 16 sets");
  });

  it("should draw as the board does: the large control height and the sides of the top bar", async () => {
    renderLink();
    const css = await compileUtilities(screen.getByRole("link").getAttribute("class") ?? "");

    expect(css).toContain("height: 52px");
    expect(css).toContain("padding-left: 16px");
    expect(css).toContain("padding-left: 32px");
  });
});

describe("the session bar in the shell", () => {
  beforeEach(() => {
    resetTrainBackend();
    pathname.mockReturnValue("/dashboard");
    vi.useFakeTimers();
    vi.setSystemTime(THURSDAY_1900);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    onlineManager.setOnline(true);
  });

  const openGoldenLegs = () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = goldenLegsOpen();
  };

  it("should show no bar when no session is open, once the read has answered", async () => {
    renderShell();
    await flush();

    expect(screen.queryByRole("link", { name: /in progress/ })).toBeNull();
    expect(screen.getByRole("main").textContent).toBe("Page content");
  });

  it("should show no bar while the first read is pending", async () => {
    openGoldenLegs();
    trainBackend.hangingReads.add("active_session");

    renderShell();
    await flush();

    expect(screen.queryByRole("link", { name: /in progress/ })).toBeNull();
  });

  it("should show the bar before the page, once an open session is read", async () => {
    openGoldenLegs();

    renderShell();
    await flush();

    const link = screen.getByRole("link", { name: BAR_NAME });
    expect(link.compareDocumentPosition(screen.getByRole("main"))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it("should show the sets alone while the day's plan has not been read", async () => {
    openGoldenLegs();
    trainBackend.hangingReads.add("routines");

    renderShell();
    await flush();

    expect(
      screen.getByRole("link", { name: "Legs in progress, 30 minutes, 8 sets. Open session" }),
    ).toBeTruthy();
  });

  it("should show no bar on the session page", async () => {
    openGoldenLegs();
    pathname.mockReturnValue("/train/session");

    renderShell();
    await flush();

    expect(screen.queryByRole("link", { name: /in progress/ })).toBeNull();
    expect(screen.getByRole("main").textContent).toBe("Page content");
  });

  it("should take the bar away when the session is finished", async () => {
    openGoldenLegs();
    const { queryClient } = renderShell();
    await flush();
    expect(screen.getByRole("link", { name: BAR_NAME })).toBeTruthy();

    trainBackend.activeSession = null;
    await act(() => queryClient.invalidateQueries());
    await flush();

    expect(screen.queryByRole("link", { name: /in progress/ })).toBeNull();
  });

  it("should keep counting from the start with no connection", async () => {
    trainBackend.routine = legsRoutine;
    trainBackend.activeSession = freshLegsOpen("2026-10-15T18:59:00+01:00");
    renderShell();
    await flush();

    act(() => {
      onlineManager.setOnline(false);
      vi.advanceTimersByTime(65_000);
    });

    expect(screen.getByRole("link").textContent).toBe("Legs02:05 · 0 of 16 sets");
  });

  it("should ask for the open session when the page loads, and not again as the clock ticks", async () => {
    openGoldenLegs();
    renderShell();
    await flush();
    const callsAfterLoad = vi.mocked(useSessionBarView).mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByRole("link").textContent).toBe("Legs30:05 · 8 of 16 sets");
    expect(vi.mocked(useSessionBarView)).toHaveBeenCalledTimes(callsAfterLoad);
  });

  describe("the landmark the bar sits in", () => {
    const landmark = () => screen.getByRole("complementary", { name: "In progress" });

    it("should hold the bar in a landmark named apart from the Main navigation", async () => {
      openGoldenLegs();
      renderShell();
      await flush();

      expect(within(landmark()).getByRole("link", { name: BAR_NAME })).toBeTruthy();
    });

    it("should make the landmark, not the link, hold the top of the window under the menu panel", async () => {
      openGoldenLegs();
      renderShell();
      await flush();
      const css = await compileUtilities(landmark().getAttribute("class") ?? "");

      expect(css).toContain("position: sticky");
      expect(css).toContain("top: 0px");
      expect(css).toContain("z-index: 5");
    });

    it("should mark the page for the scroll padding only while the bar shows", async () => {
      renderShell();
      await flush();
      expect(document.querySelector("[data-session-bar]")).toBeNull();
      cleanup();

      openGoldenLegs();
      renderShell();
      await flush();
      expect(landmark().hasAttribute("data-session-bar")).toBe(true);
    });

    it("should pad the scroll of the window by the bar's height while the marker is there", () => {
      // jsdom does not compute :has(), so the pairing is pinned in the source: this rule and the marker above.
      const css = readFileSync(path.join(process.cwd(), "app/globals.css"), "utf8");

      expect(css).toMatch(
        /html:has\(\[data-session-bar\]\)\s*\{\s*scroll-padding-top:\s*theme\(height\.control-lg\);/,
      );
    });
  });

  describe("the room the bar takes at the top of the window", () => {
    const offsetOf = async () => {
      const css = await compileUtilities(
        screen.getByRole("main").parentElement?.getAttribute("class") ?? "",
      );
      return css;
    };

    it("should set --session-bar-offset to the bar's height on the element around the page while it shows", async () => {
      openGoldenLegs();
      renderShell();
      await flush();

      expect(await offsetOf()).toContain("--session-bar-offset: 52px");
    });

    it("should leave --session-bar-offset unset with no bar, so the fallback keeps the old place", async () => {
      renderShell();
      await flush();

      expect(await offsetOf()).not.toContain("--session-bar-offset");
    });
  });
});
