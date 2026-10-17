import { ArchivedRecipesView } from "./ArchivedRecipesView";
import { archivedSampleRecipes } from "../sampleRecipes";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { PageFrame } from "@/app/(dashboard)/PageFrame";

// The props are a union, which Storybook's args typing cannot hold, so each story renders its own view,
// under the dashboard layout's side padding and the diary's vertical padding, as the boards draw it.
const meta = {
  title: "Recipes/ArchivedRecipesView",
  decorators: [
    (Story) => (
      <main className="px-4 lg:px-8">
        <PageFrame variant="diary">
          <Story />
        </PageFrame>
      </main>
    ),
  ],
  parameters: { layout: "fullscreen" },
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Archived: Story = {
  render: () => (
    <ArchivedRecipesView
      status="ready"
      recipes={archivedSampleRecipes}
      onRestore={() => undefined}
    />
  ),
};

export const NothingArchived: Story = {
  render: () => <ArchivedRecipesView status="ready" recipes={[]} onRestore={() => undefined} />,
};

// The rows appear after 200 ms, as the skeleton does everywhere.
export const Loading: Story = { render: () => <ArchivedRecipesView status="loading" /> };

export const Failed: Story = {
  render: () => <ArchivedRecipesView status="error" onRetry={() => undefined} />,
};
