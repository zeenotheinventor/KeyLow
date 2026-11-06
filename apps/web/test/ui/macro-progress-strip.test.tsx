import { progressBars } from "@keylow/core/diary";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { ProgressTargets } from "@keylow/core/diary";

import { MacroProgressStrip, MacroProgressStripSkeleton } from "@/components/ui/MacroProgressStrip";

const targets: ProgressTargets = { kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 };
const noTargets: ProgressTargets = { kcal: null, protein_g: null, carbs_g: null, fat_g: null };

// Thursday 15 October on the diary canvas.
const underTarget = progressBars({ kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 }, targets);
// The lasagne day: calories 212 over, and every macro but protein over too.
const overTarget = progressBars({ kcal: 2412, protein_g: 150, carbs_g: 257, fat_g: 81 }, targets);
// All four over at once, so each nutrient's outline can be checked.
const allOverTarget = progressBars(
  { kcal: 2412, protein_g: 171, carbs_g: 257, fat_g: 81 },
  targets,
);
const atTarget = progressBars({ kcal: 2200, protein_g: 160, carbs_g: 220, fat_g: 70 }, targets);
const withoutTargets = progressBars(
  { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 },
  noTargets,
);

function renderStrip(bars = underTarget, onPress: () => void = () => undefined) {
  return render(<MacroProgressStrip bars={bars} onPress={onPress} />);
}

// The wide layout is the one inside the 768 px media query, the phone layout is the rest.
const split = (css: string) => {
  const [phone = "", wide = ""] = css.split("@media (min-width: 768px)");
  return { phone, wide };
};

const stripButton = () => screen.getByRole("button", { name: /^Targets/ });
const fillShare = (key: string) =>
  screen.getByTestId(`${key}-fill`).style.getPropertyValue("--fill");

