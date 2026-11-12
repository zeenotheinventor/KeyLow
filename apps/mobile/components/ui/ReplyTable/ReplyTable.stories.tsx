import { parseReplyText } from "@keylow/core";
import { View } from "react-native";

import { ReplyTable } from "./ReplyTable";

import type { ReplyTableProps } from "./types";
import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ReplyTable",
  decorators: [
    (Story) => (
      // The table sits in a reply, which keeps 16 points on its right that the table takes back, so the
      // story gives it the same 16 to take. The sheet surface has 16 points at the sides.
      <View className="flex-1 justify-center bg-surface-sheet p-4">
        <View className="pr-4">
          <Story />
        </View>
      </View>
    ),
  ],
  // The props hold a table that the reply reader makes from words, so each story reads its own.
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function tableFrom(markdown: string): ReplyTableProps["table"] {
  const table = parseReplyText(markdown, { isPartial: false }).find(
    (block) => block.kind === "table",
  );
  if (table === undefined) {
    throw new Error("The story's markdown holds no table");
  }
  return table;
}

const christmasMarket = tableFrom(
  [
    "| Entry | Amount | kcal | Protein (g) | Fat (g) | Carbs (g) | Fibre (g) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| Potato wedges, with skin, cooked in sunflower oil | 300 g | 435 | 8.7 | 11 | 80 | 9 |",
    "| Chicken breast strips, stir-fried | 100 g | 145 | 28 | 5 | 0 | 0 |",
    "| Bratwurst roll | 1 roll (190 g) | 520 | 21 | 34 | 44 | 4 |",
    "| Mulled wine | 200 ml | 170 | 0 | 0 | 20 | 0 |",
    "| Chocolate crêpe | 180 g | 675 | 9.3 | 36 | 89 | 6 |",
    "| Baileys Original Irish Cream | 25 ml | 79 | – | – | – | – |",
    "| **Total** | | **2,024** | **67** | **86** | **233** | **19** |",
  ].join("\n"),
);

const thisWeek = tableFrom(
  [
    "| Day | kcal | Protein (g) |",
    "| --- | --- | --- |",
    "| Mon 19 Oct | 2,080 | 138 |",
    "| Tue 20 Oct | 2,150 | 142 |",
    "| Wed 21 Oct | 1,960 | 121 |",
    "| Thu 22 Oct | 2,210 | 147 |",
    "| Fri 23 Oct | 2,030 | 129 |",
    "| Sat 24 Oct | 1,940 | 118 |",
    "| Today, *so far* | 447 | 23 |",
  ].join("\n"),
);

// The assistant · table board: wider than the thread, so the first column is fixed, the right edge is open with
// the fade, and the platform's indicator flashes once. Scroll it to see the right edge close at the last column.
export const Wide: Story = {
  render: () => <ReplyTable table={christmasMarket} />,
};

// The assistant · table-streaming board's right half: it fits, so it fills the thread, with no scrolling,
// fade or fixed column.
export const Fits: Story = {
  render: () => <ReplyTable table={thisWeek} />,
};

// The assistant · table-streaming board's left half: the empty row under the last, where the next line goes,
// with a stand-in for the caret.
export const Arriving: Story = {
  render: () => (
    <ReplyTable
      pendingMark={<View aria-hidden className="h-[18px] w-[8px] rounded-[1px] bg-accent" />}
      table={christmasMarket}
    />
  ),
};
