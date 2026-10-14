// Skia installs its JSI bindings as soon as it loads, and Jest has no native Skia, so importing it
// (or the Victory charts built on it) throws. This keeps the import safe for a component test and
// renders every Skia component as nothing. Skia's own Jest environment needs a WebAssembly
// CanvasKit for the whole run, so a test that must draw takes that environment itself, with a
// `@jest-environment @shopify/react-native-skia/jestEnv.js` docblock.
jest.mock("@shopify/react-native-skia", () => {
  const renderNothing = () => null;
  return new Proxy<Record<string, unknown>>(
    { __esModule: true },
    { get: (target, name: string) => (name in target ? target[name] : renderNothing) },
  );
});