describe("MacroProgressStrip", () => {
  afterEach(() => {
    cleanup();
  });

  describe("the button", () => {
    it("should be one button named Targets with the four values", () => {
      renderStrip();

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(stripButton().getAttribute("aria-label")).toBe(
        "Targets. Calories: 1,039 of 2,200 kilocalories. Protein: 86 of 160 grams. Carbohydrate: 129 of 220 grams. Fat: 19 of 70 grams",
      );
    });

    it("should say which bars are over target in its name", () => {
      renderStrip(overTarget);

      expect(stripButton().getAttribute("aria-label")).toContain(
        "Calories: 2,412 of 2,200 kilocalories, over target",
      );
    });

    it("should call onPress when pressed", () => {
      const onPress = vi.fn();
      renderStrip(underTarget, onPress);

      fireEvent.click(stripButton());

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should be a real button the keyboard can reach and press", () => {
      renderStrip();

      stripButton().focus();

      expect(document.activeElement).toBe(stripButton());
      expect(stripButton().getAttribute("type")).toBe("button");
      expect(stripButton().getAttribute("tabindex")).toBeNull();
    });

    it("should be at least 44 px high even with no bars to give it height", async () => {
      renderStrip(withoutTargets);

      const css = await compileUtilities(stripButton().className);

      expect(css).toContain("min-height: 44px");
    });

    it("should show a focus ring for the keyboard", async () => {
      renderStrip();

      const css = await compileUtilities(stripButton().className);

      expect(css).toContain("focus-visible");
      expect(css).toContain("--tw-ring-color: rgb(var(--kl-focus-ring)");
    });
  });

  describe("the values", () => {
    it("should print each value over its target, calories first", () => {
      renderStrip();

      expect(screen.getByText("1,039")).toBeTruthy();
      expect(screen.getByText("/ 2,200")).toBeTruthy();
      expect(screen.getByText("86")).toBeTruthy();
      expect(screen.getByText("/ 160")).toBeTruthy();
      expect(screen.getByText("129")).toBeTruthy();
      expect(screen.getByText("/ 220")).toBeTruthy();
      expect(screen.getByText("19")).toBeTruthy();
      expect(screen.getByText("/ 70")).toBeTruthy();
    });

    it("should always list the macros in the order P, C, F", () => {
      renderStrip();

      const letters = within(stripButton()).getAllByText(/^[PCF]$/);

      expect(letters.map((letter) => letter.textContent)).toEqual(["P", "C", "F"]);
    });

    it("should lead the calories with a 12 px flame in the calories colour", async () => {
      renderStrip();

      const flame = screen.getByTestId("calories-flame");
      const css = await compileUtilities(flame.getAttribute("class") ?? "");

      expect(css).toContain("stroke: rgb(var(--kl-calories)");
      expect(css).toContain("width: 12px");
    });

    it("should keep a four digit calorie value on one line", async () => {
      renderStrip(progressBars({ kcal: 1987, protein_g: 1, carbs_g: 1, fat_g: 1 }, targets));

      const line = screen.getByText("1,987").parentElement;
      const css = await compileUtilities(line?.className ?? "");

      expect(css).toContain("white-space: nowrap");
    });
  });

  describe("the bars", () => {
    it("should fill each bar by its share of the target", () => {
      renderStrip();

      expect(fillShare("calories")).toBe("47.22727272727273%");
      expect(fillShare("protein")).toBe("53.75%");
    });

    it("should fill a bar at its target and give it no outline", () => {
      renderStrip(atTarget);

      expect(fillShare("calories")).toBe("100%");
      expect(screen.getByTestId("calories-bar").className).not.toContain("box-shadow");
    });

    it("should draw a track 4 px high in the border colour, with a pill radius", async () => {
      renderStrip();

      const css = await compileUtilities(screen.getByTestId("protein-bar").className);

      expect(css).toContain("height: 4px");
      expect(css).toContain("border-radius: 999px");
      expect(css).toContain("--kl-border");
    });

    it.each(underTarget.map((bar) => bar.key))(
      "should fill the %s bar in its own colour",
      async (key) => {
        renderStrip();

        const css = await compileUtilities(screen.getByTestId(`${key}-fill`).className);

        expect(css).toContain(`--kl-${key}`);
      },
    );

    it("should draw no bar when there is no target, only the value and its unit", () => {
      renderStrip(withoutTargets);

      expect(screen.queryByTestId("calories-bar")).toBeNull();
      expect(screen.queryByTestId("protein-bar")).toBeNull();
      expect(screen.getByText("1,039 kcal")).toBeTruthy();
      expect(screen.getByText("86 g")).toBeTruthy();
      expect(screen.queryByText(/\//)).toBeNull();
    });
  });

  describe("over target", () => {
    it("should fill the calories bar and outline it for 2,412 of 2,200 kcal", async () => {
      renderStrip(overTarget);

      expect(fillShare("calories")).toBe("100%");

      const css = await compileUtilities(screen.getByTestId("calories-bar").className);

      // A 1 px gap in the background colour, then a 1.5 px ring of the colour mixed 55 % with white.
      expect(css).toContain(
        "box-shadow: 0 0 0 1px rgb(var(--kl-background)),0 0 0 2.5px color-mix(in srgb,rgb(var(--kl-calories)) 55%,white)",
      );
    });

    it.each(allOverTarget.map((bar) => bar.key))(
      "should outline the %s bar in its own colour when it is over",
      async (key) => {
        renderStrip(allOverTarget);

        const css = await compileUtilities(screen.getByTestId(`${key}-bar`).className);

        // Each nutrient's colour variable is named for the nutrient.
        expect(css).toContain(`0 0 0 2.5px color-mix(in srgb,rgb(var(--kl-${key})) 55%,white)`);
      },
    );

    it("should leave a bar that is under target without an outline", () => {
      renderStrip(overTarget);

      expect(screen.getByTestId("protein-bar").className).not.toContain("box-shadow");
    });

    it("should keep the values in the primary text colour", () => {
      renderStrip(overTarget);

      expect(screen.getByText("2,412").className).not.toMatch(/text-(warning|danger)/);
      expect(screen.getByText("2,412").parentElement?.className).toContain("text-text-primary");
    });

    it("should use no warning or danger token anywhere in the strip", async () => {
      const { container } = renderStrip(overTarget);

      const css = await compileUtilities(container.innerHTML);

      expect(container.innerHTML).not.toMatch(/warning|danger/);
      expect(css).not.toMatch(/--kl-(warning|danger)/);
    });

    it("should show no overflow segment", () => {
      renderStrip(overTarget);

      expect(screen.queryByTestId("calories-cap")).toBeNull();
    });
  });

  describe("the layout", () => {
    it("should be four equal columns with a 24 px gap on a wide screen", async () => {
      renderStrip();

      const { wide } = split(await compileUtilities(stripButton().className));

      expect(wide).toContain("grid-template-columns: repeat(4,minmax(0,1fr))");
      expect(wide).toContain("gap: 24px");
    });

    it("should make the calories column one and a half times a macro column with an 8 px gap on a phone", async () => {
      renderStrip();

      const { phone } = split(await compileUtilities(stripButton().className));

      expect(phone).toContain("grid-template-columns: minmax(0,1.5fr) repeat(3,minmax(0,1fr))");
      expect(phone).toContain("gap: 8px");
    });
  });

  it("should take a class from the screen", () => {
    render(<MacroProgressStrip bars={underTarget} className="mt-4" onPress={() => undefined} />);

    expect(stripButton().className).toContain("mt-4");
  });
});

// The plate's golden day (docs/design/web/proposals/plate.md): 1,039 kcal eaten, and the four foods come to
// 658 kcal, P 57.2, C 79.1, F 11.9, so 1,697 with the day.
const plateTotals = { kcal: 658, protein_g: 57.2, carbs_g: 79.1, fat_g: 11.9 };
const eatenToday = { kcal: 1039, protein_g: 86, carbs_g: 129, fat_g: 19 };
const withPlate = progressBars(eatenToday, targets, plateTotals);
// Naan bread and the crisps on top: 2,257 kcal, P 157.2, C 295.1, F 46.4 with the day.
const overPlate = progressBars(eatenToday, targets, {
  kcal: 1218,
  protein_g: 71.2,
  carbs_g: 166.1,
  fat_g: 27.4,
});
const plateShare = (key: string) =>
  screen.getByTestId(`${key}-plate-fill`).style.getPropertyValue("--plate-fill");

describe("MacroProgressStrip as a status group", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a group with no button, named by its label and the four values", () => {
    render(<MacroProgressStrip bars={withPlate} label="Today with your plate" />);
    const group = screen.getByRole("group", { name: /^Today with your plate\. Calories: / });

    expect(screen.queryByRole("button")).toBeNull();
    expect(group.getAttribute("aria-label")).toBe(
      "Today with your plate. Calories: 1,697 of 2,200 kilocalories, 658 on your plate. Protein: 143 of 160 grams, 57 on your plate. Carbohydrate: 208 of 220 grams, 79 on your plate. Fat: 31 of 70 grams, 12 on your plate",
    );
  });

  it("should be named Targets when it is given no label", () => {
    render(<MacroProgressStrip bars={underTarget} />);

    expect(screen.getByRole("group", { name: /^Targets\. Calories: / })).toBeTruthy();
  });

  it("should draw no touch padding, since nothing in it is pressed", async () => {
    render(<MacroProgressStrip bars={underTarget} />);

    const css = await compileUtilities(screen.getByRole("group").className);

    expect(css).not.toContain("min-height: 44px");
    expect(css).not.toContain("padding-top: 9px");
  });
});

