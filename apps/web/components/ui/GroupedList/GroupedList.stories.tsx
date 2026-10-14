import { GroupedList } from "./GroupedList";

import type { Meta, StoryObj } from "@storybook/nextjs";

import { Banner } from "@/components/ui/Banner";
import { ListRow } from "@/components/ui/ListRow";

const meta = {
  title: "UI/GroupedList",
  component: GroupedList,
  args: {
    title: "Food",
    children: [
      <ListRow
        key="foods"
        title="Your foods"
        subtitle="Foods you created or copied"
        href="/foods"
      />,
      <ListRow
        key="weight"
        title="Weight"
        subtitle="Coming soon"
        onClick={() => undefined}
        disabled
        chevron={false}
      />,
      <ListRow
        key="out"
        title="Sign out"
        subtitle="sam.taylor@example.com"
        onClick={() => undefined}
        chevron={false}
      />,
    ],
  },
  decorators: [
    (Story) => (
      <div className="max-w-xl p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof GroupedList>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithSource: Story = { args: { title: "Common foods", source: "UK CoFID" } };

export const WithSeeMore: Story = {
  args: {
    title: "Common foods",
    source: "UK CoFID",
    seeMore: { hiddenCount: 2, onClick: () => undefined },
  },
};

export const CompactHeader: Story = { args: { title: "Food", headerSize: "compact" } };

export const WithNotice: Story = {
  args: {
    title: "From Open Food Facts",
    source: "Live results",
    notice: (
      <Banner tone="error" title="This product could not be added">
        Check your connection and try again.
      </Banner>
    ),
  },
};

export const SingleRow: Story = {
  args: {
    title: "Account",
    children: (
      <ListRow
        title="Sign out"
        subtitle="sam.taylor@example.com"
        onClick={() => undefined}
        chevron={false}
      />
    ),
  },
};
