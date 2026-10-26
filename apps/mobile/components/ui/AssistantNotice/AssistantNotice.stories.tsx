import { View } from "react-native";

import { AssistantNotice } from "./AssistantNotice";

import type { Meta, StoryObj } from "@storybook/react-native";

// Each story is one `assistant` notice board with the board's own words. The glyphs are the ones in the
// icon map today. The boards draw a moon for the monthly limit, a crossed-out power symbol for the
// switch and sparkles for the consent card, and the swap waits for the assistant icons to land.
const meta = {
  title: "UI/AssistantNotice",
  component: AssistantNotice,
  decorators: [
    (Story) => (
      <View className="flex-1 justify-center p-4">
        <Story />
      </View>
    ),
  ],
} satisfies Meta<typeof AssistantNotice>;

export default meta;

type Story = StoryObj<typeof meta>;

// `assistant · day-limit`
export const DayLimit: Story = {
  args: {
    icon: "Clock",
    title: "You have used today's turns",
    paragraphs: [
      "The assistant is back at midnight. Logging, search and quick add work as normal.",
    ],
  },
};

// `assistant · plus`
export const Plus: Story = {
  args: {
    icon: "Lock",
    title: "The assistant is part of Ki-Lo Plus",
    paragraphs: [
      "Your account does not include Ki-Lo Plus at the moment. Logging, search and quick add work as normal.",
    ],
  },
};

// `assistant · resting`
export const Resting: Story = {
  args: {
    icon: "SunMoon",
    title: "The assistant is resting until 1 November",
    paragraphs: [
      "It has reached this month's limit. Your conversations are kept. Everything else in Ki-Lo works as normal.",
    ],
  },
};

// `assistant · unavailable`, left: the assistant switched off for now.
export const SwitchedOff: Story = {
  args: {
    icon: "CloudOff",
    title: "The assistant is switched off for now",
    paragraphs: ["Try again later. Everything else in Ki-Lo works as normal."],
  },
};

// `assistant · unavailable`, middle: a failed turn, with the danger border, tile and icon, and one button.
export const FailedTurn: Story = {
  args: {
    icon: "CircleAlert",
    tone: "danger",
    title: "That answer did not come through",
    paragraphs: ["Nothing was changed. Check your connection and try again."],
    buttons: [{ label: "Try again", kind: "secondary", onPress: () => undefined }],
  },
};

// `assistant · consent-needed`: the accent tile, two paragraphs, the policy link, the small print and the
// two buttons. The words are the Settings words, and the small print is the not-medical-advice line
// followed by where to turn the assistant off.
export const ConsentNeeded: Story = {
  args: {
    icon: "Shield",
    tone: "accent",
    title: "Turn on the assistant",
    paragraphs: [
      "The assistant answers questions about your diary, weight and targets, and logs, copies and changes entries for you. Every change shows as a card with Undo.",
      "To do this, your messages and the Ki-Lo data the assistant reads are sent to Anthropic, the company that runs its AI model, as Ki-Lo's processor. Anthropic keeps them for up to 30 days. Ki-Lo keeps your conversations until you delete them.",
    ],
    link: { label: "Privacy policy", onPress: () => undefined },
    smallPrint:
      "The assistant's answers are not medical advice. Speak to a doctor before you make big changes to your diet or your weight. You can turn the assistant off in More, Assistant.",
    buttons: [
      { label: "Turn on", kind: "primary", onPress: () => undefined },
      { label: "Not now", kind: "ghost", onPress: () => undefined },
    ],
  },
};
