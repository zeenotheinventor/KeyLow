import { useEffect, useState } from "react";

/** The latest `text`, but only once it has stayed the same for `delayMs`. The first text is returned at once. */
export function useDebouncedText(text: string, delayMs: number): string {
  const [debouncedText, setDebouncedText] = useState(text);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedText(text);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
    };
  }, [text, delayMs]);

  return debouncedText;
}
