import { ErrorState } from "./ErrorState";

import type { Meta, StoryObj } from "@storybook/nextjs";

const meta = {
  title: "UI/ErrorState",
  component: ErrorState,
  args: {
    title: "Search failed",
    body: "Your foods could not be searched. Check your connection and try again.",
    size: "section",
  },
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ErrorState>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithRetry: Story = { args: { onRetry: () => undefined } };

export const WithoutTitle: Story = { render: () => <ErrorState size="section" /> };

// The whole page is the failure, so its title is the page's level one heading.
export const Page: Story = {
  args: {
    title: "Food not loaded",
    body: "The food could not be loaded. Try again later.",
    headingLevel: 1,
    size: "page",
  },
};
