// react-native-nitro-modules looks up its native module as soon as it loads, and Jest has none, so
// importing a Nitro library (the Apple Health one) throws. Every hybrid object this stand-in hands
// out answers any method with a jest.fn, which makes the import safe. A test that needs a method to
// return something sets it on the object with jest.mocked.
jest.mock("react-native-nitro-modules", () => {
  const createHybridObject = () =>
    new Proxy<Record<string, jest.Mock>>(
      {},
      {
        get: (methods, name: string) => {
          methods[name] ??= jest.fn();
          return methods[name];
        },
      },
    );

  return {
    NitroModules: { createHybridObject, hasHybridObject: jest.fn(() => false) },
    getHostComponent: jest.fn(() => () => null),
  };
});
