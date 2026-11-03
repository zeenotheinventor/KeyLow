import { FavouriteRuleError } from "@keylow/api-client";
import { FAVOURITE_HEART, FAVOURITE_TOAST, GENERIC_ERROR } from "@keylow/core/copy";

import { useToast } from "../../components/ui";
import { useIsOnline } from "../connectivity";

import type { SheetHeaderControl } from "../../components/ui";

type FavouriteHeartOptions = {
  isFavourite: boolean;
  /** Whether the favourites have been read, so the heart never guesses the state it is in. */
  isRead: boolean;
  /** The height of the header the heart is in, which the toast sits under so the heart stays in view. */
  headerHeight: number;
  /** Asks for the change. `onError` is told when the write fails, after the hook has put the heart back. */
  toggle: (favourite: boolean, onError: (error: Error) => void) => void;
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
            message: FAVOURITE_TOAST.added,
            icon: "Heart",
            isIconFilled: true,
            tone: "accent",
            topOffset: headerHeight,
          }
        : { message: FAVOURITE_TOAST.removed, icon: "Heart", topOffset: headerHeight },
    );
    toggle(favourite, (error) => {
      toast.show({
        message: error instanceof FavouriteRuleError ? FAVOURITE_TOAST.limitReached : GENERIC_ERROR,
        icon: "CircleAlert",
        tone: "danger",
        topOffset: headerHeight,
      });
    });
  }

  return {
    icon: "Heart",
    label: isFavourite ? FAVOURITE_HEART.remove : FAVOURITE_HEART.add,
    isFilled: isFavourite,
    disabled: !isOnline || !isRead,
    onPress: press,
  };
}
