import type { EmptyStateProps } from "@/components/ui/EmptyState";

export type ErrorStateProps = Pick<
  EmptyStateProps,
  "body" | "headingLevel" | "size" | "className"
> & {
  /** Says what failed. Defaults to "Something went wrong". */
  title?: string;
  /** Offers a retry button when set. Leave it out when trying again would not help. */
  onRetry?: () => void;
  /** Defaults to "Try again". */
  retryLabel?: string;
};
