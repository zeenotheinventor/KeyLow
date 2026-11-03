# 0007: Phone widgets: library, the snapshot contract, one-tap actions and privacy

## Status

Accepted when the pull request that carries it merges. Written on 2026-11-03 under KEY-802, part of KEY-799 (the phone widgets brief). It adds no table or column, so ADR 0003 needs no amendment.

## Context

Zee asked for widgets on the phone itself, outside the app: the dashboard cards (Today, This week, Body map) and quick logging. Zee approved the concept boards on 2026-11-03 ("I love all these"). They are on the canvas "Ki-Lo home screen widgets" and will be exported to `docs/design/widgets/` under KEY-800.

Ki-Lo ships on Android only. `apps/mobile/app.config.ts` and `docs/runbooks/local-dev.md` both say there are no iOS builds yet. Concept C (lock screen widgets, a Live Activity and the Dynamic Island) exists only on iOS. Zee ruled: "Do A and B. Keep C in house keeping, mark it as a medium". So this brief builds concepts A and B on Android, and concept C plus every iOS widget moved to KEY-809.

A widget is drawn by the phone's launcher, not by the app. It cannot run the app's React tree, so the data it shows has to be handed to it, and each tap either opens the app or runs a small handler. Those mechanics, and the privacy rules around them, are decisions every widget ticket would otherwise re-derive.

Sources, in authority order: Zee's rulings recorded on KEY-799 (2026-11-03), the approved boards, `AGENTS.md`, ADR 0003 (data model), ADR 0004 (error monitoring and scrubbing), ADR 0005 (training), the widget plan, and the library documentation each section cites. Where a lower source disagrees with a higher one, the higher one is followed.

Out of scope here: every iOS widget, the lock screen, Live Activities, the Dynamic Island, an Android ongoing notification for a running session, background refresh while the app has not run, and widget configuration screens.

## Decision

### The library: `react-native-android-widget`

Android widgets are built with `react-native-android-widget` and its Expo config plugin.

- It works on Expo SDK 57 today. `expo-widgets` on SDK 57 lists `platforms: ['ios']`, and its Android support (SDK 58) has no per-button deep link and no JS on a tap.
- Layouts are written in TypeScript and rendered from the app's JS, so they share core, copy and tokens with the app.
- A tap either opens a `keylow://` URI or runs a named click action in the app's `widgetTaskHandler`, which is how a one-tap log can write without opening the app.
- Its `SvgWidget` takes an SVG string, so the calorie ring and the body figure are drawn as SVG built in core.
- Native Kotlin (Glance) was rejected: nothing would be shared with the app, and every change would need a native build and review in a second language.

Adding the library, its plugin and the entry file that registers the task handler moves the Expo fingerprint. That pull request says it needs a new `production-apk` build, not an over-the-air update.

### The source guard exception

The library styles its primitives only with `style` objects. Zee approved, on 2026-11-03, one path-scoped exception: `style` objects are allowed in `apps/mobile/widgets/android/**` and nowhere else.

- Raw hex stays banned there. Every colour, size and radius comes from `@keylow/tokens` (`colors`, `lightColors`, `bodyMapPalette`), through one small helper that maps the view model's colour roles to token values.
- The exception is a path scope in the inline `style` rule of the guard (`packages/config/test/source-guard/`), not an allowlist entry. The allowlist matches exact file paths with a count of findings and fails on an unused entry, so it cannot cover a folder whose files change. KEY-805 changes the rule so it skips `apps/mobile/widgets/android/`, with tests that a `style` object passes there and fails everywhere else, and that raw hex still fails there. The rule's comment names this ADR.
- KEY-805 also updates the "Rules the gate enforces" line of `AGENTS.md` to name this second exception, in the same pull request as the guard change.
- Code that is not a widget layout does not live in that folder. A reviewer who finds logic there sends it to core or `apps/mobile/lib/widgets/`.

### The snapshot contract, in core

`packages/core/src/widgets/` holds the contract that both sides read.

