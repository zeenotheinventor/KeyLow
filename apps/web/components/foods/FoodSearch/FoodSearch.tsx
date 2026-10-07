"use client";

import Link from "next/link";
import { useId, useState } from "react";

import { SearchResults } from "./SearchResults";
import { useDebouncedText } from "./useDebouncedText";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

const MIN_QUERY_LENGTH = 2;
const TYPING_PAUSE_MS = 250;

/**
 * The results are only mounted once the typing has paused on a searchable query. A search mounted
 * with its query starts loading at once, so "No foods found" is never shown for a query whose
 * search has not begun, which the search hook cannot tell apart from one that found nothing.
 */
export function FoodSearch() {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const settledQuery = useDebouncedText(query, TYPING_PAUSE_MS).trim();

  return (
    <Card className="flex flex-col gap-4 p-4 md:p-6">
      <h2 className="font-semibold leading-none tracking-tight">Search</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium">
          Search foods
        </label>
        <Input
          id={inputId}
          type="search"
          className="h-11 md:h-9"
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
        />
      </div>
      {settledQuery.length >= MIN_QUERY_LENGTH && <SearchResults query={settledQuery} />}
      <Link
        href="/foods/new"
        className="inline-flex min-h-11 items-center self-start text-sm font-medium underline underline-offset-4 md:min-h-0"
      >
        Create a food
      </Link>
    </Card>
  );
}
