import { parseReplyText } from "@keylow/core";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { ScrollView, View } from "react-native";

import { ReplyTable } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";
import { resolvedColor } from "../support/themeColor";
import { viewsDrawn } from "../support/viewsDrawn";

import type { ReplyTableProps } from "../../components/ui";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

const christmasMarket = [
  "| Entry | Amount | kcal | Protein (g) |",
  "| --- | --- | --- | --- |",
  "| Potato wedges, with skin, cooked in sunflower oil | 300 g | 435 | 8.7 |",
  "| Baileys Original Irish Cream | 25 ml | 79 | – |",
  "| **Total** | | **2,024** | **67** |",
].join("\n");

function tableOf(markdown: string): ReplyTableProps["table"] {
  const table = parseReplyText(markdown, { isPartial: false }).find(
    (block) => block.kind === "table",
  );
  if (table === undefined) {
    throw new Error("The markdown held no table");
  }
  return table;
}

function renderTable(props: Partial<ReplyTableProps> = {}) {
  return render(
    <ThemeProvider fixedPreference="dark">
      <ReplyTable table={tableOf(christmasMarket)} {...props} />
    </ThemeProvider>,
  );
}

const hidden = { includeHiddenElements: true };

const layoutEvent = (width: number, height = 40) => ({
  nativeEvent: { layout: { x: 0, y: 0, width, height } },
});

// Jest does not lay anything out, so a test says how wide each part came out, as a phone would.
async function measure({ container, first, columns, viewport }: Record<string, number>) {
  await fireEvent(screen.getByTestId("reply-table"), "layout", layoutEvent(container ?? 358));
  await fireEvent(
    screen.getByText("Potato wedges, with skin, cooked in sunflower oil"),
    "layout",
    layoutEvent((first ?? 127) - 1),
  );
  await fireEvent(screen.getByTestId("reply-table-columns"), "layout", layoutEvent(columns ?? 500));
  await fireEvent(screen.getByTestId("reply-table-scroll"), "layout", layoutEvent(viewport ?? 204));
}

