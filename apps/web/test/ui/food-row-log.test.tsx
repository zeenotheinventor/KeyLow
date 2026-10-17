import { describeAddFood } from "@keylow/core/copy";
import { controlHeight, touchTarget } from "@keylow/tokens";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { FoodLogRowProps, FoodRowMacros } from "@/components/ui/FoodRow";

import { FoodRow } from "@/components/ui/FoodRow";

const chickenBreast = [
  { text: "Chicken", matched: true },
  { text: " ", matched: false },
  { text: "breast", matched: true },
  { text: ", grilled", matched: false },
];

const macros: FoodRowMacros = {
  protein: "48",
  carbs: "0",
  fat: "3.3",
  description: "not used by the food log rows",
};

type StackedRowProps = Extract<FoodLogRowProps, { layout: "stacked" }>;
type LogRowOverrides = Partial<Omit<StackedRowProps, "layout">>;
type SearchRowOverrides = Omit<LogRowOverrides, "actions">;

const spokenStats = "222 kilocalories, protein 48 grams, carbohydrate 0 grams, fat 3.3 grams";

// jsdom has no layout, so a size is read from the CSS the row's own classes compile to.
async function declarationsOf(classNames: string, className: string): Promise<string> {
  const css = await compileUtilities(classNames);
  const escaped = className.replace(/[.*+?^${}()|[\]\\:]/g, "\\$&");
  const rule = new RegExp(`\\.${escaped}(?::[a-z-]+)?(?:::[a-z-]+)?\\s*\\{([^}]*)\\}`).exec(css);
  return rule?.[1]?.replace(/\s+/g, " ").trim() ?? "";
}

function renderStacked(props: LogRowOverrides = {}) {
  const onClick = vi.fn();
  render(
    <ul>
      <FoodRow
        layout="stacked"
        nameSegments={[{ text: "Chicken breast, grilled", matched: false }]}
        caption="08:05 · 50 g"
        energy="222"
        macros={macros}
        onClick={onClick}
        {...props}
      />
    </ul>,
  );
  return { onClick };
}

function renderSearch(props: SearchRowOverrides = {}) {
  const onClick = vi.fn();
  const onAdd = vi.fn();
  render(
    <ul>
      <FoodRow
        layout="search"
        nameSegments={chickenBreast}
        caption="1 breast (150 g)"
        energy="222"
        macros={macros}
        onClick={onClick}
        onAdd={onAdd}
        {...props}
      />
    </ul>,
  );
  return { onClick, onAdd };
}

const rowName = /^Chicken\s*breast, grilled.*1 breast/;

const addName = describeAddFood("Chicken breast, grilled", "1 breast (150 g)");

afterEach(() => {
  cleanup();
});

