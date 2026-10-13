import { Check } from "lucide-react";

import type { Meta, StoryObj } from "@storybook/nextjs";

// Placeholder that proves the Storybook pipeline: theme tokens, Geist and Lucide. The kit stories replace it.
function ThemeSeed() {
  return (
    <section className="mx-auto flex max-w-md flex-col gap-4 p-6">
      <h1 className="text-h1 text-text-primary">Ki-Lo theme</h1>
      <div className="flex flex-col gap-3 rounded-medium border border-border bg-surface p-4">
        <p className="text-body text-text-secondary">
          Tokens, Geist and Lucide, in dark and light.
        </p>
        <button
          type="button"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-medium bg-accent px-4 text-body text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2 focus-visible:ring-offset-focus-ring-offset"
        >
          <Check aria-hidden className="size-4" />
          Looks right
        </button>
      </div>
    </section>
  );
}

const meta = {
  title: "Foundations/Theme seed",
  component: ThemeSeed,
} satisfies Meta<typeof ThemeSeed>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};
