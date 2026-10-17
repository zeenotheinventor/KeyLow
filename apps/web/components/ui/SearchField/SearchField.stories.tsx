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

// Focus is real: the play function tabs onto the box, so the accent border shows. The ring joins
// it in the light theme.
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

// The clear button shows once the field holds text. A screen that wants one passes it.
export const WithClear: Story = {
  render: () => (
    <SearchField
      label="Search recipes"
      value="chi"
      onChange={() => undefined}
      clear={{ label: "Clear search", onClick: () => undefined }}
    />
  ),
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

// The top bar's launcher: 44 high below the large breakpoint and 36 from it.
export const LauncherAdaptive: Story = {
  render: () => (
    <SearchLauncher
      size="adaptive"
      label="Search for a food"
      onSearch={() => undefined}
      barcodeButton={barcodeButton}
    />
  ),
};

// The launcher draws the ring with the border in both themes.
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

// Offline the top bar's launcher is dimmed to half and opens nothing. It stays focusable.
export const LauncherDisabled: Story = {
  render: () => (
    <SearchLauncher
      label="Search for a food"
      onSearch={() => undefined}
      barcodeButton={barcodeButton}
      disabled
    />
  ),
};
