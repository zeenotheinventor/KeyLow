import { themes } from "@keylow/tokens";
import { render, screen, userEvent } from "@testing-library/react-native";
import { setUpTests } from "react-native-reanimated";

import { AssistantActionCard } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { AssistantActionCardProps } from "../../components/ui";
import type { ThemeScheme } from "@keylow/tokens";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

setUpTests();

const schemes: ThemeScheme[] = ["dark", "light"];

const eggsAndToastRows = [
  { name: "Egg, boiled", detail: "2 large eggs (100 g) · 08:10", value: "144 kcal" },
  { name: "Toast, white bread", detail: "1 slice (30 g) · 08:10", value: "88 kcal" },
];

async function renderCard(
  props: Partial<AssistantActionCardProps> = {},
  scheme: ThemeScheme = "dark",
) {
  return render(
    <ThemeProvider fixedPreference={scheme}>
      <AssistantActionCard
        icon="Check"
        title="Logged 2 eggs and toast at 08:10"
        undo={{ state: "available", label: "Undo", onPress: () => undefined }}
        {...props}
      />
    </ThemeProvider>,
  );
}

// The badges are 20 point pills with no role of their own, so they are found by the look they are drawn
// with, as the badge's own tests do. The tile icon is 20 points high too, so the pill's radius tells them apart.
const badgesDrawn = (style: Record<string, unknown> = {}) =>
  viewsDrawn({ height: 20, borderRadius: 999, ...style });

