export type ThemeGlobalsPayload = { globals: Record<string, unknown> };

/** The part of Storybook's channel the theme addon uses. */
export type ThemeChannel = {
  emit: (eventName: string, payload: ThemeGlobalsPayload) => void;
  on: (eventName: string, listener: (payload: ThemeGlobalsPayload) => void) => void;
};
