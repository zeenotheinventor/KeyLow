import { keys } from "@keylow/api-client";
import { WEIGHT_EMPTY, WEIGHT_ERROR, WEIGHT_SCREEN } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  LEAKY_DATABASE_MESSAGE,
  createWeightQueryClient,
  renderWithWeight,
  resetWeightBackend,
  weighInRow,
  weightBackend,
} from "./support";

import { WeightScreen } from "@/components/weight";

// Saturday 17 October 2026, 12:00 UTC.
const NOW = new Date("2026-10-17T12:00:00Z");
const NOTE = "after the long run, felt heavy";

// A fortnight of readings that settle around 82 kg, with one far from the rest on the 14th, which the trend
// leaves out. The three newest are the board's own: typed, imported and typed.
function fortnight() {
  const earlier = [82.3, 82.0, 82.1, 81.7, 82.4, 82.2, 82.5, 82.6, 82.4, 82.3].map(
    (weightKg, index) =>
      weighInRow({
        localDate: `2026-10-${String(13 - index).padStart(2, "0")}`,
        utcTime: "07:45",
        weightKg,
      }),
  );

  return [
    weighInRow({ localDate: "2026-10-17", utcTime: "07:10", weightKg: 81.4 }),
    weighInRow({
      localDate: "2026-10-16",
      utcTime: "08:17",
      weightKg: 81.8,
      source: "health_connect",
    }),
    weighInRow({ localDate: "2026-10-15", utcTime: "07:24", weightKg: 81.8 }),
    weighInRow({ localDate: "2026-10-14", utcTime: "08:31", weightKg: 96.4, note: NOTE }),
    ...earlier,
  ];
}

function renderScreen(queryClient = createWeightQueryClient()) {
  return renderWithWeight(<WeightScreen />, queryClient);
}

const weighInList = () => screen.findByRole("region", { name: "Weigh-ins" });
const rowOf = (list: HTMLElement, day: string) => {
  const row = within(list)
    .getAllByRole("listitem")
    .find((item) => item.textContent.startsWith(day));
  if (row === undefined) {
    throw new Error(`The list has no row for ${day}`);
  }
  return row;
};

