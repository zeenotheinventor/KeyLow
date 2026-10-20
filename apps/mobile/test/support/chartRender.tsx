import { act, render } from "@testing-library/react-native";

import { ThemeProvider } from "../../lib/theme";

import type { ThemeScheme } from "@keylow/tokens";
import type { ReactElement } from "react";

/** Draws a chart in a scheme. A test that draws Victory's chart imports `./gestureHandler` before anything else, for the chart's root view. */
export async function renderChart(chart: ReactElement, scheme: ThemeScheme = "dark") {
  await render(<ThemeProvider fixedPreference={scheme}>{chart}</ThemeProvider>);
  // Victory's setup finishes in an effect, which the worklets mock answers with a state update.
  await act(async () => {});
}
