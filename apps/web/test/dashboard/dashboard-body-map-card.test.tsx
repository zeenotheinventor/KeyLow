import { BODY_MAP } from "@keylow/core/copy";
import { BODY_ARTWORK } from "@keylow/core/training";
import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import {
  goldenThursdayBodyMap,
  goldenThursdayVolumeBodyMap,
  noHistoryBodyMap,
  noSetsThisWeekVolumeBodyMap,
} from "./bodyMapFixtures";

import type { DashboardBodyMap } from "@keylow/api-client";

import { DashboardBodyMapCard } from "@/components/dashboard/DashboardBodyMapCard";

const goldenName =
  "Body map, Actual heat now. Warmest: lats 25 percent, mid traps 18 percent, biceps 15 percent. Today: Legs, 16 sets planned. Open the body map";

const card = () => screen.getByRole("region", { name: BODY_MAP.dashboardCard.title });
const cardLink = () => screen.getByRole("link", { name: /^Body map, Actual heat now\./ });
const figure = (side: "front" | "back") =>
  screen.getByRole("img", { name: `Body map, Actual, heat, ${side}`, hidden: true });

function renderCard(bodyMap: DashboardBodyMap) {
  return render(<DashboardBodyMapCard bodyMap={bodyMap} />);
}

describe("DashboardBodyMapCard", () => {
  afterEach(() => {
    cleanup();
  });

  describe("on Thursday at 17:55", () => {
    it("should be one link named by what it shows and ending in Open the body map", () => {
      renderCard(goldenThursdayBodyMap);

      expect(cardLink().getAttribute("aria-label")).toBe(goldenName);
      expect(card().contains(cardLink())).toBe(true);
    });

    it("should open the body map page", () => {
      renderCard(goldenThursdayBodyMap);

      expect(cardLink().getAttribute("href")).toBe("/body-map");
    });

    it("should write the three warmest muscles and today's planned day", () => {
      renderCard(goldenThursdayBodyMap);

      const words = within(card());
      expect(
        words.getByText("Warmest: lats 25 %, mid traps 18 %, biceps 15 %", { ignore: "" }),
      ).toBeTruthy();
      expect(words.getByText("Today: Legs")).toBeTruthy();
    });

    it("should draw the front and the back, 100 wide, at the heat steps of the board", () => {
      renderCard(goldenThursdayBodyMap);

      for (const side of ["front", "back"] as const) {
        expect(figure(side).getAttribute("width")).toBe("100");
        expect(figure(side).getAttribute("height")).toBe("220");
      }
      const fillOf = (side: "front" | "back", path: string) =>
        figure(side).querySelector(`path[d="${path}"]`)?.getAttribute("class");
      expect(fillOf("front", BODY_ARTWORK.male.front.muscles.chest_upper)).toContain("fill-heat-1");
      expect(fillOf("back", BODY_ARTWORK.male.back.muscles.lats)).toContain("fill-heat-2");
    });

    it("should draw the heat legend beside the figures", () => {
      renderCard(goldenThursdayBodyMap);

      expect(screen.getByRole("img", { name: "Heat legend", hidden: true })).toBeTruthy();
    });

    it("should title itself Training over Actual · now, with the Body map label of the link", () => {
      renderCard(goldenThursdayBodyMap);

      const words = within(card());
      expect(words.getByText("Training")).toBeTruthy();
      expect(words.getByText("Actual · now")).toBeTruthy();
      expect(words.getByText(BODY_MAP.dashboardCard.link)).toBeTruthy();
    });
  });

  describe("with no sets", () => {
    it("should say nothing is logged in the window, and not name a day when there is no routine", () => {
      renderCard(noHistoryBodyMap);

      expect(cardLink().getAttribute("aria-label")).toBe(
        "Body map, Actual heat now. Nothing logged in the last 14 days. Open the body map",
      );
      expect(within(card()).queryByText(/^Today:/)).toBeNull();
    });
  });

  describe("on a rest day", () => {
    it("should say it is a rest day", () => {
      renderCard({ ...noHistoryBodyMap, today: { kind: "rest", dayName: null } });

      expect(within(card()).getByText("Today: Rest day")).toBeTruthy();
    });
  });

  describe("under the Weekly volume chart", () => {
    const volumeLink = () => screen.getByRole("link", { name: /weekly sets this week/ });
    const volumeFigure = (side: "front" | "back") =>
      screen.getByRole("img", { name: `Body map, Actual, weekly sets, ${side}`, hidden: true });

    it("should be one link named by the week's most trained muscles and today's planned day", () => {
      renderCard(goldenThursdayVolumeBodyMap);

      expect(volumeLink().getAttribute("aria-label")).toBe(
        "Body map, Actual weekly sets this week, Monday to Sunday. Most sets: lats 8 sets, side delts 6.5 sets, quads 6 sets. Today: Legs, 16 sets planned. Open the body map",
      );
      expect(volumeLink().getAttribute("href")).toBe("/body-map");
      expect(screen.getAllByRole("link", { hidden: true })).toHaveLength(1);
    });

    it("should title itself Actual · this week and write the most sets line in place of the warmest", () => {
      renderCard(goldenThursdayVolumeBodyMap);

      const words = within(card());
      expect(words.getByText("Actual · this week")).toBeTruthy();
      expect(words.getByText("Most sets: lats 8, side delts 6.5, quads 6")).toBeTruthy();
      expect(words.getByText("Today: Legs")).toBeTruthy();
      expect(words.queryByText(/^Warmest/)).toBeNull();
    });

    it("should draw the front and the back in the volume colours", () => {
      renderCard(goldenThursdayVolumeBodyMap);

      const fillOf = (side: "front" | "back", path: string) =>
        volumeFigure(side).querySelector(`path[d="${path}"]`)?.getAttribute("class");
      expect(fillOf("back", BODY_ARTWORK.male.back.muscles.lats)).toContain(
        "fill-volume-productive",
      );
      expect(fillOf("front", BODY_ARTWORK.male.front.muscles.biceps)).toContain(
        "fill-volume-maintaining",
      );
    });

    it("should draw the volume legend beside the figures, in place of the heat legend", () => {
      renderCard(goldenThursdayVolumeBodyMap);

      expect(screen.getByRole("img", { name: "Volume legend", hidden: true })).toBeTruthy();
      expect(screen.queryByRole("img", { name: "Heat legend", hidden: true })).toBeNull();
    });

    it("should say no sets are logged this week when the week is empty", () => {
      renderCard(noSetsThisWeekVolumeBodyMap);

      expect(volumeLink().getAttribute("aria-label")).toBe(
        "Body map, Actual weekly sets this week, Monday to Sunday. No sets logged this week yet. Open the body map",
      );
      expect(within(card()).getByText("No sets logged this week yet")).toBeTruthy();
    });
  });

  describe("as a link", () => {
    it("should be the only link, with no button inside it, and its figures take no click", () => {
      renderCard(goldenThursdayBodyMap);

      expect(screen.getAllByRole("link", { hidden: true })).toHaveLength(1);
      expect(screen.queryAllByRole("button", { hidden: true })).toHaveLength(0);
    });

    it("should keep the words inside it out of the accessibility tree, because its name says all of it", () => {
      renderCard(goldenThursdayBodyMap);

      expect(screen.getByText("Today: Legs").closest("[aria-hidden=true]")).not.toBeNull();
    });
  });
});
