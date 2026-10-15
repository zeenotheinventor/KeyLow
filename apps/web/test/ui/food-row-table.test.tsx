import { controlHeight, touchTarget } from "@keylow/tokens";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { compileUtilities } from "./compileUtilities";

import type { FoodTableRowProps } from "@/components/ui/FoodRow";

import { FoodRow } from "@/components/ui/FoodRow";
import { FoodTable } from "@/components/ui/FoodTable";

// jsdom has no layout, so a size or a rule is read from the CSS the classes compile to.
async function compiled(classNames: string): Promise<string> {
  return (await compileUtilities(classNames)).replace(/\s+/g, " ");
}

const porridge: FoodTableRowProps = {
  layout: "table",
  nameSegments: [{ text: "Porridge oats", matched: false }],
  caption: "08:05 · 50 g",
  energy: "187",
  macros: { protein: "5.6", carbs: "27", fat: "3.4" },
  onEdit: () => undefined,
  onDelete: () => undefined,
};

function renderTable(props: Partial<FoodTableRowProps> = {}) {
  const onEdit = vi.fn();
  const onDelete = vi.fn();
  render(
    <FoodTable label="Foods at 08:00">
      <FoodRow {...porridge} onEdit={onEdit} onDelete={onDelete} {...props} />
    </FoodTable>,
  );
  return { onEdit, onDelete };
}

afterEach(() => {
  cleanup();
});

describe("FoodTableHeader", () => {
  it("should head the columns Food, Protein, Carbs, Fat and kcal, then the actions, in that order", () => {
    renderTable();

    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Food",
      "Protein",
      "Carbs",
      "Fat",
      "kcal",
      "Actions",
    ]);
  });

  it("should hide the heading of the actions column from sight and not from assistive technology", () => {
    renderTable();

    const heading = screen.getByRole("columnheader", { name: "Actions" });

    expect(heading.className).toContain("sr-only");
  });

  it("should have as many headings as the row has cells", () => {
    renderTable();

    const [headerRow, foodRow] = screen.getAllByRole("row") as [HTMLElement, HTMLElement];

    expect(within(headerRow).getAllByRole("columnheader")).toHaveLength(
      within(foodRow).getAllByRole("cell").length,
    );
  });

  it("should be the table's first row", () => {
    renderTable();

    const [headerRow, foodRow] = screen.getAllByRole("row");

    expect(within(headerRow as HTMLElement).getAllByRole("columnheader")).toHaveLength(6);
    expect(within(foodRow as HTMLElement).queryAllByRole("columnheader")).toHaveLength(0);
  });

  it("should use the same column widths as the rows, so the columns line up", async () => {
    renderTable();

    const [headerRow, foodRow] = screen.getAllByRole("row");
    const columns = "grid-cols-[minmax(0,1fr)_64px_64px_64px_96px_80px]";

    expect(headerRow?.className).toContain(columns);
    expect(foodRow?.className).toContain(columns);
    expect(await compiled(columns)).toContain(
      "grid-template-columns: minmax(0,1fr) 64px 64px 64px 96px 80px",
    );
  });
});

