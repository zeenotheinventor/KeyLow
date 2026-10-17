import { userEvent, within } from "storybook/test";

import { RecipeLibraryView } from "./RecipeLibraryView";
import { sampleRecipes } from "../sampleRecipes";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { PageFrame } from "@/app/(dashboard)/PageFrame";

// The props are a union, which Storybook's args typing cannot hold, so each story renders its own view.
// The page is not reachable at /recipes yet, so these stories are how it is seen: each state of the
// boards, drawn under the dashboard layout's side padding and the diary's vertical padding, which the
// boards' 24 px page padding is.
const meta = {
  title: "Recipes/RecipeLibraryView",
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

const typeInSearch = (text: string): NonNullable<Story["play"]> => {
  return async ({ canvasElement }) => {
    const field = await within(canvasElement).findByRole("searchbox", { name: "Search recipes" });
    await userEvent.type(field, text);
  };
};

export const Library: Story = {
  render: () => <RecipeLibraryView status="ready" recipes={sampleRecipes} />,
};

export const Search: Story = {
  render: () => <RecipeLibraryView status="ready" recipes={sampleRecipes} />,
  play: typeInSearch("chi"),
};

export const NoMatches: Story = {
  render: () => <RecipeLibraryView status="ready" recipes={sampleRecipes} />,
  play: typeInSearch("pasta"),
};

export const Empty: Story = { render: () => <RecipeLibraryView status="ready" recipes={[]} /> };

// The rows appear after 200 ms, as the skeleton does everywhere.
export const Loading: Story = { render: () => <RecipeLibraryView status="loading" /> };

export const Failed: Story = {
  render: () => <RecipeLibraryView status="error" onRetry={() => undefined} />,
};
