import { View } from "react-native";

import { ChatMessage } from "./ChatMessage";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ChatMessage",
  decorators: [
    (Story) => (
      // The messages sit in the assistant sheet, which is the sheet surface, with 16 points at the sides.
      <View className="flex-1 justify-center bg-surface-sheet p-4">
        <Story />
      </View>
    ),
  ],
  // The props are a union of your message and the assistant's, which a story's args cannot spread, so the
  // meta names no component and each story draws its own message.
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// The words the boards give the assistant as the person speaks to it and as it answers. The speaker is not
// drawn on the boards, only heard by a screen reader, so its words are the stories' own.
const you = "You";
const assistant = "Assistant";

const yesterdayAnswer =
  "Yesterday, Saturday 24 October, you logged 8 entries, 1,940 kcal in all. At 08:00, porridge with";

// The streaming, stopped, conversation and clarify boards: what the person said, on the right in a bubble.
export const YourMessage: Story = {
  render: () => (
    <ChatMessage paragraphs={["What did I eat yesterday?"]} role="you" speakerLabel={you} />
  ),
};

// The clarify board: the assistant's plain paragraph with no bubble and nothing under it.
export const Answer: Story = {
  render: () => (
    <ChatMessage
      paragraphs={["How much chicken and how much rice? Pick one, or say it your way."]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The streaming board: the answer arriving word by word, with the accent caret after the last word.
export const Streaming: Story = {
  render: () => (
    <ChatMessage
      isStreaming
      paragraphs={[yesterdayAnswer]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The stopped board: closing the sheet stopped the answer, and the part that arrived stays, marked.
export const Stopped: Story = {
  render: () => (
    <ChatMessage
      paragraphs={[yesterdayAnswer]}
      role="assistant"
      speakerLabel={assistant}
      stoppedLabel="Stopped when you closed the assistant"
    />
  ),
};

// The answer board: the answer in plain numbers, then the one line that names the data it used.
export const WithCitation: Story = {
  render: () => (
    <ChatMessage
      citation="Based on 38 entries, 12 to 18 Oct"
      paragraphs={[
        "You averaged 126 g of protein a day from Monday 12 to Sunday 18 October. That is 14 g a day under your 140 g target. You reached it on 2 of the 7 days.",
      ]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The answer-estimate board: an answer built on trend weight, with the Estimate badge and its line above the citation.
export const WithEstimate: Story = {
  render: () => (
    <ChatMessage
      citation="Based on 24 weigh-ins, 21 Sep to 18 Oct"
      estimate={{ badgeLabel: "Estimate", label: "Trend weight is an estimate" }}
      paragraphs={[
        "Your trend weight fell by 0.4 kg a week over the last 4 weeks, from 81.2 kg to 79.6 kg.",
      ]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The words the model writes as markdown, which the message draws as bold, a bullet and a numbered item.
const formattedReply =
  "Two things I can do here:\n- **Log food:** say what you ate and when.\n- **Copy a day:** repeat one day onto another.\n\n## Steps\n1. Say it your way.\n2. Check the entry.";

// The formatted board: bold lead-ins, bullets with a hanging indent, a numbered list and a heading at body size.
export const Formatted: Story = {
  render: () => (
    <ChatMessage
      paragraphs={formattedReply.split("\n\n")}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The same reply cut short in the middle of a bold word: no asterisk shows and the caret stays after the last word.
export const FormattedStreaming: Story = {
  render: () => (
    <ChatMessage
      isStreaming
      paragraphs={[
        "Two things I can do here:\n- **Log food:** say what you ate and when.\n- **Copy a d",
      ]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The Christmas market reply: an introduction, a wide table and the words after it.
const christmasMarketIntro =
  "Your Christmas market total: 2,024 kcal, 67 g protein, 86 g fat, 233 g carbs and 19 g fibre.";
const christmasMarketTable = [
  "| Entry | Amount | kcal | Protein (g) | Fat (g) | Carbs (g) | Fibre (g) |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| Potato wedges, with skin, cooked in sunflower oil | 300 g | 435 | 8.7 | 11 | 80 | 9 |",
  "| Chicken breast strips, stir-fried | 100 g | 145 | 28 | 5 | 0 | 0 |",
  "| Bratwurst roll | 1 roll (190 g) | 520 | 21 | 34 | 44 | 4 |",
  "| Mulled wine | 200 ml | 170 | 0 | 0 | 20 | 0 |",
  "| Chocolate crêpe | 180 g | 675 | 9.3 | 36 | 89 | 6 |",
  "| Baileys Original Irish Cream | 25 ml | 79 | – | – | – | – |",
  "| **Total** | | **2,024** | **67** | **86** | **233** | **19** |",
];
const christmasMarketAfter =
  "The Baileys has no macros in its food data, so its cells show – and the totals leave it out.";

// The assistant · table board, at rest: wider than the thread, so Entry is fixed, the right edge is open with
// the fade and the platform's indicator flashes once on mount.
export const Table: Story = {
  render: () => (
    <ChatMessage
      paragraphs={[christmasMarketIntro, christmasMarketTable.join("\n"), christmasMarketAfter]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The assistant · table board, scrolled to the last columns: the same reply. A story cannot scroll its own
// table, so scroll it by hand to the right to see the border close and the fade go.
export const TableScrolled: Story = {
  render: () => (
    <ChatMessage
      paragraphs={[christmasMarketIntro, christmasMarketTable.join("\n"), christmasMarketAfter]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The assistant · table-streaming board, on the left: the table arriving, three rows in, with the empty row
// under them and the caret in its first cell.
export const TableStreaming: Story = {
  render: () => (
    <ChatMessage
      isStreaming
      paragraphs={[christmasMarketIntro, `${christmasMarketTable.slice(0, 5).join("\n")}\n`]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The assistant · table-streaming board, on the right: a table of three columns that fits, filling the thread
// with no scrolling, and the words after it arriving with the caret at their end.
export const TableFits: Story = {
  render: () => (
    <ChatMessage
      isStreaming
      paragraphs={[
        "Your calories and protein each day this week, against your targets of 2,140 kcal and 140 g:",
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
        "Protein reached 140 g on 2 of the 6 full days, Tuesday and Thursday. Calories stayed within",
      ]}
      role="assistant"
      speakerLabel={assistant}
    />
  ),
};
