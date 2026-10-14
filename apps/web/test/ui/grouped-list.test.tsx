import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GroupedList } from "@/components/ui/GroupedList";
import { ListRow } from "@/components/ui/ListRow";

describe("GroupedList", () => {
  afterEach(() => {
    cleanup();
  });

  it("should be a section named by its title", () => {
    render(
      <GroupedList title="Common foods">
        <ListRow title="Apples" />
      </GroupedList>,
    );

    expect(screen.getByRole("region", { name: "Common foods" })).toBeTruthy();
  });

  it("should head the section with a level two heading", () => {
    render(
      <GroupedList title="Common foods">
        <ListRow title="Apples" />
      </GroupedList>,
    );

    expect(screen.getByRole("heading", { level: 2, name: "Common foods" })).toBeTruthy();
  });

  it("should name the source in the heading when it has one", () => {
    render(
      <GroupedList title="Common foods" source="UK CoFID">
        <ListRow title="Apples" />
      </GroupedList>,
    );

    // The space before the dot sits at the start of an inline element, which the test library's
    // name computation drops. Browsers keep it.
    expect(
      screen.getByRole("heading", { level: 2, name: /^Common foods\s*· UK CoFID$/ }),
    ).toBeTruthy();
    expect(screen.getByRole("region", { name: "Common foods" })).toBeTruthy();
  });

  it("should list its rows in a list", () => {
    render(
      <GroupedList title="Common foods">
        <ListRow title="Apples" />
        <ListRow title="Pears" />
      </GroupedList>,
    );

    const list = within(screen.getByRole("region", { name: "Common foods" })).getByRole("list");

    expect(within(list).getAllByRole("listitem")).toHaveLength(2);
  });

  describe("see more", () => {
    it("should offer to show the rows that are hidden", () => {
      const onClick = vi.fn();
      render(
        <GroupedList title="Common foods" seeMore={{ hiddenCount: 2, onClick }}>
          <ListRow title="Apples" />
        </GroupedList>,
      );

      fireEvent.click(screen.getByRole("button", { name: "See 2 more in Common foods" }));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it("should say how many rows are hidden", () => {
      render(
        <GroupedList title="Common foods" seeMore={{ hiddenCount: 2, onClick: () => undefined }}>
          <ListRow title="Apples" />
        </GroupedList>,
      );

      expect(screen.getByRole("button").textContent).toContain("See 2 more");
    });

    it("should offer nothing when no rows are hidden", () => {
      render(
        <GroupedList title="Common foods" seeMore={{ hiddenCount: 0, onClick: () => undefined }}>
          <ListRow title="Apples" />
        </GroupedList>,
      );

      expect(screen.queryByRole("button")).toBeNull();
    });

    it("should offer nothing unless asked", () => {
      render(
        <GroupedList title="Common foods">
          <ListRow title="Apples" />
        </GroupedList>,
      );

      expect(screen.queryByRole("button")).toBeNull();
    });
  });
});
