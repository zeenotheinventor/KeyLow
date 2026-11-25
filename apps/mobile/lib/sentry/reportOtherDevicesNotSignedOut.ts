import { captureMessage } from "@sentry/react-native";

import { OTHER_DEVICES_NOT_SIGNED_OUT_MESSAGE } from "./otherDevicesNotSignedOutMessage";

/**
 * Reports that a new password was saved but the account's other sessions could not be signed out, so it is
 * known if it happens. The screen still shows the saved state, as the boards draw it. The report carries
 * no data at all, so there is no account, address or password in it.
 */
export function reportOtherDevicesNotSignedOut(): void {
  captureMessage(OTHER_DEVICES_NOT_SIGNED_OUT_MESSAGE, {
    level: "warning",
    fingerprint: [OTHER_DEVICES_NOT_SIGNED_OUT_MESSAGE],
  });
}
