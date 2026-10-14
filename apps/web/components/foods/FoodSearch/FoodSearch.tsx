"use client";

import { MIN_SEARCH_LENGTH } from "@keylow/api-client";
import { SEARCH_IDLE } from "@keylow/core/copy";
import { iconStroke } from "@keylow/tokens";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

import { OwnFoodResults } from "./OwnFoodResults";
import { SearchResults } from "./SearchResults";

import type { FoodSearchProps } from "./types";

import { BarcodeLookup } from "@/components/foods/BarcodeLookup";
import { Button } from "@/components/ui/Button";
import { SearchField } from "@/components/ui/SearchField";

const WORDING = {
  all: { title: "Foods", fieldLabel: "Search foods" },
  own: { title: "Your foods", fieldLabel: "Search your foods" },
} as const;

/**
 * The foods page: a search over the user's foods, UK CoFID and Open Food Facts, or, for
 * `scope="own"`, the user's own foods. The barcode button in the search field opens a typed
 * barcode lookup. The search opens with the cursor in the field, except on Your foods, where the
 * list is what the user came for.
 */
export function FoodSearch({ scope = "all", startWithBarcodePanel = false }: FoodSearchProps) {
  const { title, fieldLabel } = WORDING[scope];
  const isOwnFoods = scope === "own";
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [isBarcodePanelOpen, setIsBarcodePanelOpen] = useState(startWithBarcodePanel);

  useEffect(() => {
    if (!isOwnFoods && !startWithBarcodePanel) {
      field.current?.focus();
    }
  }, [isOwnFoods, startWithBarcodePanel]);

  const showsHint = !isOwnFoods && !isBarcodePanelOpen && query.trim().length < MIN_SEARCH_LENGTH;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-h1">{title}</h1>
        <Button asChild variant="secondary" className="px-0 sm:px-4">
          <Link href="/foods/new" aria-label="Create a food">
            <Plus aria-hidden strokeWidth={iconStroke} />
            <span className="hidden sm:inline">Create a food</span>
          </Link>
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor={fieldId} className="text-caption text-text-secondary">
          {fieldLabel}
        </label>
        <SearchField
          id={fieldId}
          ref={field}
          label={fieldLabel}
          placeholder="Name or brand"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          barcodeButton={{
            label: "Look up a barcode",
            expanded: isBarcodePanelOpen,
            onClick: () => {
              setIsBarcodePanelOpen(!isBarcodePanelOpen);
            },
          }}
        />
        {showsHint && <span className="text-caption text-text-muted">{SEARCH_IDLE.hint}</span>}
      </div>
      {isBarcodePanelOpen && (
        <BarcodeLookup
          onClose={() => {
            setIsBarcodePanelOpen(false);
            field.current?.focus();
          }}
        />
      )}
      {isOwnFoods ? <OwnFoodResults query={query} /> : <SearchResults query={query} />}
    </div>
  );
}
