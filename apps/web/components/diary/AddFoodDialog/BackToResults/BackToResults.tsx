import { ADD_FOOD_DIALOG } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { ChevronLeft } from "lucide-react";

import type { BackToResultsProps } from "./types";

import { Button } from "@/components/ui/Button";

/** The Results link at the head of the add dialog's amount steps: back to the search, with what was typed still in it. */
export function BackToResults({ onClick }: BackToResultsProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="-ml-3 gap-0.5 self-start px-3 text-label-small"
      onClick={onClick}
    >
      <ChevronLeft aria-hidden strokeWidth={iconStroke} />
      {ADD_FOOD_DIALOG.backToResults}
    </Button>
  );
}
