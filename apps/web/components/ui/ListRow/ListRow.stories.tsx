import { userEvent } from "storybook/test";

import { ListRow } from "./ListRow";

import type { Meta, StoryObj } from "@storybook/nextjs";

// A row lives in a list on a card, so every story draws it on one. The props are a union (a link, a
// button or plain text), which Storybook's args typing cannot hold, so each story renders its own row.
const meta = {
  title: "UI/ListRow",
  decorators: [
    (Story) => (
      <div className="max-w-xl p-6">
        <ul className="overflow-hidden rounded-large border border-border bg-surface shadow-card">
          <Story />
        </ul>
      </div>
    ),
  ],
} satisfies Meta;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => <ListRow title="Your foods" subtitle="Foods you created or copied" href="/foods" />,
};

// A row that runs an action, such as signing out, has no chevron.
export const Action: Story = {
  render: () => (
    <ListRow
      title="Sign out"
      subtitle="sam.taylor@example.com"
      onClick={() => undefined}
      chevron={false}
    />
  ),
};

export const Plain: Story = {
  render: () => <ListRow title="Expenditure" subtitle="Estimate" />,
};

export const Disabled: Story = {
  render: () => (
    <ListRow
      title="Weight"
      subtitle="Coming soon"
      onClick={() => undefined}
      disabled
      chevron={false}
    />
  ),
};

// A story cannot hold a real :hover or :active, so these two apply the classes the hover and press
// states apply. The unit of truth is still the component's own classes.
export const Hover: Story = {
  render: () => (
    <ListRow
      title="Your foods"
      subtitle="Foods you created or copied"
      href="/foods"
      className="bg-hover-overlay"
    />
  ),
};

export const Pressed: Story = {
  render: () => (
    <ListRow
      title="Your foods"
      subtitle="Foods you created or copied"
      href="/foods"
      className="scale-[0.985] bg-press-overlay"
    />
  ),
};

// Focus is real: the play function tabs onto the row, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  render: () => <ListRow title="Your foods" subtitle="Foods you created or copied" href="/foods" />,
  play: async () => {
    await userEvent.tab();
  },
};
