import type { InputProps } from "../../components/ui";

// The preset replaces TextInput with a mock that reads `editable` as given, which hides how the real
// one decides it: `readOnly` wins whenever it is set at all, so `readOnly={false}` makes a field that
// asked for `editable={false}` editable. This file renders the real one. The setup file has already
// loaded React Native with the mock, so the modules are loaded again after the registry is reset.
jest.mock("react-native/Libraries/Components/TextInput/TextInput", () =>
  jest.requireActual<object>("react-native/Libraries/Components/TextInput/TextInput"),
);
jest.mock("@react-native-async-storage/async-storage", () => ({
  __esModule: true,
  default: { getItem: () => Promise.resolve(null), setItem: () => Promise.resolve() },
}));

type Rendering = typeof import("@testing-library/react-native/pure");
type Kit = typeof import("../../components/ui");
type Theme = typeof import("../../lib/theme");

describe("Input on the real TextInput", () => {
  let rendering: Rendering;
  let kit: Kit;
  let theme: Theme;

  // Jest has no dynamic import here, so the modules are required, each typed by the module itself.
  /* eslint-disable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */
  beforeAll(() => {
    jest.resetModules();
    // The pure build adds no cleanup hook, which cannot be added once the tests are running.
    rendering = require("@testing-library/react-native/pure");
    kit = require("../../components/ui");
    theme = require("../../lib/theme");
  });
  /* eslint-enable @typescript-eslint/no-require-imports, @typescript-eslint/no-unsafe-assignment */

  afterEach(async () => {
    await rendering.cleanup();
  });

  async function renderInput(props: Partial<InputProps> = {}) {
    await rendering.render(
      <theme.ThemeProvider fixedPreference="dark">
        <kit.Input label="Name" value="Oat milk" onChangeText={() => undefined} {...props} />
      </theme.ThemeProvider>,
    );
  }

  // The host text input is what the platform sees, so that is where `editable` is read.
  function hostProps() {
    return rendering.screen.getByLabelText("Name");
  }

  it("should be the real TextInput, not the preset's mock", async () => {
    await renderInput();

    expect(hostProps().type).not.toBe("TextInput");
  });

  it("should take typing by default", async () => {
    await renderInput();

    expect(hostProps().props.editable).toBe(true);
  });

  it("should not take typing when it is disabled", async () => {
    await renderInput({ disabled: true });

    expect(hostProps().props.editable).toBe(false);
  });

  it("should not take typing when it is locked", async () => {
    await renderInput({ locked: true });

    expect(hostProps().props.editable).toBe(false);
  });
});
