import { themes, themeVariables } from "@keylow/tokens";

import { compileAppStyles } from "./support/nativeWindStyles";

// The ThemeProvider sets the variables for the scheme in use. Like every other `--kl-*` variable they
// also have a dark fallback on `:root`, so the classes that read them resolve outside a provider.
describe("the token variables outside a provider", () => {
  it("should fall back to the dark warning ink, which is the warning colour in dark", async () => {
    const css = await compileAppStyles("");

    expect(css).toContain(`--kl-warning-ink: ${themeVariables("dark")["--kl-warning-ink"]}`);
    expect(themeVariables("dark")["--kl-warning-ink"]).toBe("255 159 67");
  });

  it("should fall back to the dark skeleton shine gradient, in the design's 100 degrees", async () => {
    const css = await compileAppStyles("");

    expect(css).toContain(
      `--kl-skeleton-shine-gradient: linear-gradient(100deg, transparent, ${themes.dark["skeleton-shine"]}, transparent)`,
    );
  });
});