describe("WeightScreen", () => {
  beforeEach(() => {
    resetWeightBackend();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
    vi.useRealTimers();
  });

  describe("its header, in every state", () => {
    beforeEach(() => {
      weightBackend.weighInReadsHang = true;
    });

    it("should be headed Weight, under a way back to More", () => {
      renderScreen();

      expect(screen.getByRole("heading", { level: 1, name: WEIGHT_SCREEN.title })).toBeTruthy();
      expect(screen.getByRole("link", { name: WEIGHT_SCREEN.backLabel }).getAttribute("href")).toBe(
        "/more",
      );
    });

    it("should draw no control that does nothing, since the dialog and the explainer are not built", () => {
      renderScreen();

      expect(screen.queryAllByRole("button")).toEqual([]);
    });
  });

  describe("while the weigh-ins load", () => {
    it("should be a status region named Loading your weigh-ins, with no list", () => {
      weightBackend.weighInReadsHang = true;
      renderScreen();

      expect(screen.getByRole("status", { name: WEIGHT_SCREEN.loadingLabel })).toBeTruthy();
      expect(screen.queryByRole("region", { name: "Weigh-ins" })).toBeNull();
    });
  });

  describe("when the read fails", () => {
    it("should say it could not load, with Try again, and nothing from the database", async () => {
      weightBackend.weighInReadsFail = true;
      renderScreen();

      const alert = await screen.findByRole("alert");

      expect(
        within(alert).getByRole("heading", { level: 2, name: WEIGHT_ERROR.title }),
      ).toBeTruthy();
      expect(alert.textContent).toContain(WEIGHT_ERROR.body);
      expect(document.body.textContent).not.toContain("81.6");
    });

    it("should read again when Try again is pressed, and show the list when that works", async () => {
      weightBackend.weighInReadsFail = true;
      renderScreen();
      fireEvent.click(await screen.findByRole("button", { name: WEIGHT_ERROR.retry }));
      await waitFor(() => {
        expect(weightBackend.weighInRequestCount).toBe(2);
      });
      weightBackend.weighInReadsFail = false;
      weightBackend.weighIns = fortnight();

      fireEvent.click(await screen.findByRole("button", { name: WEIGHT_ERROR.retry }));

      expect(await weighInList()).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should keep the list when a later read fails", async () => {
      weightBackend.weighIns = fortnight();
      const queryClient = createWeightQueryClient();
      renderScreen(queryClient);
      await weighInList();

      weightBackend.weighInReadsFail = true;
      await act(async () => {
        await queryClient.invalidateQueries();
      });
      // The failed read has been made and its answer has reached the screen.
      expect(weightBackend.weighInRequestCount).toBe(2);
      expect(queryClient.getQueryState(keys.weighIns.list)?.status).toBe("error");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });

      expect(screen.getByRole("region", { name: "Weigh-ins" })).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });
  });

  describe("with no weigh-ins", () => {
    it("should say there are none, in the web's own words, with no Health Connect in them", async () => {
      renderScreen();

      expect(
        await screen.findByRole("heading", { level: 2, name: WEIGHT_EMPTY.title }),
      ).toBeTruthy();
      expect(screen.getByText(WEIGHT_EMPTY.bodyWeb)).toBeTruthy();
      expect(document.body.textContent).not.toContain("Health Connect");
    });

    it("should offer no Add weigh-in until a handler is given, so no button is dead", async () => {
      renderScreen();
      await screen.findByRole("heading", { level: 2, name: WEIGHT_EMPTY.title });

      expect(screen.queryAllByRole("button")).toEqual([]);
    });
  });

  describe("with weigh-ins", () => {
    beforeEach(() => {
      weightBackend.weighIns = fortnight();
    });

    it("should list them newest first under a Weigh-ins heading", async () => {
      renderScreen();

      const list = await weighInList();
      const rows = within(list).getAllByRole("listitem");

      expect(rows).toHaveLength(14);
      expect(rows.slice(0, 5).map((row) => row.textContent)).toEqual([
        "Today07:10 · Added by you81.4kg",
        "Yesterday08:17 · Health Connect81.8kg",
        "Thu 15 Oct07:24 · Added by you81.8kg",
        "Wed 14 Oct08:31 · Added by youLeft out of trend96.4kg",
        "Tue 13 Oct07:45 · Added by you82.3kg",
      ]);
    });

    it("should mark only the reading the trend left out, with the badge, and leave its note out", async () => {
      renderScreen();

      const list = await weighInList();

      expect(within(list).getAllByText(WEIGHT_SCREEN.leftOutBadge)).toHaveLength(1);
      expect(within(rowOf(list, "Wed 14 Oct")).getByText(WEIGHT_SCREEN.leftOutBadge)).toBeTruthy();
      expect(document.body.textContent).not.toContain(NOTE);
    });

    it("should draw a normal figure strong and the left-out figure muted, each with its kg", async () => {
      renderScreen();

      const list = await weighInList();
      const normal = within(rowOf(list, "Today")).getByText("81.4");
      const leftOut = within(rowOf(list, "Wed 14 Oct")).getByText("96.4");

      expect(normal.className).toContain("text-body-strong");
      expect(normal.className).toContain("text-text-primary");
      expect(leftOut.className).toContain("text-body-strong");
      expect(leftOut.className).toContain("text-text-muted");
      expect(leftOut.className).not.toContain("text-text-primary");
      expect(within(rowOf(list, "Wed 14 Oct")).getByText("kg")).toBeTruthy();
    });

    it("should draw the heart on an imported row and the pencil on a typed one, both decorative", async () => {
      renderScreen();

      const list = await weighInList();
      // The icons are decorative, so they have no role or name to find them by. Their drawing is the check.
      const imported = rowOf(list, "Yesterday").querySelector("svg");
      const typed = rowOf(list, "Today").querySelector("svg");

      expect(imported?.classList.contains("lucide-heart")).toBe(true);
      expect(typed?.classList.contains("lucide-pencil")).toBe(true);
      expect(imported?.getAttribute("aria-hidden")).toBe("true");
      expect(typed?.getAttribute("aria-hidden")).toBe("true");
    });

    it("should draw a row that does nothing yet as plain text, with no link or button", async () => {
      renderScreen();

      const list = await weighInList();

      expect(within(list).queryAllByRole("link")).toEqual([]);
      expect(within(list).queryAllByRole("button")).toEqual([]);
    });

    it("should name the days in the profile's zone, so a zone ahead of UTC reads the 17th as yesterday", async () => {
      weightBackend.timeZone = "Pacific/Auckland";
      renderScreen();

      const list = await weighInList();

      expect(rowOf(list, "Yesterday").textContent).toContain("07:10 · Added by you");
      expect(within(list).queryByText("Today")).toBeNull();
    });

    it("should read a profile with no zone as UTC", async () => {
      weightBackend.timeZone = null;
      renderScreen();

      expect(rowOf(await weighInList(), "Today").textContent).toContain("07:10");
    });

    it("should wait for the zone before it names a day, so Today does not flip when it arrives", async () => {
      let releaseZone: () => void = () => undefined;
      weightBackend.timeZoneGate = new Promise((resolve) => {
        releaseZone = resolve;
      });
      renderScreen();
      await waitFor(() => {
        expect(weightBackend.weighInRequestCount).toBeGreaterThan(0);
      });
      await act(async () => {
        await Promise.resolve();
      });

      expect(screen.queryByRole("region", { name: "Weigh-ins" })).toBeNull();
      expect(screen.getByRole("status", { name: WEIGHT_SCREEN.loadingLabel })).toBeTruthy();

      releaseZone();

      expect(await weighInList()).toBeTruthy();
    });
  });

  describe("offline", () => {
    it("should say it could not load, with no Try again, when nothing was read and there is no connection", async () => {
      weightBackend.weighInReadsHang = true;
      onlineManager.setOnline(false);
      renderScreen();

      const alert = await screen.findByRole("alert");

      expect(
        within(alert).getByRole("heading", { level: 2, name: WEIGHT_ERROR.title }),
      ).toBeTruthy();
      expect(screen.queryByRole("button", { name: WEIGHT_ERROR.retry })).toBeNull();
      expect(screen.queryByRole("status", { name: WEIGHT_SCREEN.loadingLabel })).toBeNull();
    });

    it("should show the list when the connection returns, by itself", async () => {
      weightBackend.weighIns = fortnight();
      onlineManager.setOnline(false);
      renderScreen();
      await screen.findByRole("alert");

      act(() => {
        onlineManager.setOnline(true);
      });

      expect(await weighInList()).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("should name the days in UTC rather than wait for a zone that cannot arrive offline", async () => {
      weightBackend.weighIns = fortnight();
      weightBackend.timeZone = "Pacific/Auckland";
      weightBackend.timeZoneGate = new Promise(() => undefined);
      renderScreen();
      await waitFor(() => {
        expect(weightBackend.weighInRequestCount).toBeGreaterThan(0);
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(screen.queryByRole("region", { name: "Weigh-ins" })).toBeNull();

      act(() => {
        onlineManager.setOnline(false);
      });

      expect(rowOf(await weighInList(), "Today").textContent).toContain("07:10");
    });
  });

  describe("health data", () => {
    it("should write no weight, note or database text to the console when the read fails", async () => {
      const written: string[] = [];
      for (const level of ["log", "info", "warn", "error"] as const) {
        vi.spyOn(console, level).mockImplementation((...parts: unknown[]) => {
          written.push(parts.map(String).join(" "));
        });
      }
      weightBackend.weighIns = fortnight();
      weightBackend.weighInReadsFail = true;
      renderScreen();

      await screen.findByRole("alert");

      expect(written.join(" ")).not.toMatch(/81\.|96\.4|long run|database text/);
      vi.restoreAllMocks();
    });

    it("should show the database's words nowhere on the page", async () => {
      weightBackend.weighInReadsFail = true;
      renderScreen();

      await screen.findByRole("alert");

      expect(document.body.textContent).not.toContain(LEAKY_DATABASE_MESSAGE);
    });
  });
});
