declare function useCounter(): number;

export function useDoubledCounter(): number {
  return useCounter() * 2;
}
