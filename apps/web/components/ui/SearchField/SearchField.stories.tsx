import { userEvent } from "storybook/test";

import { SearchField, SearchLauncher } from "./SearchField";

import type { Meta, StoryObj } from "@storybook/nextjs";

const barcodeButton = { label: "Look up a barcode", expanded: false, onClick: () => undefined };

const meta = {
  title: "UI/SearchField",
  component: SearchField,
  args: { label: "Search foods", placeholder: "Name or brand", barcodeButton },
  decorators: [
    (Story) => (
      <div className="max-w-lg p-6">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Filled: Story = { args: { defaultValue: "greek yoghurt" } };

// Focus is real: the play function tabs onto the box, so the accent border and ring show.
export const Focused: Story = {
  play: async () => {
    await userEvent.tab();
  },
};

// Two tabs: the first lands on the search box, the second on the barcode button.
export const BarcodeFocused: Story = {
  play: async () => {
    await userEvent.tab();
    await userEvent.tab();
  },
};

export const BarcodeOpen: Story = {
  args: { barcodeButton: { ...barcodeButton, expanded: true } },
};

export const WithoutBarcode: Story = {
  render: () => <SearchField label="Search foods" placeholder="Name or brand" />,
};

export const Disabled: Story = { args: { disabled: true } };

export const Compact: Story = {
  args: { size: "sm", placeholder: "Search for a food" },
  decorators: [
    (Story) => (
      <div className="w-[320px]">
        <Story />
      </div>
    ),
  ],
};

export const Launcher: Story = {
  render: () => (
    <SearchLauncher
      label="Search for a food"
      onSearch={() => undefined}
      barcodeButton={barcodeButton}
    />
  ),
};

export const LauncherCompact: Story = {
  render: () => (
    <div className="w-[320px]">
      <SearchLauncher
        size="sm"
        label="Search for a food"
        onSearch={() => undefined}
        barcodeButton={barcodeButton}
      />
    </div>
  ),
};

export const LauncherFocused: Story = {
  render: () => (
    <SearchLauncher
      label="Search for a food"
      onSearch={() => undefined}
      barcodeButton={barcodeButton}
    />
  ),
  play: async () => {
    await userEvent.tab();
  },
};