describe("FoodRow stats line", () => {
  it("should write the energy with a muted kcal, then the macros in the order P, C, F", () => {
    renderStacked();

    const energy = screen.getByText("222");
    const protein = screen.getByText("48 P");
    const carbs = screen.getByText("0 C");
    const fat = screen.getByText("3.3 F");

    expect(energy.parentElement?.textContent).toBe("222 kcal");
    expect(screen.getByText("kcal").className).toContain("text-text-muted");
    expect(energy.compareDocumentPosition(protein) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(protein.compareDocumentPosition(carbs) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(carbs.compareDocumentPosition(fat) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("should be read in words, with the macros spelled out in the same order", () => {
    renderStacked();

    expect(screen.getByRole("button", { name: new RegExp(spokenStats) })).toBeTruthy();
  });

  it("should say Needs review in place of the macros when the food needs review", () => {
    renderStacked({ needsReview: true });

    expect(screen.getByText("Needs review")).toBeTruthy();
    expect(screen.queryByText("48 P")).toBeNull();
    expect(screen.queryByText("3.3 F")).toBeNull();
    expect(screen.getByText("222")).toBeTruthy();
    expect(screen.getByRole("button", { name: /222 kilocalories, Needs review/ })).toBeTruthy();
  });

  it("should write Needs review in the warning ink", () => {
    renderStacked({ needsReview: true });

    expect(screen.getByText("Needs review").className).toContain("text-warning-ink");
  });

  it("should say Needs review when the food has no macros at all", () => {
    renderStacked({ macros: undefined });

    expect(screen.getByText("Needs review")).toBeTruthy();
  });

  it("should wrap between its items and never inside one", async () => {
    renderStacked();

    const line = screen.getByText("48 P").parentElement;
    const lineClasses = line?.className ?? "";
    const itemClasses = screen.getByText("48 P").className;

    expect(await declarationsOf(lineClasses, "flex-wrap")).toBe("flex-wrap: wrap");
    expect(await declarationsOf(itemClasses, "whitespace-nowrap")).toBe("white-space: nowrap");
    expect(await declarationsOf(lineClasses, "gap-x-\\[10px\\]")).toBe("column-gap: 10px");
  });
});

describe("FoodRow stacked, for a logged recipe", () => {
  const recipeRowName =
    "18:00, Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams";

  function renderRecipe(props: LogRowOverrides = {}) {
    render(
      <ul>
        <FoodRow
          layout="stacked"
          nameSegments={[{ text: "Chicken and rice", matched: false }]}
          caption="18:00 · 1 serving (275 g)"
          energy="374"
          macros={{ ...macros, protein: "32", carbs: "43", fat: "8.1" }}
          recipeRowName={recipeRowName}
          {...props}
        />
      </ul>,
    );
  }

  it("should be named by the sentence it is given", () => {
    renderRecipe();

    expect(screen.getByRole("listitem", { name: recipeRowName })).toBeTruthy();
  });

  it("should put the chef's hat before the name, 16 px and muted", () => {
    renderRecipe();

    const row = screen.getByRole("listitem", { name: recipeRowName });
    const hat = row.querySelector("svg.lucide-chef-hat");

    expect(hat?.getAttribute("class")).toContain("size-4");
    expect(hat?.getAttribute("class")).toContain("text-text-muted");
    expect(hat?.nextElementSibling?.textContent).toBe("Chicken and rice");
  });

  it("should keep the name to one line, ending in an ellipsis", async () => {
    renderRecipe();

    const name = screen.getByText("Chicken and rice");

    expect(await declarationsOf(name.className, "truncate")).toContain("text-overflow: ellipsis");
  });

  it("should write the caption and the stats line as a food row does", () => {
    renderRecipe();

    expect(screen.getByText("18:00 · 1 serving (275 g)")).toBeTruthy();
    expect(screen.getByText("32 P")).toBeTruthy();
    expect(screen.getByText("43 C")).toBeTruthy();
    expect(screen.getByText("8.1 F")).toBeTruthy();
  });

  it("should draw no chef's hat on a food", () => {
    renderStacked();

    expect(screen.getByRole("listitem").querySelector("svg.lucide-chef-hat")).toBeNull();
  });
});

describe("FoodRow stacked", () => {
  it("should be one button naming the food, the time and amount and the stats", () => {
    renderStacked();

    expect(
      screen.getByRole("button", {
        name: new RegExp(`Chicken breast, grilled.*08:05 · 50 g.*${spokenStats}`),
      }),
    ).toBeTruthy();
  });

  it("should open when pressed", () => {
    const { onClick } = renderStacked();

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should be plain text with no button and no chevron when there is nothing to open", () => {
    renderStacked({ onClick: undefined });

    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.getByRole("listitem").textContent).toContain("Chicken breast, grilled");
    expect(screen.getByRole("listitem").querySelector("svg.lucide-chevron-right")).toBeNull();
  });

  it("should write the whole name in semibold, clamped to two lines", async () => {
    renderStacked();

    const title = screen.getByText("Chicken breast, grilled");

    expect(title.className).toContain("text-body-strong");
    expect(await declarationsOf(title.className, "line-clamp-2")).toContain(
      "-webkit-line-clamp: 2",
    );
  });

  it("should clamp the caption to one line", async () => {
    renderStacked();

    const caption = screen.getByText("08:05 · 50 g");

    expect(caption.className).toContain("text-text-muted");
    expect(await declarationsOf(caption.className, "truncate")).toContain(
      "text-overflow: ellipsis",
    );
  });

  it("should not carry a food icon tile or an add button", () => {
    renderStacked({ onAdd: vi.fn() });

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("should not respond while disabled", () => {
    const { onClick } = renderStacked({ disabled: true });

    const row = screen.getByRole("button");
    fireEvent.click(row);

    expect(row.getAttribute("aria-disabled")).toBe("true");
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("FoodRow search", () => {
  it("should be a row button and a separate add button, each named", () => {
    renderSearch();

    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(
      screen.getByRole("button", {
        name: new RegExp(`Chicken\\s*breast, grilled.*1 breast \\(150 g\\).*${spokenStats}`),
      }),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: addName })).toBeTruthy();
  });

  it("should not open the row when the add button is pressed", () => {
    const { onClick, onAdd } = renderSearch();

    fireEvent.click(screen.getByRole("button", { name: addName }));

    expect(onAdd).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should not add when the row is pressed", () => {
    const { onClick, onAdd } = renderSearch();

    fireEvent.click(screen.getByRole("button", { name: rowName }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("should keep the add button outside the row button", () => {
    renderSearch();

    const row = screen.getByRole("button", { name: rowName });

    expect(row.contains(screen.getByRole("button", { name: addName }))).toBe(false);
  });

  it("should make the add button itself a 44 px square", async () => {
    renderSearch();

    const { className } = screen.getByRole("button", { name: addName });

    expect(await declarationsOf(className, "h-control-md")).toBe(`height: ${controlHeight.md}px`);
    expect(await declarationsOf(className, "w-control-md")).toBe(`width: ${controlHeight.md}px`);
    expect(await declarationsOf(className, "min-w-touch-target")).toBe(
      `min-width: ${touchTarget}px`,
    );
    expect(controlHeight.md).toBe(touchTarget);
  });

  it("should write the matched parts of the name in bold", () => {
    renderSearch();

    expect(screen.getByText("Chicken").className).toContain("font-semibold");
    expect(screen.getByText(", grilled").className).toContain("font-normal");
  });

  it("should show the serving under the name", () => {
    renderSearch();

    expect(screen.getByText("1 breast (150 g)").className).toContain("text-text-muted");
  });

  it("should dim the add button without dimming or stopping the row when it is disabled", () => {
    const { onClick, onAdd } = renderSearch({ addDisabled: true });

    const add = screen.getByRole("button", { name: addName });
    fireEvent.click(add);
    fireEvent.click(screen.getByRole("button", { name: rowName }));

    expect(add.getAttribute("aria-disabled")).toBe("true");
    expect(add.className).toContain("opacity-50");
    expect(onAdd).not.toHaveBeenCalled();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should not dim the add button a second time when the whole row is dimmed", () => {
    renderSearch({ disabled: true, addDisabled: true });

    expect(screen.getByRole("button", { name: addName }).className).not.toContain("opacity-50");
    expect(screen.getByRole("listitem").className).toContain("opacity-50");
  });

  it("should stop both buttons when the row is disabled", () => {
    const { onClick, onAdd } = renderSearch({ disabled: true });

    fireEvent.click(screen.getByRole("button", { name: addName }));
    fireEvent.click(screen.getByRole("button", { name: rowName }));

    expect(onAdd).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should give a food that needs review a chevron and no add button", () => {
    const { onClick } = renderSearch({ needsReview: true });

    expect(screen.queryByRole("button", { name: addName })).toBeNull();
    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(screen.getByText("Needs review")).toBeTruthy();

    fireEvent.click(screen.getByRole("button"));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("should give the chevron of a food that needs review the add button's 44 px box", async () => {
    renderSearch({ needsReview: true });

    const chevronBox = screen.getByRole("button").lastElementChild;

    expect(chevronBox).not.toBeNull();
    const classNames = chevronBox?.className ?? "";
    expect(await declarationsOf(classNames, "h-control-md")).toBe(`height: ${controlHeight.md}px`);
    expect(await declarationsOf(classNames, "w-control-md")).toBe(`width: ${controlHeight.md}px`);
  });

  it("should have no add button when nothing adds the food", () => {
    renderSearch({ onAdd: undefined });

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("a stacked row with buttons at its end", () => {
  it("should hold the buttons beside the row, outside its press", () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    renderStacked({
      onClick,
      actions: (
        <button type="button" onClick={onRemove}>
          Remove Chicken breast, grilled
        </button>
      ),
    });

    fireEvent.click(screen.getByRole("button", { name: "Remove Chicken breast, grilled" }));

    expect(onRemove).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });

  it("should draw no buttons when none are given", () => {
    renderStacked();

    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});

describe("FoodRow search, for a recipe", () => {
  const recipeRowName =
    "Chicken and rice, recipe, 1 serving 275 grams, 374 kilocalories, protein 32 grams, carbohydrate 43 grams, fat 8.1 grams";
  const nameSegments = [
    { text: "Chicken", matched: true },
    { text: " and rice", matched: false },
  ];

  function renderRecipe(props: SearchRowOverrides = {}) {
    render(
      <ul>
        <FoodRow
          layout="search"
          nameSegments={nameSegments}
          caption="1 serving (275 g)"
          energy="374"
          macros={{ ...macros, protein: "32", carbs: "43", fat: "8.1" }}
          recipeRowName={recipeRowName}
          onAdd={() => undefined}
          {...props}
        />
      </ul>,
    );
  }

  it("should be named by the sentence it is given", () => {
    renderRecipe();

    expect(screen.getByRole("listitem", { name: recipeRowName })).toBeTruthy();
  });

  it("should draw the chef's hat tile, and not the food tile", () => {
    renderRecipe();

    const row = screen.getByRole("listitem", { name: recipeRowName });

    expect(row.querySelector("svg.lucide-chef-hat")?.getAttribute("class")).toContain("size-5");
    expect(row.querySelector("svg.lucide-utensils")).toBeNull();
  });

  it("should write the matched letters of the name semibold and the rest regular", () => {
    renderRecipe();

    expect(screen.getByText("Chicken").className).toContain("font-semibold");
    expect(screen.getByText("and rice", { exact: false }).className).toContain("font-normal");
  });

  it("should write the serving and the stats line as a food row does", () => {
    renderRecipe();

    expect(screen.getByText("1 serving (275 g)")).toBeTruthy();
    expect(screen.getByText("374")).toBeTruthy();
    expect(screen.getByText("32 P")).toBeTruthy();
  });

  it("should have only the plus to press, and no chevron, when it opens nothing", () => {
    renderRecipe();

    const row = screen.getByRole("listitem", { name: recipeRowName });

    expect(screen.getAllByRole("button")).toHaveLength(1);
    expect(row.querySelector("svg.lucide-chevron-right")).toBeNull();
  });

  it("should name the plus for the recipe and its serving, and log on a press of it", () => {
    const onAdd = vi.fn<() => void>();
    renderRecipe({ onAdd });

    fireEvent.click(
      screen.getByRole("button", {
        name: describeAddFood("Chicken and rice", "1 serving (275 g)"),
      }),
    );

    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("should ignore a press on the plus while it is off", () => {
    const onAdd = vi.fn<() => void>();
    renderRecipe({ onAdd, addDisabled: true });

    const plus = screen.getByRole("button", { name: /^Add Chicken and rice/ });
    fireEvent.click(plus);
    fireEvent.keyDown(plus, { key: "Enter" });

    expect(plus.getAttribute("aria-disabled")).toBe("true");
    expect(onAdd).not.toHaveBeenCalled();
  });
});
