// The real Sentry SDK starts a timer as it loads, which would keep every test file that loads the root layout
// from exiting cleanly, and it would report to the network if it were started. Nothing starts it in a test, so
// this stands in for the calls the app makes, and a test reads what was called. The test of the real SDK
// takes it with `jest.requireActual`.
jest.mock("@sentry/react-native", () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  wrap: <Component>(component: Component) => component,
  breadcrumbsIntegration: jest.fn(),
}));
