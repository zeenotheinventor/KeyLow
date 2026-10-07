"use client";

import { useMaterialiseOffProduct } from "@keylow/api-client";
import { useRouter } from "next/navigation";
import { useId } from "react";

import type { OffCandidateListProps } from "./types";

import { describeEnergy } from "@/components/foods/foodDisplay";
import { Button } from "@/components/ui/button";

export function OffCandidateList({ candidates }: OffCandidateListProps) {
  const router = useRouter();
  const headingId = useId();
  const materialise = useMaterialiseOffProduct();

  function choose(code: string) {
    materialise.mutate(
      { code },
      {
        onSuccess: (food) => {
          router.push(`/foods/${food.id}`);
        },
      },
    );
  }

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <h3 id={headingId} className="font-semibold">
        From Open Food Facts
      </h3>
      <ul className="flex flex-col gap-2">
        {candidates.map((candidate) => (
          <li key={candidate.code}>
            <Button
              type="button"
              variant="outline"
              disabled={materialise.isPending}
              className="h-auto min-h-11 w-full flex-col items-start justify-start gap-1 whitespace-normal p-3 text-left"
              onClick={() => {
                choose(candidate.code);
              }}
            >
              <span className="font-medium">{candidate.name}</span>
              {candidate.brand !== null && (
                <span className="text-sm font-normal text-muted-foreground">{candidate.brand}</span>
              )}
              <span className="text-sm font-normal text-muted-foreground">
                {describeEnergy(candidate)}
              </span>
            </Button>
          </li>
        ))}
      </ul>
      {materialise.error !== null && (
        <p role="alert" className="text-sm text-destructive">
          {materialise.error.message}
        </p>
      )}
    </section>
  );
}