describe("AssistantActionCard", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  describe("the words", () => {
    it("should draw the title, the subtitle, the total and the note as given", async () => {
      await renderCard({
        subtitle: "Saturday 24 October to today · 1,940 kcal",
        total: "232 kcal · P 15 g · C 17 g · F 10 g",
        note: "If it was more or less, change it in the diary.",
      });

      expect(screen.getByText("Logged 2 eggs and toast at 08:10")).toBeOnTheScreen();
      expect(screen.getByText("Saturday 24 October to today · 1,940 kcal")).toBeOnTheScreen();
      expect(screen.getByText("232 kcal · P 15 g · C 17 g · F 10 g")).toBeOnTheScreen();
      expect(screen.getByText("If it was more or less, change it in the diary.")).toBeOnTheScreen();
    });

    it("should draw no subtitle, total or note when none is given", async () => {
      await renderCard();

      expect(screen.queryByText(/kcal/)).not.toBeOnTheScreen();
      expect(screen.queryByText(/diary/)).not.toBeOnTheScreen();
    });

    it("should draw a row's name, detail and value exactly as given, never reformatting an amount", async () => {
      await renderCard({
        rows: [
          { name: "Porridge oats", detail: "0.50 kg · 1,000.0 g · 08:00", value: "1,940.50 kcal" },
          { name: "Per bar", detail: "P 20 g · C 19 g · F 6 g", value: "210 kcal" },
        ],
      });

      expect(screen.getByText("Porridge oats")).toBeOnTheScreen();
      expect(screen.getByText("0.50 kg · 1,000.0 g · 08:00")).toBeOnTheScreen();
      expect(screen.getByText("1,940.50 kcal")).toBeOnTheScreen();
      expect(screen.getByText("P 20 g · C 19 g · F 6 g")).toBeOnTheScreen();
      expect(screen.getByText("210 kcal")).toBeOnTheScreen();
    });

    it("should draw a row with no value", async () => {
      await renderCard({ rows: [{ name: "1 lemon", detail: "Lemon, whole · UK CoFID" }] });

      expect(screen.getByText("1 lemon")).toBeOnTheScreen();
      expect(screen.getByText("Lemon, whole · UK CoFID")).toBeOnTheScreen();
    });
  });

  describe("the Undo action", () => {
    it("should be a button named by the label it is given, which calls onPress once", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ undo: { state: "available", label: "Undo", onPress } });

      await user.press(screen.getByRole("button", { name: "Undo" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should not be busy while it is available", async () => {
      await renderCard();

      expect(screen.queryByRole("button", { name: "Undo", busy: true })).not.toBeOnTheScreen();
    });

    it("should be a busy button when busy, and do nothing on a press or a second press", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ undo: { state: "busy", label: "Undo", onPress } });

      const undo = screen.getByRole("button", { name: "Undo", busy: true });
      await user.press(undo);
      await user.press(undo);

      expect(onPress).not.toHaveBeenCalled();
    });

    it("should draw no Undo and no Can't undo when it is done", async () => {
      await renderCard({ title: "Undone", undo: { state: "done", label: "Undo" } });

      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
      expect(screen.queryByText("Undo")).not.toBeOnTheScreen();
      expect(screen.queryByText("Can't undo")).not.toBeOnTheScreen();
    });

    it("should draw the label as plain words, not a button, when it is unavailable", async () => {
      await renderCard({ undo: { state: "unavailable", label: "Can't undo" } });

      expect(screen.getByText("Can't undo")).toBeOnTheScreen();
      expect(screen.queryByRole("button")).not.toBeOnTheScreen();
    });

    it.each(schemes)("should write the label in accent ink in %s", async (scheme) => {
      await renderCard({}, scheme);

      expect(screen.getByText("Undo")).toHaveStyle({
        color: resolvedColor(scheme, scheme === "dark" ? "accent" : "text-primary"),
      });
    });

    it("should write the unavailable label in the muted colour in dark", async () => {
      await renderCard({ undo: { state: "unavailable", label: "Can't undo" } }, "dark");

      expect(screen.getByText("Can't undo")).toHaveStyle({
        color: resolvedColor("dark", "text-muted"),
      });
    });
  });

  describe("the title", () => {
    it("should be the primary text colour while Undo can act in dark", async () => {
      await renderCard({}, "dark");

      expect(screen.getByText("Logged 2 eggs and toast at 08:10")).toHaveStyle({
        color: resolvedColor("dark", "text-primary"),
      });
    });

    it("should be muted once the card is undone in dark", async () => {
      await renderCard({ title: "Undone", undo: { state: "done", label: "Undo" } }, "dark");

      expect(screen.getByText("Undone")).toHaveStyle({
        color: resolvedColor("dark", "text-secondary"),
      });
    });
  });

  describe("the icon", () => {
    it("should be drawn in the success colour by default in dark", async () => {
      await renderCard({}, "dark");

      expect(drawings()[0]).toHaveProp("stroke", themes.dark.success);
    });

    it("should be drawn in the success colour by default in light", async () => {
      await renderCard({}, "light");

      expect(drawings()[0]).toHaveProp("stroke", themes.light.success);
    });

    it("should take the tone it is given in dark", async () => {
      await renderCard({ iconTone: "muted" }, "dark");

      expect(drawings()[0]).toHaveProp("stroke", themes.dark["text-muted"]);
    });

    it("should be decoration, hidden from a screen reader", async () => {
      await renderCard();

      expect(screen.queryByRole("img")).not.toBeOnTheScreen();
    });
  });

  describe("the rows' match marks", () => {
    it("should name a matched row's tick Matched", async () => {
      await renderCard({
        rows: [
          {
            name: "2 tbsp olive oil",
            detail: "Olive oil · UK CoFID",
            match: "matched",
            matchLabel: "Matched",
          },
          {
            name: "1 lemon",
            detail: "Lemon, whole · UK CoFID",
            match: "matched",
            matchLabel: "Matched",
          },
        ],
      });

      expect(screen.getAllByRole("img", { name: "Matched" })).toHaveLength(2);
    });

    it("should draw Not matched on an unresolved row, and no tick", async () => {
      await renderCard({
        rows: [
          {
            name: "A splash of white wine",
            detail: "Not counted. Choose a food in the recipe editor.",
            match: "unresolved",
            matchLabel: "Not matched",
          },
        ],
      });

      expect(screen.getByText("Not matched")).toBeOnTheScreen();
      expect(screen.queryByRole("img", { name: "Matched" })).not.toBeOnTheScreen();
    });

    it.each(schemes)(
      "should write an unresolved detail in the warning ink in %s",
      async (scheme) => {
        await renderCard(
          {
            rows: [
              {
                name: "A splash of white wine",
                detail: "Not counted. Choose a food in the recipe editor.",
                match: "unresolved",
                matchLabel: "Not matched",
              },
            ],
          },
          scheme,
        );

        expect(screen.getByText("Not counted. Choose a food in the recipe editor.")).toHaveStyle({
          color: resolvedColor(scheme, scheme === "dark" ? "warning" : "text-primary"),
        });
      },
    );

    it("should name the tick with the words it is given, not a fixed word", async () => {
      await renderCard({
        rows: [
          {
            name: "1 lemon",
            detail: "Lemon, whole · UK CoFID",
            match: "matched",
            matchLabel: "Found",
          },
        ],
      });

      expect(screen.getByRole("img", { name: "Found" })).toBeOnTheScreen();
      expect(screen.queryByRole("img", { name: "Matched" })).not.toBeOnTheScreen();
    });

    it("should draw the unresolved badge with the words it is given, not a fixed word", async () => {
      await renderCard({
        rows: [
          {
            name: "A splash of white wine",
            detail: "Not counted.",
            match: "unresolved",
            matchLabel: "Not found",
          },
        ],
      });

      expect(screen.getByText("Not found")).toBeOnTheScreen();
      expect(screen.queryByText("Not matched")).not.toBeOnTheScreen();
    });

    it("should draw the change badge of a row with the words it is given, and no tick", async () => {
      await renderCard({
        rows: [{ name: "Oil, olive", detail: "15 g → 10 g", changeLabel: "Changed" }],
      });

      expect(screen.getByText("Changed")).toBeOnTheScreen();
      expect(screen.getByText("15 g → 10 g")).toBeOnTheScreen();
      expect(screen.queryByRole("img", { name: "Matched" })).not.toBeOnTheScreen();
    });

    it("should draw no badge on a row that gives no change", async () => {
      await renderCard({ rows: [{ name: "Broccoli", detail: "160 g, unchanged" }] });

      expect(badgesDrawn()).toHaveLength(0);
    });

    it("should draw the unresolved badge in the warning tone in dark", async () => {
      await renderCard(
        {
          rows: [
            {
              name: "A splash of white wine",
              detail: "Not counted.",
              match: "unresolved",
              matchLabel: "Not matched",
            },
          ],
        },
        "dark",
      );

      expect(badgesDrawn({ backgroundColor: themes.dark["warning-muted"] })).toHaveLength(1);
    });

    // The badge has `self-start`, which would pin it to the top of a tall row, so the row wraps it in a
    // view that does not shrink, as a list row does, and the row's own centring places it.
    it("should wrap the unresolved badge so a tall row centres it", async () => {
      await renderCard({
        rows: [
          {
            name: "A splash of white wine",
            detail: "Not counted. Choose a food in the recipe editor.",
            match: "unresolved",
            matchLabel: "Not matched",
          },
        ],
      });

      const [badge] = badgesDrawn();
      expect(badge?.parent).toHaveStyle({ flexShrink: 0 });
    });

    it("should write a matched row's detail in the muted tone in dark", async () => {
      await renderCard(
        {
          rows: [
            {
              name: "1 lemon",
              detail: "Lemon, whole · UK CoFID",
              match: "matched",
              matchLabel: "Matched",
            },
          ],
        },
        "dark",
      );

      expect(screen.getByText("Lemon, whole · UK CoFID")).toHaveStyle({
        color: resolvedColor("dark", "text-muted"),
      });
    });

    it("should draw neither mark on a row with no match", async () => {
      await renderCard({ rows: eggsAndToastRows });

      expect(screen.queryByRole("img", { name: "Matched" })).not.toBeOnTheScreen();
      expect(screen.queryByText("Not matched")).not.toBeOnTheScreen();
      expect(badgesDrawn()).toHaveLength(0);
    });
  });

  describe("the Estimate badge", () => {
    const rows = [
      {
        name: "A splash of milk",
        detail: "Milk, semi-skimmed · 50 ml",
        match: "matched",
        matchLabel: "Matched",
        estimateLabel: "Estimate",
      },
      { name: "Chicken", detail: "150 g · 13:00", value: "192 kcal" },
    ] as const;

    it("should draw the badge, with the words it is given, once, on the row that sets it", async () => {
      await renderCard({ rows: [...rows] });

      expect(screen.getAllByText("Estimate")).toHaveLength(1);
      expect(screen.getByText("Milk, semi-skimmed · 50 ml")).toBeOnTheScreen();
    });

    it("should draw the badge outlined, with a hairline border, in dark", async () => {
      await renderCard({ rows: [...rows] }, "dark");

      expect(
        badgesDrawn({
          backgroundColor: resolvedColor("dark", "surface-sheet"),
          borderColor: resolvedColor("dark", "border"),
          borderWidth: 1,
        }),
      ).toHaveLength(1);
    });

    it("should draw no badge on a row that does not set one", async () => {
      await renderCard({ rows: [rows[1]] });

      expect(screen.getByText("150 g · 13:00")).toBeOnTheScreen();
      expect(screen.queryByText("Estimate")).not.toBeOnTheScreen();
      expect(badgesDrawn()).toHaveLength(0);
    });

    it("should draw the words it is given, not a fixed one", async () => {
      await renderCard({ rows: [{ ...rows[0], estimateLabel: "Estimated" }] });

      expect(screen.getByText("Estimated")).toBeOnTheScreen();
      expect(screen.queryByText("Estimate")).not.toBeOnTheScreen();
    });
  });

  describe("the days", () => {
    const pushDay = {
      name: "Monday · Push",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [
        { name: "Barbell bench press", detail: "3 sets · 8 to 10 reps · RIR 2" },
        { name: "Lateral raise", detail: "3 sets · 12 to 15 reps · RIR 1" },
      ],
    };
    const pullDay = {
      name: "Wednesday · Pull",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [{ name: "Lat pulldown", detail: "3 sets · 8 to 10 reps · RIR 2" }],
    };
    const legsDay = {
      name: "Friday · Legs",
      summary: "5 exercises · 15 sets · about 50 min",
      exercises: [{ name: "Barbell squat", detail: "3 sets · 8 to 10 reps · RIR 2" }],
    };
    const days = [pushDay, pullDay, legsDay];

    const dayButton = (day: { name: string; summary: string }) =>
      screen.getByRole("button", { name: `${day.name}, ${day.summary}` });
    const dayButtonExpanded = (day: { name: string; summary: string }, expanded: boolean) =>
      screen.getByRole("button", { name: `${day.name}, ${day.summary}`, expanded });

    it("should draw one button per day, named by the day's name and summary, all closed on arrival", async () => {
      await renderCard({ days });

      expect(dayButtonExpanded(pushDay, false)).toBeOnTheScreen();
      expect(dayButtonExpanded(pullDay, false)).toBeOnTheScreen();
      expect(dayButtonExpanded(legsDay, false)).toBeOnTheScreen();
    });

    it("should draw each day's name and its summary as given", async () => {
      await renderCard({ days });

      expect(screen.getByText("Monday · Push")).toBeOnTheScreen();
      expect(screen.getAllByText("5 exercises · 15 sets · about 50 min")).toHaveLength(3);
    });

    it("should draw no exercise while every day is closed", async () => {
      await renderCard({ days });

      expect(screen.queryByText("Barbell bench press")).not.toBeOnTheScreen();
      expect(screen.queryByText("Lat pulldown")).not.toBeOnTheScreen();
    });

    it("should draw the day's exercises, name and detail exactly as given, once it is pressed", async () => {
      const user = userEvent.setup();
      await renderCard({ days });

      await user.press(dayButton(pushDay));

      expect(dayButtonExpanded(pushDay, true)).toBeOnTheScreen();
      expect(screen.getByText("Barbell bench press")).toBeOnTheScreen();
      expect(screen.getByText("3 sets · 8 to 10 reps · RIR 2")).toBeOnTheScreen();
      expect(screen.getByText("Lateral raise")).toBeOnTheScreen();
      expect(screen.getByText("3 sets · 12 to 15 reps · RIR 1")).toBeOnTheScreen();
    });

    it("should close the open day when another is pressed, so one is open at a time", async () => {
      const user = userEvent.setup();
      await renderCard({ days });
      await user.press(dayButton(pushDay));

      await user.press(dayButton(pullDay));

      expect(dayButtonExpanded(pushDay, false)).toBeOnTheScreen();
      expect(dayButtonExpanded(pullDay, true)).toBeOnTheScreen();
      expect(screen.queryByText("Barbell bench press")).not.toBeOnTheScreen();
      expect(screen.getByText("Lat pulldown")).toBeOnTheScreen();
    });

    it("should close the open day when it is pressed again", async () => {
      const user = userEvent.setup();
      await renderCard({ days });
      await user.press(dayButton(pushDay));

      await user.press(dayButton(pushDay));

      expect(dayButtonExpanded(pushDay, false)).toBeOnTheScreen();
      expect(screen.queryByText("Barbell bench press")).not.toBeOnTheScreen();
    });

    it("should open the day it is given on arrival, and no other", async () => {
      await renderCard({ days, initiallyOpenDay: 1 });

      expect(dayButtonExpanded(pushDay, false)).toBeOnTheScreen();
      expect(dayButtonExpanded(pullDay, true)).toBeOnTheScreen();
      expect(dayButtonExpanded(legsDay, false)).toBeOnTheScreen();
      expect(screen.getByText("Lat pulldown")).toBeOnTheScreen();
    });

    it("should draw the days after the rows and before the total", async () => {
      await renderCard({
        rows: [{ name: "A row", detail: "A row's detail" }],
        days: [pushDay],
        total: "The week: 15 sets · 1 day",
      });

      const words = textsInOrder();
      expect(words.indexOf("A row's detail")).toBeLessThan(words.indexOf("Monday · Push"));
      expect(words.indexOf("Monday · Push")).toBeLessThan(
        words.indexOf("The week: 15 sets · 1 day"),
      );
    });

    it("should draw no day button when no days are given", async () => {
      await renderCard({ rows: eggsAndToastRows });

      expect(screen.getAllByRole("button")).toHaveLength(1);
      expect(screen.getByRole("button", { name: "Undo" })).toBeOnTheScreen();
    });

    it("should keep the Undo and the link working beside the days", async () => {
      const user = userEvent.setup();
      const onUndo = jest.fn();
      const onLink = jest.fn();
      await renderCard({
        days,
        undo: { state: "available", label: "Undo", onPress: onUndo },
        link: { label: "Open in routine editor", onPress: onLink },
      });

      await user.press(screen.getByRole("button", { name: "Undo" }));
      await user.press(screen.getByRole("button", { name: "Open in routine editor" }));

      expect(onUndo).toHaveBeenCalledTimes(1);
      expect(onLink).toHaveBeenCalledTimes(1);
    });

    it("should draw each day at least 52 points high, the board's height", async () => {
      await renderCard({ days });

      expect(viewsDrawn({ minHeight: 52 })).toHaveLength(3);
    });

    it.each(schemes)("should write the summary in secondary ink in %s", async (scheme) => {
      await renderCard({ days }, scheme);

      expect(screen.getAllByText("5 exercises · 15 sets · about 50 min")[0]).toHaveStyle({
        color: resolvedColor(scheme, "text-secondary"),
      });
    });

    it.each(schemes)("should write an exercise's detail in muted ink in %s", async (scheme) => {
      await renderCard({ days, initiallyOpenDay: 0 }, scheme);

      expect(screen.getByText("3 sets · 8 to 10 reps · RIR 2")).toHaveStyle({
        color: resolvedColor(scheme, "text-muted"),
      });
    });

    it("should draw the chevron pointing up on the open day and down on the others", async () => {
      await renderCard({ days, initiallyOpenDay: 0 });

      expect(pathsDrawn(chevronUpPath)).toHaveLength(1);
      expect(pathsDrawn(chevronDownPath)).toHaveLength(2);
    });
  });

  describe("the link", () => {
    it("should be a button named by its label, which calls onPress", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({ link: { label: "Open in recipe editor", onPress } });

      await user.press(screen.getByRole("button", { name: "Open in recipe editor" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should still work after Undo is done, so the card keeps pointing at what it made", async () => {
      const user = userEvent.setup();
      const onPress = jest.fn();
      await renderCard({
        undo: { state: "done", label: "Undo" },
        link: { label: "Open in your foods", onPress },
      });

      await user.press(screen.getByRole("button", { name: "Open in your foods" }));

      expect(onPress).toHaveBeenCalledTimes(1);
    });

    it("should draw no link when none is given", async () => {
      await renderCard();

      expect(screen.queryByText("Open in recipe editor")).not.toBeOnTheScreen();
    });
  });
});

// The icon is decoration, so its drawing is looked for.
function drawings() {
  return screen.root?.queryAll((node) => node.type === "RNSVGSvgView") ?? [];
}

const chevronDownPath = "m6 9 6 6 6-6";
const chevronUpPath = "m18 15-6-6-6 6";

// The icons are decoration, so the glyph drawn is found by the path of its stroke.
function pathsDrawn(pathData: string) {
  return (
    screen.root?.queryAll((node) => node.type === "RNSVGPath" && node.props.d === pathData) ?? []
  );
}

// Every line of words on the screen, in the order it is drawn.
function textsInOrder() {
  return (
    screen.root
      ?.queryAll((node) => node.type === "Text")
      .map((node) => String(node.props.children)) ?? []
  );
}
