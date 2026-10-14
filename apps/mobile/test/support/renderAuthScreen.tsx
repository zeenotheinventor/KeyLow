import { render } from "@testing-library/react-native";

import { ThemeProvider } from "../../lib/theme";

import type { ThemeScheme } from "@keylow/tokens";
import type { ReactElement } from "react";

/** Renders an auth screen inside the theme every real screen has, which the kit's fields and buttons read. */
export function renderAuthScreen(screen: ReactElement, scheme: ThemeScheme = "dark") {
  return render(<ThemeProvider fixedPreference={scheme}>{screen}</ThemeProvider>);
}
