import { LogIdle } from "../LogIdle";
import { SearchResults } from "../SearchResults";
import { useAddServing } from "../useAddServing";

import type { LogSearchResultsProps } from "./types";

/**
 * The search sheet's results while food is being logged: the idle state is Quick add and Recent, and each
 * row shows a serving with a plus that logs it at once. Only here is the toast and the log needed, so the
 * plain search never asks for them.
 */
export function LogSearchResults({
  query,
  logging,
  onOpenFood,
  onCreateFood,
}: LogSearchResultsProps) {
  const { canAdd, addHit, addRecent } = useAddServing(logging.context);

  return (
    <SearchResults
      idleContent={
        <LogIdle
          addDisabled={!canAdd}
          onAdd={addRecent}
          onOpen={(recent) => {
            logging.onOpenRecent(recent.foodId);
          }}
        />
      }
      logRows={{ addDisabled: !canAdd, onAdd: addHit }}
      query={query}
      onCreateFood={onCreateFood}
      onOpenFood={onOpenFood}
    />
  );
}
