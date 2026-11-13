import { INGREDIENT_BARCODE, SEARCH_LAUNCHER } from "@keylow/core/copy";
import { useEffect, useRef, useState } from "react";

import { BarcodeLookup } from "./BarcodeLookup";

import type { Food } from "@keylow/core/schemas";
import type { RefObject } from "react";

import { useIsOnline } from "@/lib/useIsOnline";

type BarcodeSearchOptions = {
  searchField: RefObject<HTMLInputElement | null>;
  /** The food a typed code finds, which the dialog opens on its amount step. */
  onFound: (food: Food) => void;
  /** What a code nobody has leaves as it is in the new tab it opens. Defaults to the recipe. */
  keeps?: "recipe" | "plate";
};

/**
 * What the search field's barcode button and the typed lookup panel under it need, as the Add ingredient
 * dialog and the Add food dialog have them. A lookup needs a connection, so offline the button is off and says why.
 */
export function useBarcodeSearch({ searchField, onFound, keeps }: BarcodeSearchOptions) {
  const isOnline = useIsOnline();
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  // A panel that goes away offline takes the cursor with it, so the cursor goes back to the search.
  useEffect(() => {
    if (!isOnline && panel.current?.contains(document.activeElement) === true) {
      searchField.current?.focus();
    }
  }, [isOnline, searchField]);

  const barcodeButton = {
    label: SEARCH_LAUNCHER.lookUpLabel,
    expanded: isOnline && isPanelOpen,
    disabled: !isOnline,
    onClick: () => {
      setIsPanelOpen(!isPanelOpen);
    },
  };

  const barcodePanel = (
    <>
      {!isOnline && <p className="text-caption text-text-muted">{INGREDIENT_BARCODE.offline}</p>}
      {isPanelOpen && (
        // Offline the panel is hidden, not removed, so the digits typed in it are still there on return.
        <div ref={panel} hidden={!isOnline}>
          <BarcodeLookup
            keeps={keeps}
            onClose={() => {
              setIsPanelOpen(false);
              searchField.current?.focus();
            }}
            onFound={(food) => {
              setIsPanelOpen(false);
              onFound(food);
            }}
          />
        </div>
      )}
    </>
  );

  return { barcodeButton, barcodePanel };
}