describe("MacroProgressStrip with a plate", () => {
  afterEach(() => {
    cleanup();
  });

  it("should print what was eaten plus the plate: 1,697 against 2,200", () => {
    render(<MacroProgressStrip bars={withPlate} />);

    expect(screen.getByText("1,697")).toBeTruthy();
    expect(screen.getByText("143")).toBeTruthy();
    expect(screen.getByText("208")).toBeTruthy();
    expect(screen.getByText("31")).toBeTruthy();
  });

  it("should draw the plate's share after the eaten fill, in its own colour at 45 per cent", async () => {
    render(<MacroProgressStrip bars={withPlate} />);

    expect(plateShare("calories")).toBe("29.909090909090907%");
    expect(fillShare("calories")).toBe("47.22727272727273%");

    const css = await compileUtilities(screen.getByTestId("calories-plate-fill").className);

    expect(css).toContain("rgb(var(--kl-calories) / 0.45)");
  });

  it("should draw no plate share when the plate is empty", () => {
    render(<MacroProgressStrip bars={underTarget} />);

    expect(screen.queryByTestId("calories-plate-fill")).toBeNull();
  });

  it("should fill calories and carbs and outline them for the over plate, in primary text", () => {
    render(<MacroProgressStrip bars={overPlate} />);
    const calories = screen.getByText("2,257");

    expect(parseFloat(fillShare("calories")) + parseFloat(plateShare("calories"))).toBeCloseTo(100);
    expect(screen.getByTestId("calories-bar").className).toContain("box-shadow");
    expect(screen.getByTestId("carbs-bar").className).toContain("box-shadow");
    expect(screen.getByTestId("protein-bar").className).not.toContain("box-shadow");
    expect(screen.getByText("295")).toBeTruthy();
    expect(calories.parentElement?.className).toContain("text-text-primary");
    expect(calories.parentElement?.className).not.toMatch(/danger|warning/);
  });
});