- `WidgetSnapshot` is a versioned zod schema of plain data: today's totals and targets, the week summary, the body map scale and the inputs the heat model reads for its window (the logged sets inside it, minimised to the fields `muscleState` needs, so the timeline calls the same pure function rather than decaying stored heat values), this week's volume values, the planned day, the running session's id and next set (exercise, set position, prefilled load and reps), the recent foods with the id and amount of the entry each one would repeat, the last weigh-in, the units, and the time it was built. It holds no token, session, user id or email. KEY-803 picks the smallest shape that meets this.
- `widgetViewModel(snapshot, kind, now)` returns, for one widget kind and state, every string already formatted from `packages/core/src/copy/widgets.ts` and colour roles rather than colours. Everything with a branch lives here, as `AGENTS.md` requires.
- `widgetTimeline(snapshot, now)` returns what to show at the next local midnight (a new day with that weekday's target) and as the heat decays, using the heat model's pure functions with `now` as an argument (ADR 0005).
- The body figure SVG is built from `BODY_ARTWORK` with a palette passed in, so the widget draws the same artwork as the app.
- A snapshot whose version the widget does not know is shown as "Open Ki-Lo to load today" (board D, no data yet), never parsed loosely.

### When the app writes the snapshot

A `WidgetSync` component in `apps/mobile/lib/widgets/`, mounted under the signed-in layout, builds the snapshot with core from the same hooks the dashboard reads, so the widget and the dashboard agree and share the cache.

- It writes when that data changes (debounced), when the app goes to the background, and after every one-tap action.
- It stores the snapshot under one AsyncStorage key and asks the widgets to update.
- The provider's periodic update runs the task handler, which redraws from the stored snapshot and the timeline. A change made on the web reaches the widget only after the phone app or the task handler next runs. That limit is accepted.
- Sign-out (`lib/signOut.ts`, `lib/endSession.ts`) deletes the snapshot and the pending-undo record and redraws every widget in the signed-out state, so nothing from the last account stays on the home screen.

### One-tap actions: Log again and Log set

Both run in `widgetTaskHandler`, in the app's JS, with the app's Supabase client and stored session. KEY-805 proves first that the handler runs with the stored session while the app is closed. If it cannot, the action falls back to opening the app with a nonce-checked link (below), and this ADR is amended.

- Log again re-reads the entry by id, builds a new entry with `buildLogEntry` in core at write time (so the nutrient snapshot is computed in core and editing a food never changes it), uses the last amount and now as the time, and calls `logFood`.
- Log set re-reads the open session and checks that the snapshot's session id, exercise and set position still match before it calls `addSet` with the prefilled set. If they do not match it logs nothing and shows "Your session moved on".
- Online only. There is no offline queue for any write today, so offline the widget logs nothing and shows "Couldn't log that. Nothing was saved."
- An in-flight key per action stops a double tap from logging twice.
- After a write the handler stores a pending-undo record (the action, the id of the row it wrote, and when) under its own AsyncStorage key, beside the snapshot, so it survives the handler being restarted. The widget shows "Logged" with Undo while that record exists. Undo is itself a handler write under the same rules (online only, in-flight key, stored session): it removes exactly that row (the repository's soft delete, `softDeleteLogEntry`, for food, and `removeSet` for a set) and clears the record. The record expires 10 minutes after the time it stores, which ends the Undo window: the widget stops showing Undo at the first redraw after that, and the snapshot write that follows the tap keeps the record. An Undo whose record is gone, or whose row is already gone, does nothing.

### One Training widget

Start training and Log a set are one widget kind, Training, that switches by state: Log a set while a session is running, Start training when a day is planned, and the rest day state otherwise. A launcher cannot add or remove a widget on its own, so two separate widgets would leave one of them empty most of the time.

### Deep links and the nonce rule

Every other tap opens the app through `keylow://` to an existing route: the Diary for today, `/week`, `/body-map`, `/dashboard`, `/foods`, `/foods/scan`, `/foods/quick-add`, `/more/weight/entry`, `/more/recipes` and `/session`. KEY-804 adds `/session?start=planned` and `/session?start=empty`, which open the running session instead if there is one.

A link never writes on its own. Any link that would cause a write carries a nonce that the app checks against the snapshot it last wrote, and an unknown or used nonce does nothing. That stops another app or a web page from logging food through a `keylow://` link.

### Privacy

- The snapshot and the pending-undo record stay on the phone. They are never sent anywhere, and both are deleted at sign-out.
- Nothing from the snapshot, a view model or an action's inputs reaches logs, error messages, Sentry events, breadcrumbs or analytics. An action's error carries the action and a code, as every repository error does (ADR 0004).
- Home screen widgets show the person's own numbers without unlocking, because the person chose to add them. There is no lock screen widget in this brief.

## Consequences

- KEY-803 builds the core contract, KEY-804 the mobile sync, actions and routes, KEY-805 the library and the concept A widgets, and KEY-806 the concept B widgets. Each names its frame in `docs/design/widgets/`.
- The edge states (signed out, no data yet, offline, no target, rest day, no recent foods, Logged with Undo, couldn't log, session moved on) come from board D once Zee approves it (KEY-801).
- Two pull requests move the fingerprint (the library in KEY-805, and KEY-806 if its provider list changes native config). Each needs a new `production-apk` build before the widgets reach Zee's phone.
- iOS reuses the core contract unchanged. KEY-809 decides its library (`expo-widgets`) and its write path, because an `expo-widgets` button cannot reach the backend.
