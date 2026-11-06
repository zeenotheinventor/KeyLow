"use client";

import { useBodyCompositionKind } from "@keylow/api-client";
import { BODY_COMPOSITION } from "@keylow/core/copy";
import { useId } from "react";

import { BodyCompositionCard } from "../BodyCompositionCard";

import type { BodyCompositionSectionProps } from "./types";

import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton, SkeletonBone } from "@/components/ui/Skeleton";
import { useIsOnline } from "@/lib/useIsOnline";

/**
 * The Body composition section of the Weight page, under the trend chart's legend, as the
 * `web-weight, body-composition-*` boards draw it: a heading over one card for each kind that has readings,
 * side by side from the large breakpoint and stacked under it, and the caption about lean mass when a lean
 * mass card shows. Nothing is typed here and nothing is deleted: the readings come from the phone.
 *
 * The web has no Health Connect, so both kinds read as allowed and there is no permission prompt. A kind
 * still loading is one loading status. A kind that failed with nothing to show is the error state, whose Try
 * again reads the failed kinds again. Neither kind with readings is the heading over one quiet line that says
 * where readings come from. A kind with no readings beside one that has some draws nothing.
 *
 * Offline there is no banner and no notice, since the page draws none: readings already read stay as they
 * are. A read pauses offline, so a kind with nothing read is neither failed nor finished, and the section
 * draws the error state with no Try again, since the read goes ahead by itself when the connection returns.
 */
export function BodyCompositionSection({ range, today }: BodyCompositionSectionProps) {
  const headingId = useId();
  const isOnline = useIsOnline();
  const bodyFat = useBodyCompositionKind("body_fat_pct", { range, today });
  const leanMass = useBodyCompositionKind("lean_mass_kg", { range, today });
  const kinds = [bodyFat, leanMass];

  function renderBody() {
    if (kinds.some((kind) => kind.status === "loading")) {
      if (!isOnline) {
        return (
          <ErrorState
            title={BODY_COMPOSITION.error.title}
            body={BODY_COMPOSITION.error.body}
            size="list"
          />
        );
      }

      return (
        <Skeleton label={BODY_COMPOSITION.loadingLabel} className="grid gap-2 lg:grid-cols-2">
          <SkeletonBone className="h-[106px] rounded-large" />
          <SkeletonBone className="h-[106px] rounded-large" />
        </Skeleton>
      );
    }
    if (kinds.some((kind) => kind.status === "error")) {
      return (
        <ErrorState
          title={BODY_COMPOSITION.error.title}
          body={BODY_COMPOSITION.error.body}
          retryLabel={BODY_COMPOSITION.error.retry}
          size="list"
          onRetry={() => {
            kinds.forEach((kind) => {
              if (kind.status === "error") {
                kind.refetch();
              }
            });
          }}
        />
      );
    }
    const cards = kinds.flatMap((kind) => (kind.status === "readings" ? [kind.card] : []));
    if (cards.length === 0) {
      return (
        <Card>
          {/* The board draws the line in the label size at the regular weight, which no type class has. */}
          <p className="text-[14px] font-normal leading-5 text-text-secondary">
            {BODY_COMPOSITION.noReadingsWeb}
          </p>
        </Card>
      );
    }

    return (
      <>
        <div className={cards.length === 2 ? "grid gap-2 lg:grid-cols-2" : "grid gap-2"}>
          {cards.map((card) => (
            <BodyCompositionCard key={card.kind} {...card} />
          ))}
        </div>
        {cards.some((card) => card.kind === "lean_mass_kg") ? (
          <p className="px-1 text-caption tabular-nums text-text-muted">
            {BODY_COMPOSITION.caption}
          </p>
        ) : null}
      </>
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <div className="flex min-h-[32px] items-center px-1">
        <h2 id={headingId} className="text-body-strong">
          {BODY_COMPOSITION.heading}
        </h2>
      </div>
      {renderBody()}
    </section>
  );
}
