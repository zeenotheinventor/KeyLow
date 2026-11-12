import { FavouriteRuleError } from "@keylow/api-client";
import {
  describeFavouriteChange,
  describeFavouriteFailure,
  describeFavouriteHeart,
} from "@keylow/core/copy";
import { CircleAlert, Heart } from "lucide-react";
import { useRef } from "react";

import type { IconButtonProps } from "@/components/ui/IconButton";

import { useToast } from "@/components/ui/Toast";
import { useIsOnline } from "@/lib/useIsOnline";

type FavouriteHeartOptions = {
  isFavourite: boolean;
  /** Whether the favourites have been read, so the heart never guesses the state it is in. */
  isRead: boolean;
  /** Asks for the change. It rejects when the write fails, after the shared hook has put the heart back. */
  toggle: (favourite: boolean) => Promise<unknown>;
};

/**
 * What an `IconButton` needs to be the heart of a food's or a recipe's header. A press changes the favourite
 * at once and shows its toast, which a write that fails replaces with one fixed sentence: the cap when the
 * limit refused it, the generic error for anything else, never the failure itself. The heart is disabled
 * offline and until the favourites have been read, because the change needs a connection. A disabled heart
 * says so with `aria-disabled` and stays in the tab order, so a keyboard user does not lose their place.
 * While a write is on its way another press does nothing, so a double press changes the favourite once.
 */
export function useFavouriteHeart({
  isFavourite,
  isRead,
  toggle,
}: FavouriteHeartOptions): IconButtonProps {
  const toast = useToast();
  const isOnline = useIsOnline();
  const isWriting = useRef(false);
  const heart = describeFavouriteHeart({ isFavourite, isOnline, isRead });

  function press() {
    if (isWriting.current) {
      return;
    }
    isWriting.current = true;
    const favourite = !isFavourite;
    toast.show({
      message: describeFavouriteChange(favourite),
      icon: Heart,
      tone: favourite ? "success" : "neutral",
    });
    toggle(favourite)
      .catch((error: unknown) => {
        toast.show({
          message: describeFavouriteFailure(error instanceof FavouriteRuleError),
          icon: CircleAlert,
          tone: "danger",
        });
      })
      .finally(() => {
        isWriting.current = false;
      });
  }

  return {
    icon: Heart,
    label: heart.label,
    isFilled: heart.isFilled,
    "aria-disabled": heart.isDisabled || undefined,
    onClick: heart.isDisabled ? undefined : press,
  };
}
