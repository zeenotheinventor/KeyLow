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
