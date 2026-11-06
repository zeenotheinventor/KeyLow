"use client";

import { plateReducer, plateTotals, startingPlate } from "@keylow/core/plate";
import { useCallback, useMemo, useReducer, useRef, useState } from "react";

import { PlateContext } from "./PlateContext";

import type { PlateContextValue, PlateItemBuilder, PlateProviderProps } from "./types";
import type { PlateTime } from "@keylow/core/plate";

const startingTime = (initialTime: string | undefined): PlateTime =>
  initialTime === undefined ? { isNow: true } : { isNow: false, time: initialTime };

/**
 * The plate of one Add food dialog: what is staged for the diary, shared by the search and the amount steps.
 * It lives exactly as long as the dialog, so closing the dialog drops it, and nothing is stored anywhere.
 */
export function PlateProvider({ children, initialTime }: PlateProviderProps) {
  const [state, dispatch] = useReducer(plateReducer, initialTime, (time) =>
    startingPlate(startingTime(time)),
  );
  const [isLogging, setIsLogging] = useState(false);
  // Set in the same tick as the press, which a state update is not, so a second press cannot get past it.
  const isLoggingNow = useRef(false);
  const lastKey = useRef(0);

  const add = useCallback((build: PlateItemBuilder) => {
    lastKey.current += 1;
    dispatch({ type: "add", item: build(`plate-row-${lastKey.current}`) });
  }, []);
  const setQuantity = useCallback((key: string, text: string) => {
    dispatch({ type: "setQuantity", key, text });
  }, []);
  const replace = useCallback((key: string, build: PlateItemBuilder) => {
    dispatch({ type: "replace", key, item: build(key) });
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

  const { items, time } = state;
  const value = useMemo<PlateContextValue>(
    () => ({
      items,
      count: items.length,
      totals: plateTotals(items),
      add,
      setQuantity,
      replace,
      remove,
      clear,
      restore,
      time,
      setTime,
      isLogging,
      startLogging,
      finishLogging,
    }),
    [
      items,
      time,
      isLogging,
      add,
      setQuantity,
      replace,
      remove,
      clear,
      restore,
      setTime,
      startLogging,
      finishLogging,
    ],
  );

  return <PlateContext.Provider value={value}>{children}</PlateContext.Provider>;
}
