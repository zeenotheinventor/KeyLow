"use client";

import { useTargets } from "@keylow/api-client";
import { GENERIC_ERROR, RETRY_LABEL, TARGETS_PAGE, TARGETS_SCREEN } from "@keylow/core/copy";
import Link from "next/link";

import { TargetsForm } from "../TargetsForm";

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The Targets page, reached from More and from the diary's progress bars: the breadcrumb and heading,
 * then the form once the stored targets are known. The dashboard layout has already put the Terms gate
 * in front of it, so the read here is behind the gate.
 */
export function TargetsScreen() {
  const targets = useTargets();

  function renderBody() {
    if (targets.isError) {
      return (
        <ErrorState
          title={GENERIC_ERROR}
          retryLabel={RETRY_LABEL}
          onRetry={() => {
            void targets.refetch();
          }}
        />
      );
    }
    if (targets.data === undefined) {
      return <Skeleton variant="block" />;
    }

    return <TargetsForm initial={targets.data} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-[560px] flex-col gap-4">
      <div>
        <nav aria-label="Breadcrumb" className="text-caption">
          <Link href="/more" className="rounded-small text-text-primary no-underline">
            {TARGETS_PAGE.more}
          </Link>
          <span className="text-text-muted"> / {TARGETS_SCREEN.title}</span>
        </nav>
        <h1 className="mt-1 text-h1">{TARGETS_SCREEN.title}</h1>
      </div>
      {renderBody()}
    </div>
  );
}
