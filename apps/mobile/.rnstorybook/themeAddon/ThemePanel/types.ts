import type { ThemeChannel } from "../types";

export type ThemePanelProps = {
  channel: Pick<ThemeChannel, "emit">;
};
