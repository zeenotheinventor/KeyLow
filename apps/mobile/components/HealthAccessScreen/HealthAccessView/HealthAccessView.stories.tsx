import { HealthAccessView } from "./HealthAccessView";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "Weight/HealthAccessView",
  component: HealthAccessView,
  args: {
    importedCount: 64,
    bodyCounts: { bodyFat: 0, leanMass: 0 },
    bodyCompositionAccess: { bodyFat: false, leanMass: false },
    onAddBodyComposition: () => undefined,
    onClose: () => undefined,
    onPrimary: () => undefined,
    onSecondary: () => undefined,
    onOpenPrivacyPolicy: () => undefined,
  },
} satisfies Meta<typeof HealthAccessView>;

export default meta;

type Story = StoryObj<typeof meta>;

// The states of `health-access: permissions flow`, each drawn in the theme the toolbar picks.
export const Explain: Story = { args: { step: "explain" } };

export const Install: Story = { args: { step: "install" } };

// Weight only keeps "Reading your weight history.", so the body composition words need a type allowed.
export const Connecting: Story = {
  args: { step: "connecting", bodyCompositionAccess: { bodyFat: true, leanMass: true } },
};

export const ConnectingWeightOnly: Story = { args: { step: "connecting" } };

export const Denied: Story = { args: { step: "denied" } };

export const ImportError: Story = { args: { step: "import-error" } };

// The counts line shows only when some body readings came in.
export const Connected: Story = {
  args: {
    step: "connected",
    bodyCompositionAccess: { bodyFat: true, leanMass: true },
    bodyCounts: { bodyFat: 12, leanMass: 12 },
  },
};

export const ExplainBodyComposition: Story = { args: { step: "explain-body-composition" } };

export const DeniedBodyComposition: Story = { args: { step: "denied-body-composition" } };

// Weight only: the block under the heading says neither type was allowed.
export const ConnectedPartial: Story = { args: { step: "connected-partial" } };

export const ConnectedPartialLeanMassMissing: Story = {
  args: {
    step: "connected-partial",
    bodyCompositionAccess: { bodyFat: true, leanMass: false },
    bodyCounts: { bodyFat: 5, leanMass: 0 },
  },
};

export const ConnectedPartialBodyFatMissing: Story = {
  args: {
    step: "connected-partial",
    bodyCompositionAccess: { bodyFat: false, leanMass: true },
    bodyCounts: { bodyFat: 0, leanMass: 5 },
  },
};
