import { RotateCw, TriangleAlert } from "lucide-react";

import type { ErrorStateProps } from "./types";

import { EmptyState } from "@/components/ui/EmptyState";

/** Fills a view or a card when a load failed: a short, factual message and, when trying again can help, a retry. */
export function ErrorState({
  title = "Something went wrong",
  onRetry,
  retryLabel = "Try again",
  ...rest
}: ErrorStateProps) {
  return (
    <EmptyState
      icon={TriangleAlert}
      tone="danger"
      role="alert"
      title={title}
      action={
        onRetry === undefined ? undefined : { label: retryLabel, icon: RotateCw, onClick: onRetry }
      }
      {...rest}
    />
  );
}
