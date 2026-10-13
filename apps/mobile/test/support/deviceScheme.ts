/**
 * The scheme the device reports in a test. React Native's `useColorScheme` reads it, so a test
 * sets it before rendering to act as a light or a dark device.
 */
export const deviceScheme: { current: "dark" | "light" } = { current: "light" };

export const mockDeviceSchemeHook = {
  __esModule: true,
  default: () => deviceScheme.current,
};