describe("MacroProgressStrip on a surface", () => {
  afterEach(() => {
    cleanup();
  });

  it("should take the outline's gap from the page by default", async () => {
    render(<MacroProgressStrip bars={overPlate} />);

    const css = await compileUtilities(screen.getByTestId("calories-bar").className);

    expect(css).toContain("0 0 0 1px rgb(var(--kl-background))");
  });

  it("should take the outline's gap from the sheet in a dialog", async () => {
    render(<MacroProgressStrip bars={overPlate} surface="sheet" />);

    const css = await compileUtilities(screen.getByTestId("calories-bar").className);

    expect(css).toContain(
      "box-shadow: 0 0 0 1px rgb(var(--kl-surface-sheet)),0 0 0 2.5px color-mix(in srgb,rgb(var(--kl-calories)) 55%,white)",
    );
  });

  it("should take the outline's gap from the card on a card", async () => {
    render(<MacroProgressStrip bars={overPlate} surface="card" />);

    const css = await compileUtilities(screen.getByTestId("carbs-bar").className);

    expect(css).toContain(
      "box-shadow: 0 0 0 1px rgb(var(--kl-surface)),0 0 0 2.5px color-mix(in srgb,rgb(var(--kl-carbs)) 55%,white)",
    );
  });

  it("should size the columns of a card to their numbers, two by two below 1024 px", async () => {
    render(<MacroProgressStrip bars={withPlate} surface="card" />);

    const css = await compileUtilities(screen.getByRole("group").className);

    expect(split(css).phone).toContain("grid-template-columns: repeat(2,minmax(0,1fr))");
    expect(css).toMatch(
      /@media \(min-width: 1024px\)[\s\S]*grid-template-columns: repeat\(4,auto\)/,
    );
    expect(css).not.toContain("repeat(4,minmax(0,1fr))");
  });
});

describe("MacroProgressStripSkeleton", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("should be a status named Loading, as high as the strip: 26 px, before anything shows", async () => {
    render(<MacroProgressStripSkeleton />);

    const status = screen.getByRole("status", { name: "Loading" });
    const css = await compileUtilities(status.className);

    expect(status.childElementCount).toBe(0);
    expect(css).toContain("min-height: 26px");
  });

  it("should hold four placeholder columns once the delay has passed", () => {
    render(<MacroProgressStripSkeleton />);

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(screen.getByRole("status", { name: "Loading" }).childElementCount).toBe(4);
  });
});