describe("ReplyTable", () => {
  let kitStyles: string;

  beforeAll(async () => {
    kitStyles = await compileKitStyles();
  });

  beforeEach(() => {
    registerAppStyles(kitStyles);
  });

  it("should draw every heading and cell before anything is measured, with no pipe", async () => {
    await renderTable();

    for (const words of [
      "Entry",
      "Amount",
      "kcal",
      "Protein (g)",
      "Potato wedges, with skin, cooked in sunflower oil",
      "300 g",
      "435",
      "8.7",
      "Baileys Original Irish Cream",
      "25 ml",
      "79",
      "Total",
      "2,024",
      "67",
    ]) {
      expect(screen.getByText(words)).toBeOnTheScreen();
    }
    expect(screen.queryByText(/\|/)).not.toBeOnTheScreen();
  });

  it("should draw the headings in the caption look and the cells in the body look", async () => {
    await renderTable();

    expect(screen.getByText("Amount")).toHaveStyle({
      color: resolvedColor("dark", "text-secondary"),
      fontSize: 12,
    });
    expect(screen.getByText("300 g")).toHaveStyle({
      color: resolvedColor("dark", "text-primary"),
      fontSize: 16,
    });
  });

  it("should draw a bold cell in the strong look", async () => {
    await renderTable();

    expect(screen.getByText("Total")).toHaveStyle({ fontFamily: "Geist-SemiBold" });
  });

  it("should draw a cell that is only a dash muted", async () => {
    await renderTable();

    expect(screen.getByText("–")).toHaveStyle({ color: resolvedColor("dark", "text-muted") });
  });

  it("should align a numeric column and its heading to the right, and the others to the left", async () => {
    await renderTable();

    expect(screen.getByText("kcal")).toHaveStyle({ textAlign: "right" });
    expect(screen.getByText("435")).toHaveStyle({ textAlign: "right" });
    expect(screen.getByText("Entry")).not.toHaveStyle({ textAlign: "right" });
    expect(screen.getByText("Baileys Original Irish Cream")).not.toHaveStyle({
      textAlign: "right",
    });
  });

  it("should align a column of words to the left, and one with a word among its numbers", async () => {
    await renderTable({
      table: tableOf("| Day | Note |\n| --- | --- |\n| Mon | 2 big meals |\n| Tue | fasted |"),
    });

    expect(screen.getByText("Note")).not.toHaveStyle({ textAlign: "right" });
    expect(screen.getByText("fasted")).not.toHaveStyle({ textAlign: "right" });
  });

  it("should hold each cell to one line, and the first column to two", async () => {
    await renderTable();

    expect(screen.getByText("300 g")).toHaveProp("numberOfLines", 1);
    expect(screen.getByText("Potato wedges, with skin, cooked in sunflower oil")).toHaveProp(
      "numberOfLines",
      2,
    );
  });

  it("should draw no fade and keep its border closed until it has been measured", async () => {
    await renderTable();

    expect(screen.queryByTestId("reply-table-fade", hidden)).not.toBeOnTheScreen();
    expect(screen.getByTestId("reply-table")).not.toHaveStyle({ borderRightWidth: 0 });
  });

  describe("wider than the thread", () => {
    it("should open its right edge and draw the fade while columns are left to see", async () => {
      await renderTable();
      await measure({});

      expect(screen.getByTestId("reply-table-fade", hidden)).toBeOnTheScreen();
      expect(screen.getByTestId("reply-table")).toHaveStyle({
        borderRightWidth: 0,
        borderTopLeftRadius: 12,
        borderBottomLeftRadius: 12,
      });
      expect(screen.getByTestId("reply-table")).not.toHaveStyle({ borderRadius: 12 });
    });

    it("should draw the fade as the sheet colour from clear, 24 points wide", async () => {
      await renderTable();
      await measure({});

      expect(screen.getByTestId("reply-table-fade", hidden)).toHaveStyle({
        width: 24,
        experimental_backgroundImage: "linear-gradient(to right, #232A3700, #232A37)",
      });
    });

    it("should close the border and drop the fade at the last column", async () => {
      await renderTable();
      await measure({});

      await fireEvent.scroll(screen.getByTestId("reply-table-scroll"), {
        nativeEvent: {
          contentOffset: { x: 296, y: 0 },
          contentSize: { width: 500, height: 300 },
          layoutMeasurement: { width: 204, height: 300 },
        },
      });

      expect(screen.queryByTestId("reply-table-fade", hidden)).not.toBeOnTheScreen();
      expect(screen.getByTestId("reply-table")).toHaveStyle({ borderRadius: 12 });
    });

    it("should fix the first column at 152 points with a line on its right", async () => {
      await renderTable();
      await measure({});

      expect(screen.getByTestId("reply-table-first-column")).toHaveStyle({
        maxWidth: 152,
        borderRightWidth: 1,
      });
    });

    it("should flash the platform's scroll indicator once when it first shows as wider", async () => {
      const flash = jest.spyOn(ScrollView.prototype, "flashScrollIndicators");
      await renderTable();
      await measure({});
      const flashesWhenFirstWide = flash.mock.calls.length;
      await measure({ columns: 520 });

      expect(flashesWhenFirstWide).toBeGreaterThan(0);
      expect(flash).toHaveBeenCalledTimes(flashesWhenFirstWide);
      flash.mockRestore();
    });

    it("should scroll sideways, with the platform's indicator", async () => {
      await renderTable();
      await measure({});

      expect(screen.getByTestId("reply-table-scroll")).toHaveProp("horizontal", true);
      expect(screen.getByTestId("reply-table-scroll")).toHaveProp("scrollEnabled", true);
    });
  });

  describe("narrower than the thread", () => {
    it("should neither scroll, nor fade, nor fix its first column, which takes the spare width", async () => {
      await renderTable();
      await measure({ columns: 150 });

      expect(screen.queryByTestId("reply-table-fade", hidden)).not.toBeOnTheScreen();
      expect(screen.getByTestId("reply-table-scroll")).toHaveProp("scrollEnabled", false);
      expect(screen.getByTestId("reply-table-first-column")).toHaveStyle({ flexGrow: 1 });
      expect(screen.getByTestId("reply-table-first-column")).not.toHaveStyle({
        borderRightWidth: 1,
      });
      expect(screen.getByTestId("reply-table")).toHaveStyle({ borderRadius: 12 });
    });
  });

  describe("row heights", () => {
    it("should give every cell in a row the height of the tallest, in both parts", async () => {
      await renderTable();
      await fireEvent(
        screen.getByText("Potato wedges, with skin, cooked in sunflower oil"),
        "layout",
        layoutEvent(100, 48),
      );

      const tall = viewsDrawn({ minHeight: 64 });
      // The first cell and the four others in its row, as each part draws it.
      expect(tall).toHaveLength(4);
    });
  });

  describe("while it arrives", () => {
    it("should draw an empty row with the caret in its first cell only when asked", async () => {
      await renderTable({ pendingMark: <View aria-hidden className="h-[18px] w-[8px]" /> });

      expect(viewsDrawn({ width: 8, height: 18 })).toHaveLength(1);
    });

    it("should draw no empty row and no caret otherwise", async () => {
      await renderTable();

      expect(viewsDrawn({ width: 8, height: 18 })).toHaveLength(0);
    });
  });
});
