import { render, screen } from "@testing-library/react-native";

import { Body3D } from "../../components/ui";
import { ThemeProvider } from "../../lib/theme";
import { compileKitStyles } from "../support/kitStyles";
import { registerAppStyles } from "../support/nativeWindStyles";

jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

// A build made before expo-gl was added cannot read the canvas module, because its native module is missing.
jest.mock("../../components/ui/Body3D/Body3DCanvas", () => {
  throw new Error("Cannot find native module 'ExpoGL'");
});

describe("Body3D without the GL module", () => {
  beforeAll(async () => {
    registerAppStyles(await compileKitStyles());
  });

  it("should keep the figure's place and call onError once", async () => {
    const onError = jest.fn();

    await render(
      <ThemeProvider fixedPreference="dark">
        <Body3D label="Body, 3D" onError={onError} w={120} />
      </ThemeProvider>,
    );

    expect(screen.getByRole("img", { name: "Body, 3D" })).toBeOnTheScreen();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
