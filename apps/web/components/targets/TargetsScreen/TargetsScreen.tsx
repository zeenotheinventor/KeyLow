"use client";

import { useProgramSummary, useTargets } from "@keylow/api-client";
import { GENERIC_ERROR, RETRY_LABEL, TARGETS_PAGE, TARGETS_SCREEN } from "@keylow/core/copy";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { EngineTargets } from "../EngineTargets";
import { TargetsForm } from "../TargetsForm";

import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";
import { cn } from "@/lib/utils";

/**
 * The Targets page, reached from More and from the diary's progress bars: the breadcrumb and heading,
 * then the form once the stored targets are known. While a programme runs (`source` is "engine") the targets
 * are its own and are shown read only, with Set my own targets opening the same form, whose save asks first
 * because it ends the programme. That is told by the targets alone, as the phone's is: the programme read only
 * gives the date they began, so it never decides which of the two the person sees, and until the targets are
 * known the page draws neither. The web has no persisted cache and a read pauses offline, so with nothing read
 * and no connection the page says so, without a Try again that would do nothing. The dashboard layout has
 * already put the Terms gate in front of it, so the read here is behind the gate.
 */
export function TargetsScreen() {
  const targets = useTargets();
  const isOnline = useIsOnline();
  // Only a person whose programme runs has anything to read here, so no one else makes the extra request.
  const programSummary = useProgramSummary({ enabled: targets.data?.source === "engine" });
  const [isSettingOwnTargets, setIsSettingOwnTargets] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  // Set my own targets goes when the form opens, so focus moves to the page heading instead of being lost to the body.
  useEffect(() => {
    if (isSettingOwnTargets) {
      heading.current?.focus();
    }
  }, [isSettingOwnTargets]);

  function renderBody() {
    // Held targets win over a failed read: a refresh that fails must not replace the figures, or a form being typed
    // in, with an error. The error shows only when there is nothing to show.
    if (targets.data === undefined) {
      if (targets.isError) {
        // Offline, trying again would only wait for the connection, so it is not offered.
        return isOnline ? (
          <ErrorState
            title={GENERIC_ERROR}
            retryLabel={RETRY_LABEL}
            onRetry={() => {
              void targets.refetch();
            }}
          />
        ) : (
          <ErrorState title={GENERIC_ERROR} />
        );
      }

      return !isOnline || targets.fetchStatus === "paused" ? (
        <ErrorState title={GENERIC_ERROR} />
      ) : (
        <Skeleton variant="block" />
      );
    }
    if (targets.data.source === "engine" && !isSettingOwnTargets) {
      return (
        <EngineTargets
          targets={targets.data}
          since={programSummary.data?.currentTargets?.effectiveFrom}
          isOnline={isOnline}
          onSetOwnTargets={() => {
            setIsSettingOwnTargets(true);
          }}
        />
      );
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
        <h1
          ref={heading}
          tabIndex={isSettingOwnTargets ? -1 : undefined}
          className={cn("mt-1 text-h1", isSettingOwnTargets && "outline-none")}
        >
          {TARGETS_SCREEN.title}
        </h1>
      </div>
      {renderBody()}
    </div>
  );
}
