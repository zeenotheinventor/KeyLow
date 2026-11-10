import { elevation } from "@keylow/tokens";
import { render, screen, within } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { GroupedList, ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";

import type { GroupedListProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";
import type { ReactNode } from "react";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const pressableRows = ["Chicken breast", "Chicken thigh", "Chicken liver"].map((title) => (
  <ListRow key={title} title={title} onPress={() => undefined} />
));

function renderList(
  props: Partial<GroupedListProps> = {},
  scheme: ThemeScheme = "dark",
  rows: ReactNode = pressableRows,
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <GroupedList source="UK CoFID" title="Common foods" {...props}>
        {rows}
      </GroupedList>
    </ThemeProvider>,
  );
}

function setReduceMotion(isEnabled: boolean): void {
  jest.spyOn(AccessibilityInfo, "isReduceMotionEnabled").mockResolvedValue(isEnabled);
}

describe("GroupedList", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    jest.useFakeTimers();
    registerAppStyles(kitStyles);
    setReduceMotion(false);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe("structure", () => {
    it("should head the group with its title and say where it comes from", async () => {
      await renderList();

      expect(screen.getByRole("heading", { name: "Common foods · UK CoFID" })).toBeOnTheScreen();
      expect(screen.getByText(" · UK CoFID")).toBeOnTheScreen();
    });

    it("should head the group with its title alone when there is no source", async () => {
      await renderList({ source: undefined });

      expect(screen.getByRole("heading", { name: "Common foods" })).toBeOnTheScreen();
      expect(screen.queryByText(/UK CoFID/)).not.toBeOnTheScreen();
    });

    it("should let the heading wrap at large text", async () => {
      await renderList();

      // The title shrinks and wraps when the row is short of room.
      expect(screen.getByRole("heading", { name: "Common foods · UK CoFID" })).toHaveStyle({
        flexShrink: 1,
      });
    });

    it("should hold its rows in a list named by the title", async () => {
      await renderList();

      // A list is not itself an accessibility element, or a screen reader could not reach its rows one by one.
      const list = screen.getByLabelText("Common foods");
      expect(list).toHaveProp("role", "list");
      expect(within(list).getAllByRole("button")).toHaveLength(3);
    });

    it("should name the list by its label, when it has one, and keep the title as the heading", async () => {
      await renderList({ title: "Your recipes", label: "Your recipes, values per serving" });

      expect(screen.getByLabelText("Your recipes, values per serving")).toBeOnTheScreen();
      expect(screen.getByRole("heading", { name: /^Your recipes/ })).toBeOnTheScreen();
    });

    it("should expose each row as a list item, keeping the row's own button role", async () => {
      await renderList();

      // A list item is not an accessibility element either, so a role query cannot see it and the items are
      // read off the list. It must stay that way: an accessible wrapper would fold the button inside it away
      // from a screen reader, which the test library does not model, so that is asserted on the prop.
      const items = screen
        .getByLabelText("Common foods")
        .children.filter((child) => typeof child !== "string");
      expect(items).toHaveLength(3);
      for (const item of items) {
        expect(item).toHaveProp("role", "listitem");
        expect(item).not.toHaveProp("accessible", true);
        expect(within(item).getAllByRole("button")).toHaveLength(1);
      }
    });

    it("should count the rows inside a fragment as list items, and skip empty children", async () => {
      await renderList(
        {},
        "dark",
        <>
          {null}
          <ListRow title="Chicken breast" onPress={() => undefined} />
          <>
            <ListRow title="Chicken thigh" onPress={() => undefined} />
            {false}
          </>
        </>,
      );

      const items = screen.getByLabelText("Common foods").children;
      expect(items).toHaveLength(2);
      for (const item of items) {
        expect(item).toHaveProp("role", "listitem");
      }
    });

    it("should show a notice between the heading and the card, outside the list", async () => {
      await renderList({ notice: <Text>Something to know</Text> });

      const notice = screen.getByText("Something to know");
      const list = screen.getByLabelText("Common foods");
      expect(within(list).queryByText("Something to know")).not.toBeOnTheScreen();
      // The notice sits in the group's column, after the heading and before the card.
      const column = list.parent;
      const children = column?.children ?? [];
      const noticeIndex = children.indexOf(notice);
      expect(noticeIndex).toBe(1);
      expect(children.indexOf(list)).toBe(2);
    });

    it("should draw no notice when none is given", async () => {
      await renderList();

      expect(screen.getByLabelText("Common foods").parent?.children).toHaveLength(2);
    });
  });

  describe("the card", () => {
    describe("in the dark scheme", () => {
      it("should be a card on the surface token with a border, rounded large, clipping its rows", async () => {
        await renderList({}, "dark");

        expect(await screen.findByLabelText("Common foods")).toHaveStyle({
          backgroundColor: resolvedColor("dark", "surface"),
          borderColor: resolvedColor("dark", "border"),
          borderWidth: 1,
          borderRadius: 20,
          overflow: "hidden",
        });
      });

      it("should draw the card elevation from the token", async () => {
        await renderList({}, "dark");

        expect(await screen.findByLabelText("Common foods")).toHaveStyle({
          boxShadow: elevation.dark.card,
        });
      });
    });
  });

  describe("dividers", () => {
    it("should put no line above the first row", async () => {
      await renderList();

      expect(screen.getByRole("button", { name: "Chicken breast" }).props.style).not.toHaveProperty(
        "borderTopWidth",
      );
    });

    it("should count the rows that are there, skipping empty children", async () => {
      await renderList({}, "dark", [
        null,
        <ListRow key="first" title="Chicken breast" onPress={() => undefined} />,
        false,
        <ListRow key="second" title="Chicken thigh" onPress={() => undefined} />,
      ]);

      expect(screen.getByRole("button", { name: "Chicken breast" }).props.style).not.toHaveProperty(
        "borderTopWidth",
      );
      expect(screen.getByRole("button", { name: "Chicken thigh" })).toHaveStyle({
        borderTopWidth: 1,
      });
    });

    it("should count the rows inside a fragment as rows of the list", async () => {
      await renderList(
        {},
        "dark",
        <>
          <ListRow title="Chicken breast" onPress={() => undefined} />
          <>
            <ListRow title="Chicken thigh" onPress={() => undefined} />
            <ListRow title="Chicken liver" onPress={() => undefined} />
          </>
        </>,
      );

      expect(screen.getByRole("button", { name: "Chicken breast" }).props.style).not.toHaveProperty(
        "borderTopWidth",
      );
      expect(screen.getByRole("button", { name: "Chicken thigh" })).toHaveStyle({
        borderTopWidth: 1,
      });
      expect(screen.getByRole("button", { name: "Chicken liver" })).toHaveStyle({
        borderTopWidth: 1,
      });
    });

    it.each(["Chicken thigh", "Chicken liver"])(
      "should put a hairline above %s, which comes after another row",
      async (name) => {
        await renderList();

        expect(screen.getByRole("button", { name })).toHaveStyle({
          borderTopWidth: 1,
          borderColor: resolvedColor("dark", "border"),
        });
      },
    );
  });

  describe("typography in the dark scheme", () => {
    it("should write the title as body strong in the primary text colour", async () => {
      await renderList({}, "dark");

      expect(await screen.findByRole("heading", { name: "Common foods · UK CoFID" })).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should write the source as a muted caption", async () => {
      await renderList({}, "dark");

      expect(await screen.findByText(" · UK CoFID")).toHaveStyle({
        color: resolvedColor("dark", "text-muted"),
        fontFamily: "Geist-Medium",
        fontSize: 12,
        lineHeight: 16,
      });
    });
  });
});
