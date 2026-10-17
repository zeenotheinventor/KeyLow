import { breadcrumbsIntegration, init } from "@sentry/react-native";
import Constants from "expo-constants";
import * as Updates from "expo-updates";

import { scrubBreadcrumb, scrubEvent } from "./scrub";

// The environment and the Expo config are typed loosely, so this narrows a read to text that says something.
const nonEmptyText = (value: unknown) =>
  typeof value === "string" && value !== "" ? value : undefined;

/**
 * Starts Sentry in a release build that has a DSN, and does nothing otherwise, so no event can leave from
 * Metro, a development client, Jest or a build made without the DSN. The release is the commit the update
 * was built from (set by the OTA workflow only, so the build's own bundle has none and takes the runtime
 * version), and the dist is the running update, so events group per update.
 */
export function initSentry() {
  const dsn = nonEmptyText(process.env.EXPO_PUBLIC_SENTRY_DSN);
  if (__DEV__ || dsn === undefined) {
    return;
  }

  const runtimeVersion = Updates.runtimeVersion ?? undefined;

  init({
    dsn,
    environment: nonEmptyText(Constants.expoConfig?.extra?.appVariant) ?? "production",
    release: nonEmptyText(process.env.EXPO_PUBLIC_COMMIT_SHA) ?? runtimeVersion,
    dist: Updates.updateId ?? undefined,
    initialScope: { tags: { runtimeVersion } },
    sendDefaultPii: false,
    tracesSampleRate: 0,
    // A session and a client report are sent by the SDK itself and never reach `beforeSend`. A session
    // carries the account id with the release and environment, so neither is sent.
    enableAutoSessionTracking: false,
    sendClientReports: false,
    beforeSend: scrubEvent,
    beforeBreadcrumb: scrubBreadcrumb,
    integrations: (defaultIntegrations) => [
      ...defaultIntegrations.filter(({ name }) => name !== "Breadcrumbs"),
      breadcrumbsIntegration({ console: false }),
    ],
  });
}
