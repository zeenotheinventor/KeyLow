import {
  TREND_EXPLAINER,
  TREND_EXPLAINER_BODY_SECTION,
  WEIGH_IN_SHEET,
  WEIGHT_SCREEN,
  describeSettlingBanner,
} from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { cleanup, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { renderWithWeight, resetWeightBackend, weighInRow, weightBackend } from "./support";

import { WeightScreen } from "@/components/weight";

// Saturday 17 October 2026, in the profile's zone (UTC). Weigh-ins are on consecutive days up to it.
function readings(count: number) {
  return Array.from({ length: count }, (_, index) =>
    weighInRow({
      localDate: `2026-10-${String(16 - index).padStart(2, "0")}`,
      utcTime: "07:30",
      weightKg: 82 - index * 0.1,
    }),
  );
}

const infoButton = () => screen.getByRole("button", { name: WEIGHT_SCREEN.explainerLabel });
const explainer = () => screen.getByRole("dialog", { name: TREND_EXPLAINER.title });

async function openExplainer() {
  const opener = infoButton();
  // A click in Safari and Firefox does not focus a button, so focus is left where it was.
  fireEvent.click(opener);
  await screen.findByRole("dialog", { name: TREND_EXPLAINER.title });
  return opener;
}

describe("Trend explainer dialog", () => {
  beforeEach(() => {
    resetWeightBackend();
    onlineManager.setOnline(true);
  });

  afterEach(() => {
    cleanup();
    onlineManager.setOnline(true);
  });

  describe("the header button", () => {
    it("should show with the page's header while the weigh-ins are still being read", () => {
      weightBackend.weighInReadsHang = true;
      renderWithWeight(<WeightScreen />);

      expect(infoButton()).toBeTruthy();
    });

    it("should show on the empty page", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("heading", { name: "No weigh-ins yet" });

      expect(infoButton()).toBeTruthy();
    });
  });

  describe("opened", () => {
    beforeEach(() => {
      weightBackend.weighIns = readings(8);
    });

    it("should open under the title with every section as a heading below it", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      await openExplainer();

      const dialog = explainer();
      expect(
        within(dialog).getByRole("heading", { level: 2, name: TREND_EXPLAINER.title }),
      ).toBeTruthy();
      expect(
        within(dialog)
          .getAllByRole("heading", { level: 3 })
          .map((heading) => heading.textContent),
      ).toEqual(TREND_EXPLAINER.sections.map((section) => section.title));
      for (const section of TREND_EXPLAINER.sections) {
        expect(within(dialog).getByText(section.text)).toBeTruthy();
      }
      expect(within(dialog).getByText(TREND_EXPLAINER.footer)).toBeTruthy();
    });

    it("should leave out the body fat and lean mass section, which the web has no Composition for", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      await openExplainer();

      expect(
        within(explainer()).queryByRole("heading", { name: TREND_EXPLAINER_BODY_SECTION.title }),
      ).toBeNull();
      expect(within(explainer()).queryByText(TREND_EXPLAINER_BODY_SECTION.text)).toBeNull();
    });

    it("should close on Done", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      await openExplainer();

      fireEvent.click(within(explainer()).getByRole("button", { name: TREND_EXPLAINER.done }));

      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("should close on Escape and put focus back on the button, even when the click did not focus it", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      expect(document.activeElement).not.toBe(infoButton());
      await openExplainer();

      fireEvent.keyDown(document, { key: "Escape" });

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.activeElement).toBe(infoButton());
    });

    it("should put focus back on the button after Done", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      await openExplainer();

      fireEvent.click(within(explainer()).getByRole("button", { name: TREND_EXPLAINER.done }));

      expect(document.activeElement).toBe(infoButton());
    });
  });

  describe("settling", () => {
    it("should say how many weigh-ins the trend has, with a progress bar, while it has fewer than 7", async () => {
      weightBackend.weighIns = readings(3);
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      await openExplainer();

      const dialog = explainer();
      expect(within(dialog).getByText(describeSettlingBanner(3))).toBeTruthy();
      const bar = within(dialog).getByRole("progressbar", { name: TREND_EXPLAINER.progressName });
      expect(bar.getAttribute("aria-valuenow")).toBe("3");
      expect(bar.getAttribute("aria-valuemin")).toBe("0");
      expect(bar.getAttribute("aria-valuemax")).toBe("7");
      // 3 of 7 is 42.857 per cent of the track. The fill's width is the variable the class reads.
      const fill = bar.firstElementChild;
      expect(
        Number.parseFloat(
          fill?.getAttribute("style")?.match(/--settling-fill:\s*([\d.]+)%/)?.[1] ?? "",
        ),
      ).toBeCloseTo((3 / 7) * 100, 2);
      // The board draws the settling banner with no icon, and 12 on every side.
      const banner = within(dialog).getByRole("note");
      expect(banner.querySelector("svg")).toBeNull();
      expect(banner.className.split(" ")).toContain("p-3");
    });

    it("should show no banner once the trend has 7 weigh-ins", async () => {
      weightBackend.weighIns = readings(7);
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      await openExplainer();

      expect(within(explainer()).queryByText(/is settling/)).toBeNull();
      expect(within(explainer()).queryByRole("progressbar")).toBeNull();
    });

    it("should show no banner with no weigh-ins at all", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("heading", { name: "No weigh-ins yet" });
      await openExplainer();

      expect(within(explainer()).queryByText(/is settling/)).toBeNull();
    });
  });

  describe("while the weigh-ins are not known", () => {
    it("should open with the sections and no banner or spinner while they are still being read", async () => {
      weightBackend.weighInReadsHang = true;
      renderWithWeight(<WeightScreen />);
      await openExplainer();

      const dialog = explainer();
      expect(within(dialog).getAllByRole("heading", { level: 3 })).toHaveLength(
        TREND_EXPLAINER.sections.length,
      );
      expect(within(dialog).queryByText(/is settling/)).toBeNull();
      expect(within(dialog).queryByRole("progressbar")).toBeNull();
      expect(within(dialog).queryByRole("status")).toBeNull();
    });

    it("should open the same offline with nothing read, where the read waits for ever", async () => {
      onlineManager.setOnline(false);
      renderWithWeight(<WeightScreen />);
      await openExplainer();

      const dialog = explainer();
      expect(within(dialog).getAllByRole("heading", { level: 3 })).toHaveLength(
        TREND_EXPLAINER.sections.length,
      );
      expect(within(dialog).queryByText(/is settling/)).toBeNull();
      expect(within(dialog).queryByRole("status")).toBeNull();
      expect(within(dialog).queryByRole("progressbar")).toBeNull();
    });
  });

  describe("beside the weigh-in dialog", () => {
    beforeEach(() => {
      weightBackend.weighIns = readings(8);
    });

    it("should leave the weigh-in dialog's focus to Add weigh-in after the explainer has been used", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      await openExplainer();
      fireEvent.keyDown(document, { key: "Escape" });

      const add = screen.getAllByRole("button", { name: WEIGHT_SCREEN.addLabel })[0];
      if (add === undefined) throw new Error("There is no Add weigh-in button");
      add.focus();
      fireEvent.click(add);
      await screen.findByRole("dialog", { name: WEIGH_IN_SHEET.titleAdd });
      expect(screen.queryByRole("dialog", { name: TREND_EXPLAINER.title })).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: WEIGH_IN_SHEET.cancel }));

      expect(document.activeElement).toBe(add);
    });

    it("should give focus back to the button after the weigh-in dialog has been used", async () => {
      renderWithWeight(<WeightScreen />);
      await screen.findByRole("region", { name: "Weigh-ins" });
      const add = screen.getAllByRole("button", { name: WEIGHT_SCREEN.addLabel })[0];
      if (add === undefined) throw new Error("There is no Add weigh-in button");
      fireEvent.click(add);
      await screen.findByRole("dialog", { name: WEIGH_IN_SHEET.titleAdd });
      fireEvent.click(screen.getByRole("button", { name: WEIGH_IN_SHEET.cancel }));

      await openExplainer();
      fireEvent.keyDown(document, { key: "Escape" });

      expect(document.activeElement).toBe(infoButton());
    });
  });
});
