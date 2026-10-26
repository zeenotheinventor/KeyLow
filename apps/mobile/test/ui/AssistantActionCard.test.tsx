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

    it.each(schemes)(
      "should write the unavailable label in the muted colour in %s",
      async (scheme) => {
        await renderCard({ undo: { state: "unavailable", label: "Can't undo" } }, scheme);

        expect(screen.getByText("Can't undo")).toHaveStyle({
          color: resolvedColor(scheme, "text-muted"),
        });
      },
    );
  });

  describe("the title", () => {
    it.each(schemes)(
      "should be the primary text colour while Undo can act in %s",
      async (scheme) => {
        await renderCard({}, scheme);

        expect(screen.getByText("Logged 2 eggs and toast at 08:10")).toHaveStyle({
          color: resolvedColor(scheme, "text-primary"),
        });
      },
    );

    it.each(schemes)("should be muted once the card is undone in %s", async (scheme) => {
      await renderCard({ title: "Undone", undo: { state: "done", label: "Undo" } }, scheme);

      expect(screen.getByText("Undone")).toHaveStyle({
        color: resolvedColor(scheme, "text-secondary"),
      });
    });
  });

  describe("the icon", () => {
    it.each(schemes)("should be drawn in the success colour by default in %s", async (scheme) => {
      await renderCard({}, scheme);

      expect(drawings()[0]).toHaveProp("stroke", themes[scheme].success);
    });

    it.each(schemes)("should take the tone it is given in %s", async (scheme) => {
      await renderCard({ iconTone: "muted" }, scheme);

      expect(drawings()[0]).toHaveProp("stroke", themes[scheme]["text-muted"]);
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

    it.each(schemes)(
      "should draw the unresolved badge in the warning tone in %s",
      async (scheme) => {
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
          scheme,
        );

        expect(badgesDrawn({ backgroundColor: themes[scheme]["warning-muted"] })).toHaveLength(1);
      },
    );

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

    it.each(schemes)(
      "should write a matched row's detail in the muted tone in %s",
      async (scheme) => {
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
          scheme,
        );

        expect(screen.getByText("Lemon, whole · UK CoFID")).toHaveStyle({
          color: resolvedColor(scheme, "text-muted"),
        });
      },
    );

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

    it.each(schemes)(
      "should draw the badge outlined, with a hairline border, in %s",
      async (scheme) => {
        await renderCard({ rows: [...rows] }, scheme);

        expect(
          badgesDrawn({
            backgroundColor: resolvedColor(scheme, "surface-sheet"),
            borderColor: resolvedColor(scheme, "border"),
            borderWidth: 1,
          }),
        ).toHaveLength(1);
      },
    );

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
