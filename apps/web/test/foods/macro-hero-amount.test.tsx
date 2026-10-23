import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { makeFood } from "./support";
import { compileUtilities } from "../ui/compileUtilities";

import type { MacroHeroAmount, MacroHeroRegion } from "@/components/foods/FoodDetail/MacroHero";

import { MacroHero } from "@/components/foods/FoodDetail/MacroHero";

const chicken: MacroHeroAmount = {
  name: "Chicken breast, grilled",
  caption: "For 150 g",
  values: { kcal: 222, protein_g: 48, carbs_g: 0, fat_g: 3.3 },
};

function showHero(amount?: MacroHeroAmount) {
  render(
    <MacroHero food={makeFood({ kcal: 148 })} {...(amount === undefined ? {} : { amount })} />,
  );
}

const hero = () => screen.getByRole("group", { name: /Energy and macros/ });

describe("MacroHero with an amount", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a group whose name includes the caption of the amount", () => {
    showHero(chicken);

    expect(screen.getByRole("group", { name: "Energy and macros, For 150 g" })).toBeTruthy();
  });

  it("should name a portion basis in the group", () => {
    showHero({ ...chicken, caption: "For 1 medium (100 g)" });

    expect(
      screen.getByRole("group", { name: "Energy and macros, For 1 medium (100 g)" }),
    ).toBeTruthy();
  });

  it("should show the values of the amount and not the food's own", () => {
    showHero(chicken);

    expect(within(hero()).getByText("222")).toBeTruthy();
    expect(within(hero()).queryByText("148")).toBeNull();
    expect(within(hero()).queryByText("per 100 g")).toBeNull();
    expect(
      within(hero())
        .getAllByRole("term")
        .map((term) => term.textContent),
    ).toEqual(["Protein", "Carbs", "Fat"]);
  });

  it("should show the food's name and the caption on the first line", () => {
    showHero(chicken);

    expect(within(hero()).getByText("Chicken breast, grilled")).toBeTruthy();
    expect(within(hero()).getByText("For 150 g")).toBeTruthy();
  });

  it("should show each macro in grams with its share of the energy as a pill", () => {
    showHero(chicken);

    expect(
      within(hero())
        .getAllByRole("definition")
        .map((definition) => definition.textContent),
    ).toEqual(["48 g", "86 % of energy", "0 g", "0 % of energy", "3.3 g", "13 % of energy"]);
  });

  it("should say that the shares are estimates", () => {
    showHero(chicken);

    expect(within(hero()).getByText("Shares of energy are estimates")).toBeTruthy();
  });

  it("should draw each share as the kit Badge is: 20 high, 8 on the sides, outlined", async () => {
    showHero(chicken);
    const pill = within(hero()).getByText("86 %");
    const className = pill.className;
    const css = await compileUtilities(className);

    expect(className.split(" ")).toEqual(expect.arrayContaining(["h-5", "px-2", "border-border"]));
    expect(css).toMatch(/\.h-5\s*\{\s*height: 20px/);
    expect(css).toMatch(/\.px-2\s*\{[^}]*padding-left: 8px/);
  });

  it("should draw the numeral in the 44 on 48 dialog type token", async () => {
    showHero(chicken);
    const numeral = within(hero()).getByText("222");
    const css = await compileUtilities(numeral.className);

    expect(numeral.className).toContain("text-numeral-large");
    expect(css).toMatch(/font-size: 44px/);
    expect(css).toMatch(/line-height: 48px/);
  });

  it("should put the pill at the end of the row below 700 px and first in the column above it", () => {
    showHero(chicken);
    const pill = within(hero()).getByText("86 %");

    expect(pill.closest("dd")?.className.split(" ")).toEqual(
      expect.arrayContaining(["order-3", "ml-auto", "min-[700px]:order-none"]),
    );
  });

  describe("with no valid amount", () => {
    const none: MacroHeroAmount = {
      name: "Chicken breast, grilled",
      caption: "For this amount",
      values: null,
    };

    it("should show dashes in place of the values, with the generic caption", () => {
      showHero(none);

      expect(
        screen.getByRole("group", { name: "Energy and macros, For this amount" }),
      ).toBeTruthy();
      expect(within(hero()).getAllByText("–")).toHaveLength(4);
    });

    it("should show no shares and no note about them", () => {
      showHero(none);

      expect(within(hero()).queryByText(/of energy/)).toBeNull();
      expect(within(hero()).queryByText("Shares of energy are estimates")).toBeNull();
    });
  });

  describe("a value the food does not give", () => {
    it("should say not given for a macro and draw no pill for it", () => {
      showHero({ ...chicken, values: { kcal: 200, protein_g: null, carbs_g: 20, fat_g: 10 } });

      expect(
        within(hero())
          .getAllByRole("definition")
          .map((definition) => definition.textContent),
      ).toEqual(["not given", "20 g", "40 % of energy", "10 g", "45 % of energy"]);
    });

    it("should say the energy is not given and draw no pill", () => {
      showHero({ ...chicken, values: { kcal: null, protein_g: 14, carbs_g: null, fat_g: 17 } });

      expect(within(hero()).getByText("Energy not given")).toBeTruthy();
      expect(within(hero()).queryByText(/of energy/)).toBeNull();
    });
  });
});

