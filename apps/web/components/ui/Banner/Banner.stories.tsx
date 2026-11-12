import { Mail } from "lucide-react";

import { Banner } from "./Banner";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/Banner",
  component: Banner,
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Banner>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Info: Story = {
  args: {
    tone: "info",
    title: "Open Food Facts could not be searched right now",
    children: "Your own results still work. Change your search to try again.",
  },
};

// The dashboard's "No target set" notice: the action sits under the words, in the accent ink, underlined.
export const InfoWithAction: Story = {
  args: {
    tone: "info",
    title: "No target set",
    children: "Set a calorie and macro target to see what is left.",
    action: { label: "Set target", href: "/more/targets" },
  },
};

// The edit dialog's "food changed" notice, with a button for its action.
export const InfoWithButtonAction: Story = {
  args: {
    tone: "info",
    title: "This food has changed since you logged it.",
    children: "Your entry keeps the values you saved.",
    action: { label: "Update to current food data", onClick: () => undefined },
  },
};

export const InfoWithCustomIcon: Story = {
  args: {
    tone: "info",
    icon: Mail,
    title: "Check your email",
    children:
      "Open the confirmation link sent to sam.taylor@example.com to finish creating your account.",
  },
};

export const Review: Story = {
  args: {
    tone: "review",
    title: "Needs review",
    children:
      "Energy and carbohydrate are not given. Fill them in to save your own copy of this food.",
  },
};

export const ReviewWithAction: Story = {
  args: {
    tone: "review",
    title: "Needs review",
    children:
      "Energy and carbohydrate are not given. Fill them in to save your own copy of this food.",
    action: { label: "Copy to your foods", onClick: () => undefined },
  },
};

export const ErrorMessage: Story = {
  args: {
    tone: "error",
    children: "Email or password is not right. Check them and try again.",
  },
};

// The setup wizard's read failure while Try again runs: the action is dimmed to 40 percent and ignores a press.
export const ErrorWithDisabledAction: Story = {
  args: {
    tone: "error",
    children: "Couldn't load your saved answers. You can still answer here.",
    action: { label: "Try again", onClick: () => undefined, disabled: true },
  },
};

export const ErrorWithTitle: Story = {
  args: {
    tone: "error",
    title: "This product could not be added",
    children: "Check your connection and try again.",
  },
};

// The warning toned notice with a link under its message, as the form draws a partial save.
export const ReviewWithLinkBelow: Story = {
  args: {
    tone: "review",
    role: "alert",
    children: "Your food was saved, but its portions were not. Edit the food to add them again.",
    action: { label: "Edit the food", href: "/foods/1/edit" },
    actionPlacement: "below",
  },
};

// The weigh-in dialog's save error: one sentence with no title, at caption size in the secondary ink.
export const ErrorSentence: Story = {
  args: {
    tone: "error",
    sentence: true,
    children:
      "Couldn't save your weigh-in. Check your connection and try again. What you typed is still here.",
  },
};

export const ReviewSentence: Story = {
  args: {
    tone: "review",
    sentence: true,
    children:
      "Deleting removes it from Ki-Lo only. It stays in Health Connect and won't come back on the next import.",
  },
};

// The trend explainer's settling banner: no icon, 12 on every side, the title in the primary ink, a bar under it.
export const ReviewCompactNoIcon: Story = {
  args: {
    tone: "review",
    size: "compact",
    hasIcon: false,
    title: "Your trend is settling: 3 of 7 weigh-ins",
    children: <div className="mt-2 h-1.5 rounded-pill bg-surface-raised" />,
  },
};

export const ReviewWithoutIcon: Story = {
  args: {
    tone: "review",
    hasIcon: false,
    title: "Needs review",
    children: "Energy and carbohydrate are not given.",
  },
};

export const ReviewCompact: Story = {
  args: {
    tone: "review",
    size: "compact",
    title: "Needs review",
    children: "Energy and carbohydrate are not given.",
  },
};