describe("FoodTable", () => {
  it("should be a table named by its label", () => {
    renderTable();

    expect(screen.getByRole("table", { name: "Foods at 08:00" })).toBeTruthy();
  });

  it("should hold the heading row, then the rows it is given", () => {
    renderTable();

    const table = screen.getByRole("table", { name: "Foods at 08:00" });
    const rows = within(table).getAllByRole("row");

    expect(rows).toHaveLength(2);
    expect(within(rows[0] as HTMLElement).getAllByRole("columnheader")).toHaveLength(6);
  });

  it("should hide as a whole at the narrow width, so no table without headings is left", async () => {
    renderTable();

    const { className } = screen.getByRole("table", { name: "Foods at 08:00" });
    const css = await compiled(className);

    expect(className).toContain("max-md:hidden");
    expect(css).toMatch(
      /@media not all and \(min-width: 768px\) \{ \.max-md\\:hidden \{ display: none/,
    );
  });
});

describe("FoodRow table, with values not given", () => {
  it("should write a macro that is not given as a dash with no unit", () => {
    renderTable({ macros: { protein: "5.6", carbs: null, fat: null } });

    const row = within(screen.getByRole("row", { name: /Porridge oats/ }));

    expect(row.getAllByRole("cell").map((cell) => cell.textContent)).toEqual([
      "Porridge oats08:05 · 50 g",
      "5.6 g",
      "–",
      "–",
      "187 kcal",
      "",
    ]);
  });

  it("should call a dash not given for a screen reader", () => {
    renderTable({ macros: { protein: "5.6", carbs: null, fat: null } });

    expect(screen.getAllByRole("cell", { name: "not given" })).toHaveLength(2);
  });

  it("should write energy that is not given as a dash with no unit", () => {
    renderTable({ energy: undefined });

    expect(screen.getByRole("cell", { name: "not given" }).textContent).toBe("–");
  });
});

describe("FoodRow table, without an edit to open", () => {
  it("should draw Delete and no Edit button when it is not given onEdit", () => {
    render(
      <FoodTable label="Foods at 08:00">
        <FoodRow {...porridge} onEdit={undefined} />
      </FoodTable>,
    );

    expect(screen.queryByRole("button", { name: "Edit Porridge oats" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete Porridge oats" })).toBeTruthy();
  });
});

describe("FoodRow table", () => {
  it("should be a row of cells", () => {
    renderTable();

    const row = screen.getAllByRole("row")[1] as HTMLElement;

    expect(within(row).getAllByRole("cell")).toHaveLength(6);
  });

  it("should write the name and the time and amount in the first cell", () => {
    renderTable();

    const row = screen.getAllByRole("row")[1] as HTMLElement;
    const [nameCell] = within(row).getAllByRole("cell");

    expect(nameCell?.textContent).toBe("Porridge oats08:05 · 50 g");
  });

  it("should write the macros in the order protein, carbs, fat, then the energy", () => {
    renderTable();

    const row = screen.getAllByRole("row")[1] as HTMLElement;
    const cells = within(row).getAllByRole("cell");

    expect(cells.slice(1, 5).map((cell) => cell.textContent)).toEqual([
      "5.6 g",
      "27 g",
      "3.4 g",
      "187 kcal",
    ]);
  });

  it("should right-align and tabulate the number columns", () => {
    renderTable();

    const row = screen.getAllByRole("row")[1] as HTMLElement;
    const cells = within(row).getAllByRole("cell");

    for (const cell of cells.slice(1, 4)) {
      expect(cell.className).toContain("text-right");
      expect(cell.className).toContain("tabular-nums");
    }
  });

  it("should clamp a long name to two lines and the time and amount to one", async () => {
    renderTable({
      nameSegments: [{ text: "A very long name ".repeat(12), matched: false }],
    });

    const title = screen.getByText(/A very long name/);
    const caption = screen.getByText("08:05 · 50 g");

    expect(await compiled(title.className)).toContain("-webkit-line-clamp: 2");
    expect(await compiled(caption.className)).toContain("text-overflow: ellipsis");
  });

  it("should take the hover overlay when hovered or when something inside has focus", async () => {
    renderTable();

    const row = screen.getAllByRole("row")[1] as HTMLElement;
    const css = await compiled(row.className);

    expect(css).toMatch(/\.hover\\:bg-hover-overlay:hover \{ background-color/);
    expect(css).toMatch(/\.focus-within\\:bg-hover-overlay:focus-within \{ background-color/);
  });

  describe("Edit and Delete", () => {
    it("should be named for the food", () => {
      renderTable();

      expect(screen.getByRole("button", { name: "Edit Porridge oats" })).toBeTruthy();
      expect(screen.getByRole("button", { name: "Delete Porridge oats" })).toBeTruthy();
    });

    it("should report which one was pressed", () => {
      const { onEdit, onDelete } = renderTable();

      fireEvent.click(screen.getByRole("button", { name: "Edit Porridge oats" }));
      expect(onEdit).toHaveBeenCalledTimes(1);
      expect(onDelete).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Delete Porridge oats" }));
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("should stay reachable by keyboard while they are not shown", () => {
      renderTable();

      for (const name of ["Edit Porridge oats", "Delete Porridge oats"]) {
        const button = screen.getByRole("button", { name });

        expect(button.tabIndex).toBe(0);
        expect(button.closest("[aria-hidden=true]")).toBeNull();
        expect(button.closest(".invisible, .hidden")).toBeNull();
      }
    });

    it("should be shown on hover and on focus within the row, and not before", async () => {
      renderTable();

      const actions = screen.getByRole("button", { name: "Edit Porridge oats" }).parentElement;
      const classNames = actions?.className ?? "";
      const css = await compiled(classNames);

      expect(css).toMatch(/\.opacity-0 \{ opacity: 0 \}/);
      expect(css).toMatch(
        /\.group\\\/row:hover \.group-hover\\\/row\\:opacity-100 \{ opacity: 1 \}/,
      );
      expect(css).toMatch(
        /\.group\\\/row:focus-within \.group-focus-within\\\/row\\:opacity-100 \{ opacity: 1 \}/,
      );
    });

    it("should only be revealed by its own row, not by any group around it", () => {
      renderTable();

      const row = screen.getAllByRole("row")[1] as HTMLElement;
      const actions = screen.getByRole("button", { name: "Edit Porridge oats" }).parentElement;

      expect(row.className.split(" ")).toContain("group/row");
      expect(actions?.className.split(" ")).not.toContain("group-hover:opacity-100");
      expect(actions?.className.split(" ")).not.toContain("group-focus-within:opacity-100");
    });

    it("should always be shown where there is no hover, as on a touch screen", async () => {
      renderTable();

      const actions = screen.getByRole("button", { name: "Edit Porridge oats" }).parentElement;
      const css = await compiled(actions?.className ?? "");
      expect(css).toMatch(/@media ?\(hover: ?none\) \{[^}]*\{ opacity: 1 \}/);
      // It must come after the opacity-0 rule, or that rule would win.
      expect(css.search(/@media ?\(hover: ?none\)/)).toBeGreaterThan(css.indexOf(".opacity-0"));
    });

    it("should each be a 44 px target", async () => {
      renderTable();

      for (const name of ["Edit Porridge oats", "Delete Porridge oats"]) {
        const { className } = screen.getByRole("button", { name });
        const css = await compiled(className);

        expect(css).toContain(`height: ${controlHeight.md}px`);
        expect(css).toContain(`width: ${controlHeight.md}px`);
        expect(css).toContain(`min-width: ${touchTarget}px`);
        expect(className).not.toMatch(/\bsize-(control|touch)/);
        expect(controlHeight.md).toBe(touchTarget);
      }
    });
  });
});
