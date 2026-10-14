import { Skeleton, SkeletonBone } from "./Skeleton";

import type { Meta, StoryObj } from "@storybook/nextjs";

// A skeleton shows nothing for its first 200 ms, so each story fills in a moment after it loads. The
// props are a union (a built in shape or bones as children), which Storybook's args typing cannot
// hold, so each story renders its own skeleton.
const meta = {
  title: "UI/Skeleton",
  decorators: [
    (Story) => (
      <div className="max-w-2xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Rows: Story = {
  render: () => <Skeleton variant="rows" count={3} label="Searching your foods" />,
};

export const Text: Story = { render: () => <Skeleton variant="text" lines={3} /> };

export const Block: Story = { render: () => <Skeleton variant="block" /> };

// Bones shaped like the food page, as the detail board draws its loading state.
export const Custom: Story = {
  render: () => (
    <Skeleton label="Loading food" className="flex flex-col gap-4">
      <SkeletonBone className="h-7 w-[70%]" />
      <SkeletonBone className="h-5 w-[120px] rounded-pill" />
      <SkeletonBone className="h-[140px] rounded-large" />
      <SkeletonBone className="h-[220px] rounded-large" />
    </Skeleton>
  ),
};
