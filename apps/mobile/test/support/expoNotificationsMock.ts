// A small in-memory stand-in for expo-notifications, so a test sees what was scheduled and can play a
// tap on a notification. A setup file for every test is test configuration and belongs to the Housekeeping
// session, so a test that needs this mocks the module itself:
//
//   jest.mock("expo-notifications", () =>
//     jest.requireActual<typeof import("./support/expoNotificationsMock")>("./support/expoNotificationsMock")
//       .mockExpoNotifications);
type PermissionStatusValue = "granted" | "denied" | "undetermined";

type ScheduledRequest = {
  identifier: string;
  content: { title?: string; body?: string; data?: Record<string, unknown> };
  trigger: { type: string; date: Date | number; channelId?: string };
};

type TapEvent = {
  notification: { request: { identifier: string; content: ScheduledRequest["content"] } };
};

type TapListener = (event: TapEvent) => void;

type NotificationsState = {
  permission: PermissionStatusValue;
  // What the system answers when the person is asked.
  answerToRequest: PermissionStatusValue;
  scheduled: Map<string, ScheduledRequest>;
  listeners: Set<TapListener>;
  lastResponse: TapEvent | null;
};

export const notificationsState: NotificationsState = {
  permission: "undetermined",
  answerToRequest: "granted",
  scheduled: new Map(),
  listeners: new Set(),
  lastResponse: null,
};

function permissionResult(status: PermissionStatusValue) {
  return { status, granted: status === "granted", canAskAgain: status === "undetermined" };
}

export const mockExpoNotifications = {
  PermissionStatus: { GRANTED: "granted", DENIED: "denied", UNDETERMINED: "undetermined" },
  AndroidImportance: { DEFAULT: 3 },
  SchedulableTriggerInputTypes: { DATE: "date" },
  getPermissionsAsync: jest.fn(() =>
    Promise.resolve(permissionResult(notificationsState.permission)),
  ),
  requestPermissionsAsync: jest.fn(() => {
    if (notificationsState.permission === "undetermined") {
      notificationsState.permission = notificationsState.answerToRequest;
    }
    return Promise.resolve(permissionResult(notificationsState.permission));
  }),
  setNotificationChannelAsync: jest.fn(() => Promise.resolve(null)),
  setNotificationHandler: jest.fn(),
  scheduleNotificationAsync: jest.fn((request: ScheduledRequest) => {
    notificationsState.scheduled.set(request.identifier, request);
    return Promise.resolve(request.identifier);
  }),
  getAllScheduledNotificationsAsync: jest.fn(() =>
    Promise.resolve([...notificationsState.scheduled.values()]),
  ),
  cancelScheduledNotificationAsync: jest.fn((identifier: string) => {
    notificationsState.scheduled.delete(identifier);
    return Promise.resolve();
  }),
  addNotificationResponseReceivedListener: jest.fn((listener: TapListener) => {
    notificationsState.listeners.add(listener);
    return {
      remove: () => {
        notificationsState.listeners.delete(listener);
      },
    };
  }),
  getLastNotificationResponse: jest.fn(() => notificationsState.lastResponse),
  clearLastNotificationResponse: jest.fn(() => {
    notificationsState.lastResponse = null;
  }),
};

/** Plays a person tapping a notification while the app is running. */
export function tapNotification(identifier: string, data: Record<string, unknown>): void {
  const event = { notification: { request: { identifier, content: { data } } } };
  for (const listener of notificationsState.listeners) {
    listener(event);
  }
}

/** Leaves a tap behind, as the system does when a tap opens a closed app. */
export function leaveTapFromColdStart(identifier: string, data: Record<string, unknown>): void {
  notificationsState.lastResponse = {
    notification: { request: { identifier, content: { data } } },
  };
}

export function resetNotificationsMock(): void {
  notificationsState.permission = "undetermined";
  notificationsState.answerToRequest = "granted";
  notificationsState.scheduled.clear();
  notificationsState.listeners.clear();
  notificationsState.lastResponse = null;
  Object.values(mockExpoNotifications).forEach((entry) => {
    if (jest.isMockFunction(entry)) {
      entry.mockClear();
    }
  });
}
