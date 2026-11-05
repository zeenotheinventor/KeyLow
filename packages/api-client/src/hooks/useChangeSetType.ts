import { SET_ENTRY } from "@keylow/core/copy";
import { onlineManager } from "@tanstack/react-query";
import { useRef, useState } from "react";

import { useUpdateSet } from "./useUpdateSet";

import type { ChangeSetTypeRequest } from "./sessionViewTypes";
import type { SetNotices } from "./useRemoveSetWithUndo";

type ChangeSetType = {
  changeSetType: (request: ChangeSetTypeRequest) => Promise<void>;
  /** Whether a change of the set's type is on its way. Its mark does nothing until the write lands. */
  isChangingType: (setId: string) => boolean;
};

/**
 * Changes the type of a logged set. The row and the header move when the session read holds the stored set,
 * so a write that fails or cannot be made changes nothing on screen. Needs a connection: with none, nothing
 * is written and nothing is kept for later. A failure says the set did not save, never what its numbers
 * were, through `notices`, which is how the app tells the person. The set is reported as changing while its
 * write is on its way, and the screen leaves its mark inert for that time, so a second change is never asked
 * for and lost.
 */
export function useChangeSetType({ onFailure }: SetNotices): ChangeSetType {
  const updateSet = useUpdateSet();
  // The ref answers a second choice that arrives before React has drawn the first. The state redraws the mark.
  const changingRef = useRef(new Set<string>());
  const [changing, setChanging] = useState<ReadonlySet<string>>(new Set());

  const changeSetType = async ({ setId, setType }: ChangeSetTypeRequest) => {
    if (changingRef.current.has(setId)) {
      return;
    }
    if (!onlineManager.isOnline()) {
      onFailure(SET_ENTRY.saveFailed);
      return;
    }
    changingRef.current.add(setId);
    setChanging(new Set(changingRef.current));
    try {
      await updateSet.mutateAsync({ id: setId, patch: { set_type: setType } });
    } catch {
      onFailure(SET_ENTRY.saveFailed);
    } finally {
      changingRef.current.delete(setId);
      setChanging(new Set(changingRef.current));
    }
  };

  return { changeSetType, isChangingType: (setId) => changing.has(setId) };
}
