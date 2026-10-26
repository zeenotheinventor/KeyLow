import { render } from "@testing-library/react-native";

import FoodSearchRoute from "../../../app/foods/index";
import { PlateProvider } from "../../../lib/plate";
import { ThemeProvider } from "../../../lib/theme";

import type { ThemeScheme } from "@keylow/tokens";

/** The search sheet as the app shows it, on the theme the kit needs. */
export function sheet(scheme: ThemeScheme = "dark") {
  return (
    <ThemeProvider fixedPreference={scheme}>
      <PlateProvider>
        <FoodSearchRoute />
      </PlateProvider>
    </ThemeProvider>
  );
}

export function renderSheet(scheme: ThemeScheme = "dark") {
  return render(sheet(scheme));
}
