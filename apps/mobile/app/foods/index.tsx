import { useFoodSearch, useMaterialiseOffProduct } from "@keylow/api-client";
import { useRouter } from "expo-router";
import { useState } from "react";

import { FoodSearch, describeAddProductError } from "../../components/FoodSearch";
import { useDebouncedValue } from "../../lib/useDebouncedValue";

const SEARCH_DEBOUNCE_MS = 250;

export default function FoodSearchRoute() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  // The screen debounces the typing itself, so what it shows and what is searched for are one value.
  const debouncedQuery = useDebouncedValue(query.trim(), SEARCH_DEBOUNCE_MS);
  const results = useFoodSearch(debouncedQuery, { debounceMs: 0 });
  // The search hook takes the query on one timer tick after it is handed it. Until then it reports
  // nothing found, so the screen follows one tick behind rather than show that for a moment.
  const searchedQuery = useDebouncedValue(debouncedQuery, 0);
  const materialiseOffProduct = useMaterialiseOffProduct();
  const [pendingCandidateCode, setPendingCandidateCode] = useState<string | undefined>(undefined);
  const [candidateError, setCandidateError] = useState<string | undefined>(undefined);

  async function selectCandidate(code: string) {
    setPendingCandidateCode(code);
    setCandidateError(undefined);
    try {
      const food = await materialiseOffProduct.mutateAsync({ code });
      router.push(`/foods/${food.id}`);
    } catch (error) {
      setCandidateError(describeAddProductError(error));
    } finally {
      setPendingCandidateCode(undefined);
    }
  }

  return (
    <FoodSearch
      query={query}
      searchedQuery={searchedQuery}
      onQueryChange={(text) => {
        setQuery(text);
        setCandidateError(undefined);
      }}
      results={results}
      pendingCandidateCode={pendingCandidateCode}
      candidateError={candidateError}
      onSelectFood={(foodId) => {
        router.push(`/foods/${foodId}`);
      }}
      onSelectCandidate={(code) => void selectCandidate(code)}
      onCreateFood={() => {
        router.push("/foods/new");
      }}
      onScanBarcode={() => {
        router.push("/foods/scan");
      }}
    />
  );
}
