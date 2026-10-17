import { ChefHat, Plus, SearchX } from "lucide-react";

import { EmptyState } from "./EmptyState";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/EmptyState",
  component: EmptyState,
  args: {
    icon: SearchX,
    title: "No foods found",
    body: "Try other words, or create the food yourself.",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EmptyState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithAction: Story = {
  args: { action: { label: "Create a food", icon: Plus, onClick: () => undefined } },
};

export const WithLinkAction: Story = {
  args: { action: { label: "Create a food", icon: Plus, href: "/foods/new" } },
};

// The first thing to do on a page that has nothing yet, such as the first recipe, is a primary button.
export const PrimaryAction: Story = {
  args: {
    icon: ChefHat,
    title: "No recipes yet",
    body: "Add the foods and the method once, then log it by the serving.",
    action: { label: "New recipe", icon: Plus, variant: "primary", href: "/recipes/new" },
  },
};

// A part of a page, such as the failed search on the foods page.
export const Section: Story = { args: { size: "section" } };

// The whole page is the state, so its title is the page's level one heading.
export const Page: Story = {
  args: {
    title: "Food not found",
    body: "This food does not exist, or you cannot see it.",
    headingLevel: 1,
    size: "page",
  },
};

// A section of the app that is not built yet, as the Dashboard, Diary and Recipes draw it.
export const Placeholder: Story = {
  args: {
    icon: ChefHat,
    title: "Coming soon",
    body: "Your recipes will appear here.",
    size: "placeholder",
  },
};
