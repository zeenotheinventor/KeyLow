import { userEvent, within } from "storybook/test";

import { RecipeLibraryView } from "./RecipeLibraryView";
import { sampleRecipes } from "../sampleRecipes";

import type { RecipeLibraryViewProps } from "./types";
import type { Meta, StoryObj } from "@storybook/nextjs";

import { PageFrame } from "@/app/(dashboard)/PageFrame";

// The props are a union, which Storybook's args typing cannot hold, so each story renders its own view.
// Each state of the boards is drawn under the dashboard layout's side padding and the diary's vertical
// padding, which the boards' 24 px page padding is.
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

// The two archived recipes of the boards, and buttons that do nothing: the stories show the page, and the
// actions are tested with the real hook.
const readyProps: Omit<Extract<RecipeLibraryViewProps, { status: "ready" }>, "recipes"> = {
  status: "ready",
  archivedCount: 2,
  isDuplicating: () => false,
  onDuplicate: () => undefined,
  onArchive: () => undefined,
};

const typeInSearch = (text: string): NonNullable<Story["play"]> => {
  return async ({ canvasElement }) => {
    const field = await within(canvasElement).findByRole("searchbox", { name: "Search recipes" });
    await userEvent.type(field, text);
  };
};

export const Library: Story = {
  render: () => <RecipeLibraryView {...readyProps} recipes={sampleRecipes} />,
};

export const Search: Story = {
  render: () => <RecipeLibraryView {...readyProps} recipes={sampleRecipes} />,
  play: typeInSearch("chi"),
};

export const NoMatches: Story = {
  render: () => <RecipeLibraryView {...readyProps} recipes={sampleRecipes} />,
  play: typeInSearch("pasta"),
};

export const Empty: Story = {
  render: () => <RecipeLibraryView {...readyProps} recipes={[]} archivedCount={0} />,
};

// Nothing live, but two put away: the invitation stays and the link to them sits under it.
export const OnlyArchived: Story = {
  render: () => <RecipeLibraryView {...readyProps} recipes={[]} />,
};

// The rows appear after 200 ms, as the skeleton does everywhere.
export const Loading: Story = { render: () => <RecipeLibraryView status="loading" /> };

export const Failed: Story = {
  render: () => <RecipeLibraryView status="error" onRetry={() => undefined} />,
};
