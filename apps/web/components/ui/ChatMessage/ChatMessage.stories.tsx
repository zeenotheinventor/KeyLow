import { ChatMessage } from "./ChatMessage";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/ChatMessage",
  decorators: [
    (Story) => (
      // The messages sit in the assistant panel, which is the sheet surface, 400 px wide with 16 px at the sides.
      <div className="flex w-[400px] max-w-full flex-col gap-3 bg-surface-sheet p-4">
        <Story />
      </div>
    ),
  ],
  // The props are a union of your message and the assistant's, which a story's args cannot spread, so the
  // meta names no component and each story draws its own message.
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

// The speaker is not drawn on the boards, only heard by a screen reader, so its words are the stories' own.
const you = "You";
const assistant = "Assistant";

const yesterdayAnswer =
  "Yesterday, Saturday 24 October, you logged 8 entries, 1,940 kcal in all. At 08:00, porridge with";

export const YourMessage: Story = {
  render: () => (
    <ChatMessage paragraphs={["What did I eat yesterday?"]} sender="you" speakerLabel={you} />
  ),
};

export const Answer: Story = {
  render: () => (
    <ChatMessage
      paragraphs={["How much chicken and how much rice? Pick one, or say it your way."]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The answer arriving word by word, with the accent caret after the last word.
export const Streaming: Story = {
  render: () => (
    <ChatMessage
      isStreaming
      paragraphs={[yesterdayAnswer]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

// Closing the panel stopped the answer, and the part that arrived stays, marked.
export const Stopped: Story = {
  render: () => (
    <ChatMessage
      paragraphs={[yesterdayAnswer]}
      sender="assistant"
      speakerLabel={assistant}
      stoppedLabel="Stopped when you closed the assistant"
    />
  ),
};

export const WithCitation: Story = {
  render: () => (
    <ChatMessage
      citation="Based on 38 entries, 12 to 18 Oct"
      paragraphs={["You averaged 2,050 kcal a day over the last week."]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

export const WithEstimate: Story = {
  render: () => (
    <ChatMessage
      estimate={{ badgeLabel: "Estimate", label: "Trend weight is an estimate" }}
      paragraphs={["Your trend weight is 80.4 kg, down 0.3 kg this week."]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The answer-estimate board: the Estimate badge and then the citation, under the words.
export const WithEstimateAndCitation: Story = {
  render: () => (
    <ChatMessage
      citation="Based on 24 weigh-ins, 21 Sep to 18 Oct"
      estimate={{ badgeLabel: "Estimate", label: "Trend weight is an estimate" }}
      paragraphs={[
        "Your trend weight fell by 0.4 kg a week over the last 4 weeks, from 81.2 kg to 79.6 kg.",
      ]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

export const Formatted: Story = {
  render: () => (
    <ChatMessage
      paragraphs={[
        "## This week\nYou ate **2,050 kcal** a day, *close* to your target.",
        "- Protein was high on Monday\n- Fibre was low all week\n1. Add a portion of veg\n2. Swap the white toast",
      ]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

export const FormattedStreaming: Story = {
  render: () => (
    <ChatMessage
      isStreaming
      paragraphs={["You ate **2,050 kcal** a day, *close* to your tar"]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

const christmasMarket = [
  "| Entry | Amount | kcal | Protein (g) | Fat (g) | Carbs (g) | Fibre (g) |",
  "| --- | --- | --- | --- | --- | --- | --- |",
  "| Potato wedges, with skin, cooked in sunflower oil | 300 g | 435 | 8.7 | 11 | 80 | 9 |",
  "| Chicken breast strips, stir-fried | 100 g | 145 | 28 | 5 | 0 | 0 |",
  "| Bratwurst roll | 1 roll (190 g) | 520 | 21 | 34 | 44 | 4 |",
  "| Baileys Original Irish Cream | 25 ml | 79 | – | – | – | – |",
  "| **Total** | | **2,024** | **67** | **86** | **233** | **19** |",
].join("\n");

// A table wider than the reply scrolls sideways inside it.
export const Table: Story = {
  render: () => (
    <ChatMessage
      paragraphs={["Your Christmas market total: 2,024 kcal.", christmasMarket]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

// A table that fits fills the reply, with words after it.
export const TableFits: Story = {
  render: () => (
    <ChatMessage
      paragraphs={[
        "| Day | kcal | Protein (g) |\n| --- | --- | --- |\n| Mon 19 Oct | 2,080 | 138 |\n| Tue 20 Oct | 2,150 | 142 |\n\nA steady week.",
      ]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};

// The table arriving: the next row is held back and the caret waits in an empty row under the last.
export const TableStreaming: Story = {
  render: () => (
    <ChatMessage
      isStreaming
      paragraphs={[
        "| Day | kcal | Protein (g) |\n| --- | --- | --- |\n| Mon 19 Oct | 2,080 | 138 |\n| Tue 20 Oct | 2,15",
      ]}
      sender="assistant"
      speakerLabel={assistant}
    />
  ),
};
