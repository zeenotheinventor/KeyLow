import type { ThemePreference } from "@/lib/theme/themeCookie";

export type AppearanceSettingProps = {
  /** The preference saved in the `kl-theme` cookie, read on the server. */
  initialPreference: ThemePreference;
};
