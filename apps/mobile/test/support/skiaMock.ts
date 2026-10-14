// Skia installs its JSI bindings as soon as it loads, and Jest has no native Skia, so importing it
// (or the Victory charts built on it) throws. This keeps the import safe for a component test and
// renders every Skia component as nothing. A test that must draw needs the real Skia, which takes
// all three of these together: the `@jest-environment @shopify/react-native-skia/jestEnv.js`
// docblock (a WebAssembly CanvasKit for the whole test file), `jest.unmock("@shopify/react-native-skia")`
// to undo this mock, and `require("@shopify/react-native-skia/jestSetup.js")` to install Skia's own.
jest.mock("@shopify/react-native-skia", () => {
  const renderNothing = () => null;
  return new Proxy<Record<string, unknown>>(
    { __esModule: true },
    { get: (target, name: string) => (name in target ? target[name] : renderNothing) },
  );
});
