import { useProfileTimeZone } from "@keylow/api-client";
import { canLogPlate, plateTotals } from "@keylow/core/plate";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { useIsOnline } from "../../connectivity";
import { useReadsEnabled } from "../../useReadsEnabled";
import { PlateContext } from "../plateContext";
import { plateReducer, startingPlate } from "../plateReducer";

import type { PlateProviderProps } from "./types";
import type {
  PlateContextValue,
  PlateExit,
  PlateItemBuilder,
  PlateLoggingGuard,
  PlateTime,
} from "../types";

const startingTime = (initialTime: string | undefined): PlateTime =>
  initialTime === undefined ? { isNow: true } : { isNow: false, time: initialTime };

/**
 * The plate of one food sheet: what is staged for the diary, shared by the search, the portion picker, the
 * scanner and the food form, because the sheet's layout mounts it around their stack. It lives exactly as
 * long as the sheet, so closing the sheet drops it, and nothing is stored anywhere.
 */
export function PlateProvider({ children, initialTime }: PlateProviderProps) {
  const [state, dispatch] = useReducer(plateReducer, initialTime, (time) =>
    startingPlate(startingTime(time)),
  );
  const [isLogging, setIsLogging] = useState(false);
  const [isLogged, setIsLogged] = useState(false);
  const afterLogged = useRef<(() => void) | undefined>(undefined);
  const [isAsking, setIsAsking] = useState(false);
  const [isDiscarded, setIsDiscarded] = useState(false);
  // Set in the same tick as the press, which a state update is not, so a second press cannot get past it.
  const isLoggingNow = useRef(false);
  const lastKey = useRef(0);
  const isOnline = useIsOnline();
  // The time is read in the profile's zone, so the plate cannot be logged before the zone is known.
  const profileTimeZone = useProfileTimeZone({ enabled: useReadsEnabled() });
  const isZoneKnown = profileTimeZone.data !== undefined;

  const add = useCallback((build: PlateItemBuilder) => {
    lastKey.current += 1;
    dispatch({ type: "add", item: build(`plate-row-${lastKey.current}`) });
  }, []);
  const replace = useCallback((key: string, build: PlateItemBuilder) => {
    dispatch({ type: "replace", key, item: build(key) });
  }, []);
  const setQuantity = useCallback((key: string, text: string) => {
    dispatch({ type: "setQuantity", key, text });
  }, []);
  const remove = useCallback((key: string) => {
    dispatch({ type: "remove", key });
  }, []);
  const clear = useCallback(() => {
    dispatch({ type: "clear" });
  }, []);
  const restore = useCallback(() => {
    dispatch({ type: "restore" });
  }, []);
  const setTime = useCallback((time: PlateTime) => {
    dispatch({ type: "setTime", time });
  }, []);
  const startLogging = useCallback(() => {
    if (isLoggingNow.current) {
      return false;
    }
    isLoggingNow.current = true;
    setIsLogging(true);

    return true;
  }, []);
  const finishLogging = useCallback(() => {
    isLoggingNow.current = false;
    setIsLogging(false);
  }, []);

  const markLogged = useCallback((afterwards: () => void) => {
    afterLogged.current = afterwards;
    setIsLogged(true);
  }, []);
  // Runs after the render that shows the plate as logged, which is the first one the sheet's guard lets a close through.
  useEffect(() => {
    if (isLogged) {
      const afterwards = afterLogged.current;
      afterLogged.current = undefined;
      afterwards?.();
    }
  }, [isLogged]);

  const ask = useCallback(() => {
    setIsAsking(true);
  }, []);
  const keep = useCallback(() => {
    setIsAsking(false);
  }, []);
  const discard = useCallback(() => {
    setIsAsking(false);
    setIsDiscarded(true);
  }, []);

  const { items, time, addCount } = state;
  const value = useMemo<PlateContextValue & PlateLoggingGuard & PlateExit>(
    () => ({
      items,
      count: items.length,
      totals: plateTotals(items),
      canLog: canLogPlate(items) && isOnline && isZoneKnown && !isLogging,
      add,
      setQuantity,
      replace,
      remove,
      clear,
      restore,
      time,
      setTime,
      isLogging,
      isLogged,
      addCount,
      startLogging,
      finishLogging,
      markLogged,
      isAsking,
      isDiscarded,
      ask,
      keep,
      discard,
    }),
    [
      items,
      time,
      addCount,
      isOnline,
      isZoneKnown,
      isLogging,
      isLogged,
      add,
      setQuantity,
      replace,
      remove,
      clear,
      restore,
      setTime,
      startLogging,
      finishLogging,
      markLogged,
      isAsking,
      isDiscarded,
      ask,
      keep,
      discard,
    ],
  );

  return <PlateContext.Provider value={value}>{children}</PlateContext.Provider>;
}
