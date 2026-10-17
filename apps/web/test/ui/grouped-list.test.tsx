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

  it("should be named by its label, when it has one, and still be headed by its title", () => {
    render(
      <GroupedList
        title="Your recipes"
        source="Per serving"
        label="Your recipes, values per serving"
      >
        <ListRow title="Chicken and rice" />
      </GroupedList>,
    );

    expect(screen.getByRole("region", { name: "Your recipes, values per serving" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { level: 2, name: /^Your recipes\s*· Per serving$/ }),
    ).toBeTruthy();
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

  describe("header size", () => {
    // The header is the heading's wrapper. Its 32 px minimum is the room the See more button needs.
    function headerOf(title: string) {
      return screen.getByRole("heading", { level: 2, name: title }).parentElement;
    }

    it("should hold the header at 32 px by default", () => {
      render(
        <GroupedList title="Common foods">
          <ListRow title="Apples" />
        </GroupedList>,
      );

      expect(headerOf("Common foods")?.className).toContain("min-h-[32px]");
    });

    it("should let a compact header fall to the height of its heading", () => {
      render(
        <GroupedList title="Food" headerSize="compact">
          <ListRow title="Apples" />
        </GroupedList>,
      );

      expect(headerOf("Food")?.className).not.toContain("min-h-[32px]");
    });
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

  describe("notice", () => {
    it("should sit inside the section, between the heading and the rows", () => {
      render(
        <GroupedList title="From Open Food Facts" notice={<p>This product could not be added</p>}>
          <ListRow title="Apples" />
        </GroupedList>,
      );

      const section = screen.getByRole("region", { name: "From Open Food Facts" });
      const notice = within(section).getByText("This product could not be added");
      const heading = within(section).getByRole("heading", { level: 2 });
      const list = within(section).getByRole("list");
      expect(
        heading.compareDocumentPosition(notice) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
      expect(notice.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("should add nothing unless asked", () => {
      render(
        <GroupedList title="Common foods">
          <ListRow title="Apples" />
        </GroupedList>,
      );

      expect(screen.queryByRole("alert")).toBeNull();
      expect(screen.queryByRole("status")).toBeNull();
    });
  });
});
