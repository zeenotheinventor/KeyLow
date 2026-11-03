type Listener = () => void;

const listeners = new Set<Listener>();

/** Tells the running app that a one-tap action wrote, so it reads the data again and rewrites the snapshot. */
export function emitWidgetActionDone(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Listens for `emitWidgetActionDone`. Returns the function that stops listening. */
export function onWidgetActionDone(listener: Listener): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}
