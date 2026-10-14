import { elevation } from "@keylow/tokens";
import { act, fireEvent, render, screen, userEvent, within } from "@testing-library/react-native";
import { AccessibilityInfo, Text } from "react-native";
import { setUpTests } from "react-native-reanimated";

import { GroupedList, ListRow } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { animatedScale } from "../support/animatedStyle";
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

// Rows that go nowhere have no press feedback of their own, so a test of the See more press sees only its own.
const staticRows = [<ListRow key="only" title="Chicken breast" />];

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

async function advance(milliseconds: number) {
  await act(() => {
    jest.advanceTimersByTime(milliseconds);
  });
}

const schemes: ThemeScheme[] = ["dark", "light"];

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

    it("should let the heading wrap, so See more stays on the screen at large text", async () => {
      await renderList({ seeMore: { hiddenCount: 8, onPress: () => undefined } });

      // The title shrinks and wraps when the row is short of room, and See more keeps its width.
      expect(screen.getByRole("heading", { name: "Common foods · UK CoFID" })).toHaveStyle({
        flexShrink: 1,
      });
      expect(
        screen.getByRole("button", { name: "See 8 more in Common foods" }).parent,
      ).not.toHaveStyle({
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
    describe.each(schemes)("in the %s scheme", (scheme) => {
      it("should be a card on the surface token with a border, rounded large, clipping its rows", async () => {
        await renderList({}, scheme);

        expect(await screen.findByLabelText("Common foods")).toHaveStyle({
          backgroundColor: resolvedColor(scheme, "surface"),
          borderColor: resolvedColor(scheme, "border"),
          borderWidth: 1,
          borderRadius: 20,
          overflow: "hidden",
        });
      });

      it("should draw the card elevation from the token", async () => {
        await renderList({}, scheme);

        expect(await screen.findByLabelText("Common foods")).toHaveStyle({
          boxShadow: elevation[scheme].card,
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

  describe("See more", () => {
    it("should offer the rows that are not shown, saying how many and in which group", async () => {
      await renderList({ seeMore: { hiddenCount: 2, onPress: () => undefined } });

      expect(screen.getByRole("button", { name: "See 2 more in Common foods" })).toBeOnTheScreen();
      expect(screen.getByText("See 2 more")).toBeOnTheScreen();
    });

    it("should call its callback when pressed", async () => {
      const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
      const onPress = jest.fn();
      await renderList({ seeMore: { hiddenCount: 2, onPress } });

      await user.press(screen.getByRole("button", { name: "See 2 more in Common foods" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should offer nothing when no row is hidden", async () => {
      await renderList({ seeMore: { hiddenCount: 0, onPress: () => undefined } });

      expect(screen.queryByText(/See/)).not.toBeOnTheScreen();
    });

    it("should offer nothing unless asked to", async () => {
      await renderList();

      expect(screen.queryByText(/See/)).not.toBeOnTheScreen();
    });

    it("should reach a 44 point touch target from its 20 point line, 4 points wider each side", async () => {
      await renderList({ seeMore: { hiddenCount: 2, onPress: () => undefined } });

      expect(screen.getByRole("button", { name: "See 2 more in Common foods" })).toHaveProp(
        "hitSlop",
        { top: 12, bottom: 12, left: 4, right: 4 },
      );
    });

    it("should compress, show the overlay and spring back, as every pressable does", async () => {
      await renderList(
        { seeMore: { hiddenCount: 2, onPress: () => undefined } },
        "dark",
        staticRows,
      );
      const seeMore = screen.getByRole("button", { name: "See 2 more in Common foods" });

      await fireEvent(seeMore, "pressIn");
      await advance(1000);
      expect(animatedScale(screen.getByTestId("press-scale"))).toBeCloseTo(0.96, 3);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();

      await fireEvent(seeMore, "pressOut");
      await advance(1000);
      expect(animatedScale(screen.getByTestId("press-scale"))).toBeCloseTo(1, 3);
    });

    it("should not compress when the user has reduced motion on, and still show the overlay", async () => {
      setReduceMotion(true);
      await renderList(
        { seeMore: { hiddenCount: 2, onPress: () => undefined } },
        "dark",
        staticRows,
      );
      await advance(100);

      await fireEvent(
        screen.getByRole("button", { name: "See 2 more in Common foods" }),
        "pressIn",
      );
      await advance(1000);

      expect(animatedScale(screen.getByTestId("press-scale"))).toBe(1);
      expect(screen.getByTestId("press-overlay")).toBeOnTheScreen();
    });
  });

  describe.each(schemes)("typography in the %s scheme", (scheme) => {
    it("should write the title as body strong in the primary text colour", async () => {
      await renderList({}, scheme);

      expect(await screen.findByRole("heading", { name: "Common foods · UK CoFID" })).toHaveStyle({
        color: resolvedColor(scheme, "text-primary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 16,
        lineHeight: 24,
      });
    });

    it("should write the source as a muted caption", async () => {
      await renderList({}, scheme);

      expect(await screen.findByText(" · UK CoFID")).toHaveStyle({
        color: resolvedColor(scheme, "text-muted"),
        fontFamily: "Geist-Medium",
        fontSize: 12,
        lineHeight: 16,
      });
    });

    it("should write See more at 14 over 20, semibold, in the secondary text colour", async () => {
      await renderList({ seeMore: { hiddenCount: 2, onPress: () => undefined } }, scheme);

      expect(await screen.findByText("See 2 more")).toHaveStyle({
        color: resolvedColor(scheme, "text-secondary"),
        fontFamily: "Geist-SemiBold",
        fontSize: 14,
        lineHeight: 20,
      });
    });
  });
});
