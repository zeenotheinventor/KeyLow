declare function useCounter(): number;

export function useMaybeCounter(enabled: boolean): number {
  if (enabled) {
    return useCounter();
  }
  return 0;
}

export const { EXPO_PUBLIC_URL } = process.env;
export const icon: unknown = require("./icon.png");
export const other: unknown = require("./other");

export const listFormat = new Intl.ListFormat("en-GB");
