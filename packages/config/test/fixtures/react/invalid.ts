declare function useCounter(): number;

export function useMaybeCounter(enabled: boolean): number {
  if (enabled) {
    return useCounter();
  }
  return 0;
}
