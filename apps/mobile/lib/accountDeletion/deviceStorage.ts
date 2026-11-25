import AsyncStorage from "@react-native-async-storage/async-storage";

import { forgetNotifiedBadges } from "../achievements/notifiedBadges";
import { bodyFigureStorageKey } from "../bodyFigure/bodyFigureStorage";
import { bodyMapHintStorageKey } from "../bodyMapHint/bodyMapHintStore";
import { bodyMapRendererStorageKey } from "../bodyMapRenderer/bodyMapRendererStorage";
import { bodyMapViewStorageKey } from "../bodyMapView/bodyMapViewStore";
import { checkinSeenStorageKey } from "../checkinSeen/checkinSeenStore";
import { dashboardBodyChartStorageKey } from "../dashboardBodyChart/dashboardBodyChartStorage";
import { formMediaPreferenceStorageKey } from "../formMediaPreference/formMediaPreferenceStorage";
import { clearHealthImportState } from "../health/healthAnchorStore";
import { clearRecoveryRequest } from "../recoveryRequest/recoveryRequestStorage";
import { reminderSettingsStorageKey } from "../reminderSettings/reminderSettings";
import { suggestionDismissedStorageKey } from "../suggestionDismissed/suggestionDismissedStore";
import { suggestionsPreferenceStorageKey } from "../suggestionsPreference/suggestionsPreferenceStore";
import { themeStorageKey } from "../theme/themePreference";
import {
  compositionUnitStorageKey,
  weightChartViewStorageKey,
} from "../weightChartView/weightChartViewStore";

type Remove = (accountId: string) => Promise<void>;

/**
 * What a storage key becomes when the account is deleted.
 * - `removedOnDeletion`: goes with the account (`remove` does it), or is removed by another entry's `remove`
 *   (`coveredBy` names it). It is everything the person chose or did on this phone, device settings included,
 *   so after a deletion the phone is as on a fresh install. `isKeyedByAccount` marks what is stored under the
 *   account's id, which is all that goes when a marker names an account other than the one signed in now.
 * - `removedOnSignOut`: the sign out that ends a deletion already removes it, so the deletion adds nothing.
 * - `appPlumbing`: stays. It is how the app runs, says nothing about the person, and is not an account's.
 */
type DeviceStorageEntry =
  | { class: "removedOnDeletion"; remove: Remove; isKeyedByAccount?: true }
  | { class: "removedOnDeletion"; coveredBy: string }
  | { class: "removedOnSignOut" }
  | { class: "appPlumbing" };

const removeKey =
  (key: string): Remove =>
  () =>
    AsyncStorage.removeItem(key);

/**
 * Every storage key the app declares, classified by the name of the constant or key builder that holds it.
 * `test/accountDeletion/deviceStorageCoverage.test.ts` scans `lib` and fails for a key that is not here, so
 * whoever adds a key has to decide what a deletion does with it.
 */
export const deviceStorage: Record<string, DeviceStorageEntry> = {
  // Removed on deletion: what the person did or chose on this phone.
  notifiedBadgesStorageKey: {
    class: "removedOnDeletion",
    remove: forgetNotifiedBadges,
    isKeyedByAccount: true,
  },
  anchorKey: {
    class: "removedOnDeletion",
    remove: clearHealthImportState,
    isKeyedByAccount: true,
  },
  bodyAnchorKey: { class: "removedOnDeletion", coveredBy: "anchorKey" },
  lastImportKey: { class: "removedOnDeletion", coveredBy: "anchorKey" },
  checkinSeenStorageKey: { class: "removedOnDeletion", remove: removeKey(checkinSeenStorageKey) },
  suggestionDismissedStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(suggestionDismissedStorageKey),
  },
  bodyFigureStorageKey: { class: "removedOnDeletion", remove: removeKey(bodyFigureStorageKey) },
  reminderSettingsStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(reminderSettingsStorageKey),
  },
  recoveryRequestStorageKey: { class: "removedOnDeletion", remove: clearRecoveryRequest },
  themeStorageKey: { class: "removedOnDeletion", remove: removeKey(themeStorageKey) },
  weightChartViewStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(weightChartViewStorageKey),
  },
  compositionUnitStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(compositionUnitStorageKey),
  },
  dashboardBodyChartStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(dashboardBodyChartStorageKey),
  },
  bodyMapRendererStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(bodyMapRendererStorageKey),
  },
  bodyMapViewStorageKey: { class: "removedOnDeletion", remove: removeKey(bodyMapViewStorageKey) },
  bodyMapHintStorageKey: { class: "removedOnDeletion", remove: removeKey(bodyMapHintStorageKey) },
  formMediaPreferenceStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(formMediaPreferenceStorageKey),
  },
  suggestionsPreferenceStorageKey: {
    class: "removedOnDeletion",
    remove: removeKey(suggestionsPreferenceStorageKey),
  },

  // Removed on sign out: the deletion ends with one, so these are gone by the time it finishes.
  authStorageKey: { class: "removedOnSignOut" },
  DIARY_CACHE_STORAGE_KEY: { class: "removedOnSignOut" },
  SNAPSHOT_STORAGE_KEY: { class: "removedOnSignOut" },
  PENDING_UNDO_STORAGE_KEY: { class: "removedOnSignOut" },
  scheduledRemindersStorageKey: { class: "removedOnSignOut" },

  // App plumbing: stays.
  // The times of recent fatal restarts, kept to stop a crash loop. It holds no account's data.
  fatalRestartStorageKey: { class: "appPlumbing" },
  // The id of the last over-the-air update the person was shown the notes of. It says nothing about them.
  lastSeenUpdateIdStorageKey: { class: "appPlumbing" },
  // Tells the widgets "signed out" from "never ran". It holds no data and the sign out sets it.
  SIGNED_OUT_STORAGE_KEY: { class: "appPlumbing" },
  // The marker of a deletion in progress (an account id). `finishAccountDeletion` removes it as its last
  // step, so it must outlive the removals above: a kill in between leaves it for the next start to finish.
  pendingAccountDeletionStorageKey: { class: "appPlumbing" },
};
