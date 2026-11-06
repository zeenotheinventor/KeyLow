# Web Train additions: the boards

The design gate of [KEY-859](https://linear.app/sojisoft/issue/KEY-859) (the session bar), [KEY-865](https://linear.app/sojisoft/issue/KEY-865) (the exercise progress page), [KEY-873](https://linear.app/sojisoft/issue/KEY-873) (the Progress section on Routines) and half of [KEY-858](https://linear.app/sojisoft/issue/KEY-858) (the kit chart). Drawn for [KEY-841](https://linear.app/sojisoft/issue/KEY-841) on Zee's ruling of 2026-11-05. Zee reviews after the build.

Each board is a PNG at device pixel ratio 2 and a standalone HTML page. The frames run left to right: 1280 dark, 1280 light, 375 dark, 375 light. Frames are as tall as their content. The HTML opens from disk and links the tokens by relative path.

## Boards

Search the canvases by the heading.

| Heading                                | File                              | What it shows                                                                                                    |
| -------------------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `web-train · session-bar`              | `train-session-bar`               | The bar in the shell over the Dashboard, a routine day with a plan total: "Push", "30:00 · 8 of 16 sets"         |
| `web-train · session-bar-free`         | `train-session-bar-free`          | A free session: "Session", "30:00 · 8 sets", no total                                                            |
| `web-train · session-bar-offline`      | `train-session-bar-offline`       | The shell's offline state with the bar: launcher dimmed, the Dashboard's offline banner, the bar unchanged        |
| `web-train · progress`                 | `train-progress`                  | The page loaded on 3 months: Back, the name, Range, the chart, the weeks newest first with a skipped week        |
| `web-train · progress-week-selected`   | `train-progress-week-selected`    | A week selected: its point takes the marker, its row is raised. Not in the ticket's list, the phone has the state |
| `web-train · progress-one-week`        | `train-progress-one-week`         | One trained week on 4 weeks: a dot, "First week", the line asking for a second week                              |
| `web-train · progress-empty`           | `train-progress-empty`            | No set in the range: Range stays, the empty state stands in for the chart and the weeks                          |
| `web-train · progress-loading`         | `train-progress-loading`          | First load: Range stays, the plain title, skeletons in the place of the chart and the weeks                      |
| `web-train · progress-error`           | `train-progress-error`            | A failed read: Range stays, the error state with Try again                                                       |
| `web-train · progress-offline`         | `train-progress-offline`          | No connection, the rows already read this visit: the banner, the launcher dimmed, the chart and weeks as read    |
| `web-train · progress-offline-not-read`| `train-progress-offline-not-read` | No connection and nothing read: the plain title, the banner, "Your training did not load" with no button                   |
| `web-train · routines-progress`        | `train-routines-progress`         | Routines with the Progress section: a group per routine day, every state a row can read                          |
| `web-train · routines-progress-loading`| `train-routines-progress-loading` | The list loaded, the section loading                                                                             |
| `web-train · routines-progress-error`  | `train-routines-progress-error`   | The list loaded, the section failed, with Try again                                                              |
| `web-train · chart-states`             | `train-chart-states`              | The kit chart alone in each state [KEY-858](https://linear.app/sojisoft/issue/KEY-858) asks for, band included   |

## The chart, for KEY-858 and the Programme boards

One component, a line over weeks, with no Train words in it. The props stay those of the phone's `apps/mobile/components/ui/LineChart/types.ts`: `points` with `null` for a skipped week, `unit`, `label`, `summary`, `selectedWeek`, `onSelectWeek`, and the optional `band`, `legend` and `formatValue`. The geometry is `apps/mobile/lib/chart/linePlot.ts`, which KEY-858 moves to core. Every number on these boards came out of those functions.

The frame is the web's weight chart, `docs/design/web-weight/proposals/page-chart.html`:

| Part          | 1280 and 375                                                                                                                                                     |
| ------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frame         | A `figure` on the `surface` token, 1px `border`, `radius-large`, no shadow, 12 above. It takes its column's width and the drawing is measured from it             |
| Heading       | `label` in caption `text-secondary` beside `unit` in caption `text-muted`, 12 at the sides                                                                         |
| Plot height   | 220 at 1280, 160 at 375. Room inside the drawing: 12 left, 44 right, 8 above, 12 below, as the weight chart's `PLOT_INSET`                                        |
| Weeks across  | Each week is an equal column with its point in the middle, as the phone's domain of -0.5 to n - 0.5, so a column is also the week's press target                  |
| Value axis    | Three values on the right in the 40 column: highest, middle, lowest (`axisTicks`, `formatTick` or the caller's `formatValue`), 11/14 `text-muted`, tabular figures. With a `band` the axis widens to hold the band ends (`valueDomain`) |
| Grid          | 1px at the three values, stopping at the value column. `chart-grid` at the top two and `chart-axis` at the bottom                                                  |
| Line          | 2.5 `chart-trend`, round caps and joins, straight segments. A skipped week breaks it                                                                               |
| Points        | Radius 2.5 `chart-point`, on every reading, so a reading alone is still seen                                                                                       |
| Marker        | The selected week, or else the latest reading: radius 4 `chart-marker` with a 2 ring in `surface`                                                                  |
| Band          | `chart-band` behind the line and the points (`bandPath`). A week without one breaks it, and a week alone is a bar 12 wide                                           |
| Week labels   | 11/14 `text-muted`, centred under the point, 4 under the plot. `labelledIndexes(n, max)` counting back from the latest: max 7 at 1280, 4 at 375                     |
| Legend        | Only with a band: under the week labels, 8 above, caption `text-secondary`. Line swatch 14 by 2, band swatch 14 by 10 with a `chart-axis` border                   |
| Summary       | Under everything, caption `text-secondary`, 8 above and 12 below, also the accessible name of the image                                                             |

Week buttons exist only when `onSelectWeek` is given. Without it the chart is the image alone. With it, pressing a column selects its week, and each is a button with the week as its name, so it works from the keyboard with an inset `focus-ring`. A skipped week has no button. Width decides the plot height and the label count, nothing else, so the chart holds in a two column page, a card or a phone width.

The Sparkline stays the phone's `default` size: 64 by 20, inset 3, line 1.5, last dot radius 2, a reading alone radius 1.5. Tones: `chart-trend` with a `chart-marker` dot, `success-ink`, `danger`.

## Kit

- **Reuse:** `Button` (secondary, ghost), `Badge`, `Banner` (info and review), `Card`, `EmptyState`, `ErrorState`, `GroupedList`, `SearchLauncher` (its `disabled` as built), `SegmentedControl`, `Skeleton` (`rows`, and children with `SkeletonBone` for the chart's block), `BackToFoodsLink` with `tone="accent"`, `RoutineCard` and `RoutineActionRow` as built.
- **Extend:** nothing.
- **New in the kit:** `LineChart`, `Sparkline` ([KEY-858](https://linear.app/sojisoft/issue/KEY-858)).
- **New outside the kit:** `SessionBar` beside `DashboardNav` ([KEY-859](https://linear.app/sojisoft/issue/KEY-859)), `ExerciseWeekRow` in `components/train` ([KEY-865](https://linear.app/sojisoft/issue/KEY-865)), `RoutineProgressDay` and `RoutineProgressRow` in `components/train` ([KEY-873](https://linear.app/sojisoft/issue/KEY-873)). `ListRow` does not fit either row: its badge drops under the subtitle at a phone width and it has no selected look, and the routine row needs a sparkline.

## New strings

None. Every word on the boards is the output of `packages/core/src/copy/`: `describeSessionBar`, `OFFLINE_BANNER`, `EXERCISE_PROGRESS`, `ROUTINE_PROGRESS`, `ROUTINES_SCREEN`, `describeProgressRow`, `describeProgressWeek`, `describeProgressChartSummary`, `describeActiveRoutine`, `describeOtherRoutineMeta`, `describeArchivedRoutinesLink`, `TRAIN_OFFLINE_TITLE`, `describeOfflineBanner`, `TRAIN_OFFLINE_NOTHING_SAVED`, `GENERIC_ERROR`, `RETRY_LABEL`, `PROGRAM_CHART`, `describeExpenditureChartSummary`, `TRAIN_ERROR`. The "Board note" lines on `train-chart-states` name the state for the reader and are not product copy. Its two band charts take the means and spreads of the phone story's estimates and pass them through `expenditureBand`, which rounds the ends to 10, then `describeExpenditureChartSummary`: "likely 2,430 to 2,730", as [KEY-843](https://linear.app/sojisoft/issue/KEY-843)'s `program.md` says. The story itself hard-codes unrounded ends, so it is not the source of those numbers.

## Golden data

Push Pull Legs as `packages/core/test/fixtures/training/goldenWeek.json` holds it: Push, Pull, Legs and Push again, with the catalogue's exercise names, 63 sets a week. The bench row reads "62.5 kg for 6 reps" and "+2.5 kg", the real output of `describeProgressRow` for the [KEY-508](https://linear.app/sojisoft/issue/KEY-508) trend: 60 x 8, 60 x 10, 60 x 8, a skipped week, 62.5 x 6. The earlier bench weeks and the other exercises' weeks are made up for the boards, and each went through `exerciseWeeklyTrend`. The rows cover a rise, a fall, more and fewer reps, no change, a first week, a gap this week, never trained, reps only and a reading alone. The two Push days hold the same exercises, so `routineTrendsByDay` gives the same rows twice, as the phone shows them. The Dashboard under the bar is `shell-dashboard-volume`, whose Today and This week cards are placeholders for what is built. Its training card said "Today: Legs", which would not agree with a Push bar. Monday is Push in the golden week and Push is 16 sets, so these three boards say "Today: Push" and the rest of the card stands.

## Decisions

- **Recommended (Zee away), reversible:** the bar sits directly under the top bar on every signed-in page but the session page, full width, staying in view as the page scrolls. The web's top bar is not sticky, so the bar goes between `DashboardNav` and `main` with `sticky top-0`: the top bar scrolls away and the bar holds the top of the window. I kept this place: at the bottom it would cover the last rows of a page, and the web has no tab bar to sit on.
- **Recommended (Zee away), reversible:** the bar's z-index is `z-[5]`: below the menu panel's `z-10` and above page content. `DashboardNav`'s header is `relative` with no z-index, so it is not a stacking context, and the panel's `z-10` competes with the bar directly in the root context. At 10 or above the bar would paint over the open menu, because it comes later in the page. Popovers at `z-20`, `Dialog` at `z-40` and `Toast` at `z-50` all stay above it.
- **Recommended (Zee away), reversible:** `RecipeEditorLayout`'s `lg:sticky lg:top-6` needs a top offset while the bar shows, or the 52 tall bar covers the top 28 pixels of that column. The bar's owner sets a `--session-bar-offset` custom property of `control-height-lg` on the layout while the bar renders, and the column reads `lg:top-[calc(theme(spacing.6)+var(--session-bar-offset,0px))]`. It is the only sticky-to-top element in the web app today. Its `max-lg:sticky max-lg:bottom-0` sibling is not affected.
- **Recommended (Zee away), reversible:** the phone's chevron up becomes a chevron right, because nothing rises from below on the web. It opens the session page.
- **Recommended (Zee away), reversible:** at 1280 the clock and the sets sit straight after the name, with the chevron alone at the far end, because at the phone's layout the name and its numbers would be over 1000 pixels apart. At 375 the bar is the phone's: the name fills, the numbers sit at the end. The bar lines up with the top bar's sides, 32 and 16.
- **Recommended (Zee away), reversible:** the bar's height and type stay the phone's: `control-height-lg`, body strong, caption, `surface-sheet`, an accent dot. The border moves from the top edge to the bottom, because it now hangs under the top bar. Hover and press use the overlay tokens, and focus is an inset ring.
- **Recommended (Zee away), reversible:** the page shows the chart and the weeks as two columns at 1280 and stacks them at 375. The columns are the weight page's: the rest of 1180, and 400 for the list, split at `lg` as `WeightScreen` does. Range sits over the chart, not over the list.
- **Recommended (Zee away), reversible:** the progress page lives at `/train/progress/[exerciseId]`, the phone's route, with Train current in the top bar. The id goes in the path, never a name. It uses the `diary` page frame, as Routines does.
- **Recommended (Zee away), reversible:** the chart takes the web weight chart's frame and its values on the right, and the phone's three values, line and points. The phone has the values on the left. The web's look wins by the sources' order, and it means two kinds of web chart read alike.
- **Recommended (Zee away), reversible:** empty and error span the page under Range, as the weight page's error does, because there is nothing to put in a second column.
- **Recommended (Zee away), reversible:** the empty state has the `ChartLine` icon. The web's `EmptyState` requires an icon, and the phone's card has none.
- **Recommended (Zee away), reversible:** loading has a chart block and six list rows at 1280, three at 375, against the phone's three rows, so the two columns do not jump when the read lands.
- **Recommended (Zee away), reversible:** on Routines at 1280 the Progress section is a second column beside the list, 360 wide with a gap of 20, the list keeping its built 800. Those are `TrainScreen`'s numbers for its own second column (`xl:w-[360px]`, `xl:gap-5`), and they add up to the page's 1180. Under the list it would start well below the fold, and Zee's reason for the section is to see at a glance whether each exercise is going up. Below `xl`, and at 375, it follows the list as on the phone. It shows for the active routine only, as the phone's does.
- **Recommended (Zee away), reversible:** New routine moves to the 1180 edge at `xl`, so the built `xl:max-w-[800px]` comes off the Routines title row. With a second column on the page the title row belongs to the page, as `TrainScreen`'s does, and left at 800 it would stop short of the Progress column and leave that end of the row empty. Below `xl` nothing changes.
- **Recommended (Zee away), reversible:** "Progress" is a `text-h2` heading on the web. The phone has it as a muted caption, but on the web the day groups are `GroupedList` titles in body strong, and the section needs to sit above them.
- **Recommended (Zee away), reversible:** week rows and progress rows take `text-secondary` for the value line as the merged phone rows do, where `ListRow` uses `text-muted`. A progress row drops its sparkline with no reading, as the phone does.
- **Recommended (Zee away), reversible:** the offline page has two boards, because the web keeps its reads in memory for the visit where the phone saves them to disk. With rows already read: the name, the chart and the weeks as read, and the Train home's review banner with `describeOfflineBanner`, the time being when the rows were read. With nothing read: the phone's plain title "Exercise progress", the banner with `TRAIN_OFFLINE_NOTHING_SAVED`, and the error state with `TRAIN_ERROR`'s title and body and no button, so nobody is given a bare "Try again." with nothing to press. `HistoryScreen` and `SessionDetailScreen` do the same with `HISTORY_ERROR` when offline. The phone has no banner here. The web's Train home does, and the page has to say why a value might be old.
- **Recommended (Zee away), reversible:** `train-session-bar-offline` reads "the shell's offline state" as what is built: the launcher at half opacity from `DashboardNav` and `DashboardBanners`' info banner. No board drew it before. The bar does not change: its clock counts from the session's start with no connection. A day's plan not yet read shows the sets alone, as `train-session-bar-free` draws.
- **Recommended (Zee away), reversible:** the loading board's title is "Exercise progress", as the merged hook gives it while the exercise is not read. It is the phone's rule, and it may flash for a moment on the web.

## Where the sources disagreed

- The ticket's bar on "every signed-in page" against the phone's bar above the tab bar: the ticket, with its chevron.
- `docs/design/web/shell-dashboard` is older than the app (Coming soon, Recipes in the top bar). The newer `proposals/shell-dashboard-volume` has the four sections as built, so the bar boards use it.
- [KEY-508](https://linear.app/sojisoft/issue/KEY-508) says "62.5 kg". The merged copy writes "62.5 kg for 6 reps". The board has the merged words.

## Not settled

- `RoutinesScreen` still shows bare `GENERIC_ERROR`, "Something went wrong. Try again.", with no button when offline, for the whole list. These boards do not follow it, and it is outside this ticket. `TRAIN_ERROR`'s body also ends "then try again", as `HISTORY_ERROR`'s does, which reads as advice for later and not as a missing button.
- The Programme boards ([KEY-843](https://linear.app/sojisoft/issue/KEY-843)) were drawn at the same time. If their chart differs from the table above, KEY-858 has to pick one. The band and legend here follow the phone's merged chart.
- Routines' Progress section offline has no board, as the ticket lists none. With the reads in memory it shows as read. With nothing read the section shows `TRAIN_ERROR`'s title and body and no button in the place of the card on `train-routines-progress-error`, and [KEY-873](https://linear.app/sojisoft/issue/KEY-873) should say so.
