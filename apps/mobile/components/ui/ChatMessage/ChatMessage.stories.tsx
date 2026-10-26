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