describe("MacroHero without an amount", () => {
  afterEach(() => {
    cleanup();
  });

  it("should stay the food detail card: a region of the food's own per 100 g values", () => {
    showHero();

    expect(screen.getByRole("region", { name: "Energy and macros" })).toBeTruthy();
    expect(screen.queryByRole("group", { name: /Energy and macros/ })).toBeNull();
    expect(screen.getByText("per 100 g")).toBeTruthy();
  });
});

describe("MacroHero as a named region", () => {
  afterEach(() => {
    cleanup();
  });

  const perServing: MacroHeroAmount & { region: MacroHeroRegion } = {
    caption: "Per serving (275 g)",
    values: { kcal: 374, protein_g: 32, carbs_g: 43, fat_g: 8.1 },
    region: {
      name: "Per serving",
      footnote: "Per 100 g cooked: 136 kcal",
      announcement: "374 kilocalories per serving, protein 32 grams",
    },
  };

  function showRegion(amount: MacroHeroAmount & { region: MacroHeroRegion } = perServing) {
    render(<MacroHero amount={amount} />);
    return screen.getByRole("region", { name: "Per serving" });
  }

  it("should be a region with the name it is given", () => {
    showRegion();

    expect(screen.queryByRole("group")).toBeNull();
  });

  it("should write the caption on the right of the numeral, and the footnote under the macros", () => {
    const region = showRegion();

    expect(within(region).getByText("374")).toBeTruthy();
    expect(within(region).getByText("Per serving (275 g)")).toBeTruthy();
    expect(within(region).getByText("Per 100 g cooked: 136 kcal")).toBeTruthy();
  });

  it("should say the shares are estimates only when it has no footnote of its own", () => {
    const region = showRegion();

    expect(within(region).queryByText("Shares of energy are estimates")).toBeNull();
  });

  it("should announce its text politely", () => {
    const region = showRegion();

    expect(within(region).getByRole("status").textContent).toBe(
      "374 kilocalories per serving, protein 32 grams",
    );
  });

  it("should draw the macros as rows at every width, with the share pill at the end", () => {
    const region = showRegion();
    const pill = within(region).getByText("34 %");

    expect(pill.closest("dd")?.className).not.toContain("min-[700px]");
    expect(within(region).getByText("32 g").closest("div")?.className).not.toContain("min-[700px]");
  });

  it("should show dashes and no footnote while there is nothing to work out", () => {
    const region = showRegion({
      caption: "Per serving",
      values: null,
      region: { name: "Per serving", announcement: "" },
    });

    expect(within(region).getAllByText("–")).toHaveLength(4);
    expect(within(region).getByText("Per serving")).toBeTruthy();
    expect(within(region).queryByText(/Per 100 g/)).toBeNull();
  });
});

describe("MacroHero with an amount and no food", () => {
  afterEach(() => {
    cleanup();
  });

  it("should draw the amount of something that is not a food, such as a recipe", () => {
    render(
      <MacroHero amount={{ ...chicken, name: "Chicken and rice", caption: "For 1 serving" }} />,
    );

    const group = screen.getByRole("group", { name: "Energy and macros, For 1 serving" });
    expect(within(group).getByText("222")).toBeTruthy();
    expect(within(group).getByText("Chicken and rice")).toBeTruthy();
  });

  it("should be described by the note it is given", () => {
    render(
      <>
        <MacroHero amount={{ ...chicken, describedBy: "grams-note" }} />
        <p id="grams-note">These grams are of the raw ingredients.</p>
      </>,
    );

    expect(
      screen.getByRole("group", { name: /Energy and macros/ }).getAttribute("aria-describedby"),
    ).toBe("grams-note");
  });

  it("should have no description when it is not given a note", () => {
    render(<MacroHero amount={chicken} />);

    expect(
      screen.getByRole("group", { name: /Energy and macros/ }).hasAttribute("aria-describedby"),
    ).toBe(false);
  });
});
