import { FavouriteRuleError } from "@keylow/api-client";
import {
  describeFavouriteChange,
  describeFavouriteFailure,
  describeFavouriteHeart,
} from "@keylow/core/copy";

import { useToast } from "../../components/ui";
import { useIsOnline } from "../connectivity";

import type { SheetHeaderControl } from "../../components/ui";

type FavouriteHeartOptions = {
  isFavourite: boolean;
  /** Whether the favourites have been read, so the heart never guesses the state it is in. */
  isRead: boolean;
  /** The height of the header the heart is in, which the toast sits under so the heart stays in view. */
  headerHeight: number;
  /** Asks for the change. It rejects when the write fails, after the hook has put the heart back. */
  toggle: (favourite: boolean) => Promise<unknown>;
};

/**
 * The heart control of a food's or a recipe's header. A tap changes the favourite at once and shows its toast
 * under the header, which a write that fails replaces with one fixed sentence: the cap when the limit refused
 * it, the generic error for anything else, never the failure itself. It is disabled offline and until the
 * favourites have been read, because the change needs a connection.
 */
export function useFavouriteHeart({
  isFavourite,
  isRead,
  headerHeight,
  toggle,
}: FavouriteHeartOptions): SheetHeaderControl {
  const toast = useToast();
  const isOnline = useIsOnline();

  function press() {
    const favourite = !isFavourite;
    toast.show(
      favourite
        ? {
            message: describeFavouriteChange(true),
            icon: "Heart",
            isIconFilled: true,
            tone: "accent",
            topOffset: headerHeight,
          }
        : { message: describeFavouriteChange(false), icon: "Heart", topOffset: headerHeight },
    );
    // The promise belongs to this tap, so the failure is told even when a later tap has replaced it or the
    // sheet has closed. The toast layer is above the screens, so it is still there to show it.
    toggle(favourite).catch((error: unknown) => {
      toast.show({
        message: describeFavouriteFailure(error instanceof FavouriteRuleError),
        icon: "CircleAlert",
        tone: "danger",
        topOffset: headerHeight,
      });
    });
  }

  const heart = describeFavouriteHeart({ isFavourite, isOnline, isRead });

  return {
    icon: "Heart",
    label: heart.label,
    isFilled: heart.isFilled,
    disabled: heart.isDisabled,
    onPress: press,
  };
}
