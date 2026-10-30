import { SESSION_ACTIVE, describeSetColumns } from "@keylow/core/copy";
import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SetTableEntryRow, SetTableLoggedRow, SetTableRow } from "@/components/train/SetTable";

import { SetTable } from "@/components/train/SetTable";

const loggedRow = (overrides: Partial<SetTableLoggedRow> = {}): SetTableLoggedRow => ({
  key: "set-1",
  state: "done",
  setType: "working",
  label: "1",
  previous: "170 × 12",
  load: "180",
  reps: "12",
  rir: "1",
  checkName: "Set 1 logged, 180 kilograms, 12 reps, RIR 1, undo",
  onCheck: () => undefined,
  ...overrides,
});

const entryRow = (overrides: Partial<SetTableEntryRow> = {}): SetTableEntryRow => ({
  key: "planned-3",
  state: "next",
  setType: "working",
  label: "3",
  previous: "170 × 10",
  checkName: "Log set 3, 180 kilograms, 11 reps",
  fields: {
    load: {
      name: "Leg press, set 3, kilograms",
      value: "180",
      invalid: false,
      onChange: () => undefined,
    },
    reps: {
      name: "Leg press, set 3, reps",
      value: "11",
      invalid: false,
      onChange: () => undefined,
    },
    rir: { name: "Leg press, set 3, RIR", value: "", invalid: false, onChange: () => undefined },
  },
  errors: [],
  onCheck: () => undefined,
  ...overrides,
});

const renderTable = (rows: readonly SetTableRow[]) =>
  render(<SetTable columns={describeSetColumns("kg")} rows={rows} />);

describe("the set table", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a table of sets with the column headings of the board", () => {
    renderTable([loggedRow()]);

    const table = screen.getByRole("table", { name: SESSION_ACTIVE.setsListName });
    expect(
      within(table)
        .getAllByRole("columnheader")
        .map((heading) => heading.textContent),
    ).toEqual(["Set", "Previous", "kg", "Reps", "RIR", SESSION_ACTIVE.loggedColumnName]);
  });

  it("should head the load column with the unit of the person", () => {
    render(<SetTable columns={describeSetColumns("lb")} rows={[loggedRow()]} />);

    expect(screen.getByRole("columnheader", { name: "lb" })).toBeTruthy();
  });

  it("should draw a logged set's numbers as text with a check that takes it back", async () => {
    const onCheck = vi.fn();
    renderTable([loggedRow({ onCheck })]);

    const row = screen.getByRole("row", { name: /^1 170 × 12 180 12 1/ });
    expect(within(row).getByRole("cell", { name: "180" })).toBeTruthy();
    expect(within(row).queryByRole("textbox")).toBeNull();
    await userEvent.click(
      within(row).getByRole("button", {
        name: "Set 1 logged, 180 kilograms, 12 reps, RIR 1, undo",
      }),
    );

    expect(onCheck).toHaveBeenCalledOnce();
  });

  it("should leave the check of a set still being saved with nothing to do", () => {
    renderTable([loggedRow({ onCheck: undefined })]);

    expect(screen.getByRole<HTMLButtonElement>("button", { name: /undo$/ }).disabled).toBe(true);
  });

  it("should draw a set still to log as three fields holding its numbers", () => {
    renderTable([entryRow()]);

    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Leg press, set 3, kilograms" }).value,
    ).toBe("180");
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Leg press, set 3, reps" }).value,
    ).toBe("11");
    expect(
      screen.getByRole<HTMLInputElement>("textbox", { name: "Leg press, set 3, RIR" }).value,
    ).toBe("");
  });

  it("should tell the screen what is typed in a field", async () => {
    const onChange = vi.fn();
    const row = entryRow();
    renderTable([
      { ...row, fields: { ...row.fields, reps: { ...row.fields.reps, value: "", onChange } } },
    ]);

    await userEvent.type(screen.getByRole("textbox", { name: "Leg press, set 3, reps" }), "9");

    expect(onChange).toHaveBeenCalledWith("9");
  });

  it("should log from the check of a set still to log", async () => {
    const onCheck = vi.fn();
    renderTable([entryRow({ onCheck })]);

    await userEvent.click(
      screen.getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
    );

    expect(onCheck).toHaveBeenCalledOnce();
  });

  it("should move on to the next field with Enter, and from the last field to the check", async () => {
    renderTable([entryRow()]);

    await userEvent.type(
      screen.getByRole("textbox", { name: "Leg press, set 3, kilograms" }),
      "{Enter}",
    );
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Leg press, set 3, reps" }),
    );
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      screen.getByRole("textbox", { name: "Leg press, set 3, RIR" }),
    );
    await userEvent.keyboard("{Enter}");
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
    );
  });

  it("should press the check with Space", async () => {
    const onCheck = vi.fn();
    renderTable([entryRow({ onCheck })]);

    screen.getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }).focus();
    await userEvent.keyboard(" ");

    expect(onCheck).toHaveBeenCalledOnce();
  });

  it("should follow the table's order with Tab: set after set, field after field, then the check", async () => {
    const second = entryRow({ key: "planned-4", label: "4", checkName: "Log set 4" });
    renderTable([
      entryRow(),
      {
        ...second,
        fields: {
          load: { ...second.fields.load, name: "Leg press, set 4, kilograms" },
          reps: { ...second.fields.reps, name: "Leg press, set 4, reps" },
          rir: { ...second.fields.rir, name: "Leg press, set 4, RIR" },
        },
      },
    ]);

    const order = [
      screen.getByRole("textbox", { name: "Leg press, set 3, kilograms" }),
      screen.getByRole("textbox", { name: "Leg press, set 3, reps" }),
      screen.getByRole("textbox", { name: "Leg press, set 3, RIR" }),
      screen.getByRole("button", { name: "Log set 3, 180 kilograms, 11 reps" }),
      screen.getByRole("textbox", { name: "Leg press, set 4, kilograms" }),
    ];
    for (const control of order) {
      await userEvent.tab();
      expect(document.activeElement).toBe(control);
    }
  });

  it("should say under the row what rule its fields break and flag those fields", () => {
    const row = entryRow();
    renderTable([
      {
        ...row,
        errors: ["Enter a load from 0 to 1,000 kg."],
        fields: { ...row.fields, load: { ...row.fields.load, invalid: true } },
      },
    ]);

    const field = screen.getByRole("textbox", { name: "Leg press, set 3, kilograms" });
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByRole("alert").textContent).toBe("Enter a load from 0 to 1,000 kg.");
    expect(field.getAttribute("aria-describedby")).toBe(screen.getByRole("alert").id);
    expect(
      screen.getByRole("textbox", { name: "Leg press, set 3, reps" }).getAttribute("aria-invalid"),
    ).toBe("false");
  });
});
