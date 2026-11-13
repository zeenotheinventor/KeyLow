import { parseReplyText } from "@keylow/core";

import { ReplyTable } from "./ReplyTable";

import type { ReplyTableProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/ReplyTable",
  decorators: [
    (Story) => (
      // The table sits in a reply, which keeps 16 px on its right that the table takes back, so the story
      // gives it the same 16 to take. The panel is the sheet surface, 400 px wide with 16 px at the sides.
      <div className="w-[400px] max-w-full bg-surface-sheet p-4">
        <div className="pr-4">
          <Story />
        </div>
      </div>
    ),
  ],
  // The props hold a table that the reply reader makes from words, so each story reads its own.
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

function tableFrom(markdown: string, isArriving = false): ReplyTableProps["table"] {
  const table = parseReplyText(markdown, { isPartial: isArriving, isArriving }).find(
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
  ].join("\n"),
);

const arriving = tableFrom(
  [
    "| Entry | Amount | kcal | Protein (g) | Fat (g) | Carbs (g) | Fibre (g) |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    "| Potato wedges, with skin, cooked in sunflower oil | 300 g | 435 | 8.7 | 11 | 80 | 9 |",
    "| Chicken breast strips, stir-fried | 100 g | 145 | 28 | 5 | 0 | 0 |",
    "| Bratwurst roll | 1 roll (190 g) | 52",
  ].join("\n"),
  true,
);

// Wider than the reply: it scrolls sideways inside its own border, with the first column fixed and a fade on
// the right while columns are left to see. Tab reaches it and the arrow keys scroll it.
export const Wide: Story = {
  render: () => <ReplyTable label="Table, 7 rows." table={christmasMarket} />,
};

// Fits the reply: it fills it, does not scroll and is not focusable.
export const Fits: Story = {
  render: () => <ReplyTable label="Table, 3 rows." table={thisWeek} />,
};

// Arriving: the next row is held back and the caret waits in an empty row under the last.
export const Arriving: Story = {
  render: () => (
    <ReplyTable
      label="Table, 2 rows."
      pendingMark={
        <span
          aria-hidden
          className="ml-[2px] inline-block h-[18px] w-[8px] rounded-[1px] bg-accent align-[-3px]"
        />
      }
      table={arriving}
    />
  ),
};
