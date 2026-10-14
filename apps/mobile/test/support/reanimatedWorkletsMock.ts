// Reanimated reaches for the native worklets module as soon as it loads, and Jest has none. Worklets
// ships a mock for this, so a test can render an animated component and step its animation with
// fake timers. A test that asserts on an animated style calls setUpTests() from
// react-native-reanimated, which adds the toHaveAnimatedStyle matcher.
jest.mock("react-native-worklets", () =>
  jest.requireActual<object>("react-native-worklets/lib/module/mock"),
);
