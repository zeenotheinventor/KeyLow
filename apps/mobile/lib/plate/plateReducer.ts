import {
  addToPlate,
  clearPlate,
  removePlateItem,
  replacePlateItem,
  restorePlate,
  setPlateQuantity,
} from "@keylow/core/plate";

import type { PlateTime } from "./types";
import type { PlateItem } from "@keylow/core/plate";

export type PlateState = {
  items: readonly PlateItem[];
  /** What the last clear took away, for Undo. */
  cleared: readonly PlateItem[];
  time: PlateTime;
  addCount: number;
};

export type PlateAction =
  | { type: "add"; item: PlateItem }
  | { type: "setQuantity"; key: string; text: string }
  | { type: "replace"; key: string; item: PlateItem }
  | { type: "remove"; key: string }
  | { type: "clear" }
  | { type: "restore" }
  | { type: "setTime"; time: PlateTime };

export const startingPlate = (time: PlateTime): PlateState => ({
  items: [],
  cleared: [],
  time,
  addCount: 0,
});

export function plateReducer(state: PlateState, action: PlateAction): PlateState {
  switch (action.type) {
    case "add":
      return {
        ...state,
        items: addToPlate(state.items, action.item),
        addCount: state.addCount + 1,
      };
    case "setQuantity":
      return { ...state, items: setPlateQuantity(state.items, action.key, action.text) };
    case "replace":
      return { ...state, items: replacePlateItem(state.items, action.key, action.item) };
    case "remove":
      return { ...state, items: removePlateItem(state.items, action.key) };
    case "clear":
      // An empty plate has nothing to clear, so a second clear does not lose what the first one kept.
      return state.items.length === 0 ? state : { ...state, ...clearPlate(state.items) };
    case "restore":
      return {
        ...state,
        items: restorePlate(state.items, state.cleared),
        cleared: [],
      };
    case "setTime":
      return { ...state, time: action.time };
  }
}
