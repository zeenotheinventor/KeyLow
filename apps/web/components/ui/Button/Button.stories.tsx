import { Menu, Plus, Trash2 } from "lucide-react";
import { userEvent } from "storybook/test";

import { Button } from "./Button";

import type { Meta, StoryObj } from "@storybook/nextjs";
import type { ReactNode } from "react";

const meta = {
  title: "UI/Button",
  component: Button,
  args: { children: "Add entry" },
  decorators: [
    (Story) => (
      <div className="flex flex-wrap items-center gap-4 p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Button>;

export default meta;

type Story = StoryObj<typeof meta>;

const variants = ["primary", "secondary", "destructive", "ghost"] as const;

function EveryVariant({
  children,
}: {
  children: (variant: (typeof variants)[number]) => ReactNode;
}) {
  return variants.map((variant) => <div key={variant}>{children(variant)}</div>);
}

export const Primary: Story = { args: { variant: "primary" } };

export const Secondary: Story = { args: { variant: "secondary", children: "Scan barcode" } };

export const Destructive: Story = { args: { variant: "destructive", children: "Delete account" } };

export const Ghost: Story = { args: { variant: "ghost", children: "Cancel" } };

// The destructive action that sits under the main one, such as Delete beside Save: the label and the icon in
// the danger colour on the plain background. The filled destructive variant stays for the point of a view.
const deleteLabel = (
  <>
    <Trash2 aria-hidden />
    Delete
  </>
);

export const GhostDanger: Story = {
  args: { variant: "ghost", tone: "danger", children: deleteLabel },
};

export const GhostDangerFocused: Story = {
  args: { variant: "ghost", tone: "danger", children: deleteLabel },
  play: async () => {
    await userEvent.tab();
  },
};

export const GhostDangerDisabled: Story = {
  args: { variant: "ghost", tone: "danger", disabled: true, children: deleteLabel },
};

export const Small: Story = { args: { variant: "secondary", size: "sm", children: "Look up" } };

export const Large: Story = { args: { size: "lg", children: "Create food" } };

export const WithIcon: Story = {
  args: {
    variant: "secondary",
    children: (
      <>
        <Plus aria-hidden />
        Add portion
      </>
    ),
  },
};

// The icon is 20 px in the 44 and 52 sizes and 16 px in the dense 36 size.
export const SmallWithIcon: Story = {
  args: {
    variant: "secondary",
    size: "sm",
    children: (
      <>
        <Plus aria-hidden />
        Add portion
      </>
    ),
  },
};

export const IconOnly: Story = {
  args: {
    variant: "secondary",
    iconOnly: true,
    "aria-label": "Menu",
    children: <Menu aria-hidden />,
  },
};

// The quiet add button of a food row: a 20 px plus in a 32 px circle with a 1 px border, inside a
// 44 px box that is the button itself.
export const Ring: Story = {
  args: {
    variant: "ring",
    iconOnly: true,
    "aria-label": "Add Chicken breast, grilled, 1 breast (150 g)",
    children: <Plus aria-hidden />,
  },
};

// A story cannot hold a real :hover or :active, so these two apply the classes the hover and press
// states apply, on every variant at once. The unit of truth is still the component's own classes.
export const Hover: Story = {
  render: () => (
    <EveryVariant>
      {(variant) => (
        <Button variant={variant} className="before:bg-hover-overlay">
          {variant}
        </Button>
      )}
    </EveryVariant>
  ),
};

export const Pressed: Story = {
  render: () => (
    <EveryVariant>
      {(variant) => (
        <Button variant={variant} className="scale-press before:bg-press-overlay">
          {variant}
        </Button>
      )}
    </EveryVariant>
  ),
};

// Focus is real: the play function tabs onto the control, so the ring shows as it does for a keyboard.
export const Focused: Story = {
  args: { variant: "primary" },
  play: async () => {
    await userEvent.tab();
  },
};

export const Disabled: Story = {
  render: () => (
    <EveryVariant>
      {(variant) => (
        <Button variant={variant} disabled>
          {variant}
        </Button>
      )}
    </EveryVariant>
  ),
};

export const Loading: Story = {
  render: () => (
    <EveryVariant>
      {(variant) => (
        <Button variant={variant} loading loadingLabel="Saving">
          {variant}
        </Button>
      )}
    </EveryVariant>
  ),
};

export const AsLink: Story = {
  render: () => (
    <Button asChild variant="secondary">
      <a href="#foods">Find food</a>
    </Button>
  ),
};
