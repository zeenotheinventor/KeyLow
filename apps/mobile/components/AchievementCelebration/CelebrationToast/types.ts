import type { CelebrationSummary } from "@keylow/core";

export type CelebrationToastProps = {
  summary: CelebrationSummary;
  onView: () => void;
  onClose: () => void;
};
