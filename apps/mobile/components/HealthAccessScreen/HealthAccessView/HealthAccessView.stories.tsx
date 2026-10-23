import { HealthAccessView } from "./HealthAccessView";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Weight/HealthAccessView",
  component: HealthAccessView,
  args: {
    importedCount: 64,
    onClose: () => undefined,
    onPrimary: () => undefined,
    onSecondary: () => undefined,
    onOpenPrivacyPolicy: () => undefined,
  },
} satisfies Meta<typeof HealthAccessView>;

export default meta;

type Story = StoryObj<typeof meta>;

// The six states of `health-access: permissions flow`, each drawn in the theme the toolbar picks.
export const Explain: Story = { args: { step: "explain" } };

export const Install: Story = { args: { step: "install" } };

export const Connecting: Story = { args: { step: "connecting" } };

export const Denied: Story = { args: { step: "denied" } };

export const ImportError: Story = { args: { step: "import-error" } };

export const Connected: Story = { args: { step: "connected" } };
