# Web Programme boards

The design gate of the web Programme tickets ([KEY-863](https://linear.app/sojisoft/issue/KEY-863), [KEY-868](https://linear.app/sojisoft/issue/KEY-868), [KEY-869](https://linear.app/sojisoft/issue/KEY-869), [KEY-870](https://linear.app/sojisoft/issue/KEY-870), [KEY-871](https://linear.app/sojisoft/issue/KEY-871)) and half of [KEY-858](https://linear.app/sojisoft/issue/KEY-858) (the kit chart). Drawn for [KEY-843](https://linear.app/sojisoft/issue/KEY-843) on Zee's ruling of 2026-11-05. Zee reviews after the build.

Every board is a PNG at device pixel ratio 2 and a standalone page that opens from `file://`, with four frames from left to right: 1280 dark, 1280 light, 375 dark, 375 light. `program-more-row` has two rows of four: with a programme on top, without one under it. Frames are at least 812 high, and taller where the page is. They are drawn at their full length, so nothing is cut. The pages link `packages/tokens` by relative path and use token references only.

Sources, in order: the merged phone screens (`apps/mobile/components/ProgramScreen/`, `ProgramEditScreen/`, `ProgramExplainerSheet/`, `TargetsScreen/EngineTargets/`, `DiaryScreen/useCheckinToast.ts`, the More route), the canvas "Ki-Lo program" for the golden figures, then the web boards and kit for the shell, page width, dialogs and type. Every word and sentence is the real output of `packages/core/src/copy/`, run on the phone board's figures. The weekly numbers are the canvas's golden fixture: 2,580 kcal (likely 2,430 to 2,730), targets 2,140 kcal, 126 g protein, 245 g carbs, 73 g fat.

## Boards

| Heading                        | File                           | What it shows                                                                                                                  |
| ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `program-default`              | `program-default`              | The page: estimate, this week's targets, last check-in, chart, Your programme, Edit programme, How it works, the legal line    |
| `program-settling`             | `program-settling`             | Settling and Estimate badges, the first check-in banner with its three counts and tip, First check-in, two weeks on the chart  |
| `program-no-program`           | `program-no-program`           | The offer: three points, Estimate my targets, the person's own target, the legal line                                          |
| `program-loading`              | `program-loading`              | The region named "Loading your programme", a shape for each part of the page                                                   |
| `program-error`                | `program-error`                | "Couldn't load your programme" with Try again                                                                                  |
| `program-offline`              | `program-offline`              | The connection went while the page was open: the banner over the figures, Edit programme off, How it works still on            |
| `program-offline-nothing-read` | `program-offline-nothing-read` | Opened offline with nothing read: the error board with no Try again, as the Weight page does                                   |
| `program-checkin-arrived`      | `program-checkin-arrived`      | The first open after a new check-in, caught mid motion: the numeral in the accent, the check-in card cutting in from the side  |
| `program-checkin-not-measured` | `program-checkin-not-measured` | The Not measured badge, the carried forward row, one reason line and the plain line, on the golden day-14 check-in             |
| `program-checkin-guardrail`    | `program-checkin-guardrail`    | The guardrail line on the targets card, and the step clamp and 30% deficit lines on the check-in card                          |
| `program-chart-few-points`     | `program-chart-few-points`     | Two weeks and one week of settling, one above the other. The two "Board note" lines are not app copy                           |
| `program-chart-empty`          | `program-chart-empty`          | The label over the empty state, in the chart's place                                                                           |
| `program-chart-error`          | `program-chart-error`          | The chart's history cannot be read: the error card in its place, and the rest of the page stands                               |
| `program-explainer`            | `program-explainer`            | "How your programme works" as a `Dialog` over the page, the seven sections and the legal line, Done in the footer              |
| `program-edit`                 | `program-edit`                 | Edit programme: Goal and Rate, Protein and Diet style, the footnote and Save changes                                           |
| `program-edit-offline` | `program-edit-offline` | Offline with the form read: the info banner in the footer, Save changes off, the choices still free |
| `program-edit-saving`          | `program-edit-saving`          | Save changes with its spinner, the back link dimmed                                                                            |
| `program-edit-failed`          | `program-edit-failed`          | The error banner over the footnote, every choice kept, Save changes tried again with the same button                          |
| `program-edit-under-18`        | `program-edit-under-18`        | Lose weight not offered, Maintain weight chosen, the under 18 note, no Rate                                                    |
| `program-edit-loading`         | `program-edit-loading`         | The form's shapes while its reads arrive                                                                                       |
| `program-edit-error` | `program-edit-error` | The form's reads failed: the error board under the Edit programme title. Opened offline with nothing read, it is this board with no Try again, which would do nothing |
| `program-targets-engine`       | `program-targets-engine`       | Targets while a programme runs: the Programme row, the four figures read only, Estimate my targets, Set my own targets         |
| `program-more-row`             | `program-more-row`             | The Programme row under Targets on More, with a programme and without. The sections under Body are unchanged and not drawn     |
| `program-toast`                | `program-toast`                | "Check-in done: new targets" with See why, at the top of the Diary. The Diary is drawn as built, and only the toast is new     |

`program-offline-nothing-read`, `program-chart-error`, `program-edit-loading` and `program-edit-error` are not in the ticket's list. The merged phone screens have those states, so they are drawn and not lost.

## Built in stages

The boards draw the finished page. It goes live in stages, and each row or card lands with what it opens.

- **[KEY-863](https://linear.app/sojisoft/issue/KEY-863), the page and its More row:** the estimate, the settling banner, the targets, the check-in card, Your programme and the legal line. The chart card and both rows of the Edit and How it works card are absent, so until one lands that card is absent too.
- **[KEY-868](https://linear.app/sojisoft/issue/KEY-868):** adds the chart card and the How it works row with its dialog.
- **[KEY-869](https://linear.app/sojisoft/issue/KEY-869):** adds the Edit programme row with its page.
- **[KEY-871](https://linear.app/sojisoft/issue/KEY-871):** adds the first open motion and the toast on the Diary. Until then a new check-in shows at rest.

## Page layout, for KEY-863

- Same frame as the Weight page: the top bar with More current, `max-w-[1180px]`, the shell's padding, the accent back link, the `h1`.
- Two columns from the large breakpoint, `minmax(0, 1fr)` and 400, 24 apart. The first holds the estimate, the settling banner, the targets, the check-in and the chart. The second holds Your programme, the two rows and the legal line.
- Under the large breakpoint they stack, which is exactly the phone's order, so there is no reordering in the markup.
- Cards are 16 apart. The tiles are the web's `MacroTile`, the label above the amount, with the amount as one run, "126 g".

## The chart, for KEY-858

It is one component with the exercise progress chart. The spec is the table in `train.md` of [KEY-841](https://linear.app/sojisoft/issue/KEY-841), section "The chart, for KEY-858 and the Programme boards", and these boards follow it number for number: 754 by 220 at 1280 in the first column and 341 by 160 at 375, 12 and 44 of room at the sides, equal week columns, three values on the right, the bottom line in `chart-axis`, line 2.5, points 2.5, marker 4 with a 2 ring in `surface`, band behind them with a 12 wide bar for a week alone, labels counted back from the latest (7 at 1280, 4 at 375), legend and summary inside the `figure`. The caller gives it `band`, `legend` and a `formatValue` that rounds to 10, from `buildExpenditureChartView`.

It measures its column and has no fixed width. The two columns start at the large breakpoint, 1024, where the first column is about 536 wide (1024, less 64 of padding, the 400 column and the 24 gap). The boards draw 1280 and 375, so the widths between 1024 and 1279 are undrawn and the chart has to hold there by measuring.

## Kit

- **Reuse:** the `MacroTile` of `components/foods/FoodDetail/MacroHero/MacroTile`, which [KEY-844](https://linear.app/sojisoft/issue/KEY-844) lifts to `components/ui`: its `detail` variant with `share={null}`, as `setup-estimate` uses it. It stands in for `MacroBars`, which draws grams eaten against a target, not a target on its own. Also `Card`, `Badge` (accent, warning, neutral), `GroupedList`, `ListRow` (with `icon`, `value`, `disabled`), `Banner` (review compact without its icon as the trend explainer's, info with `WifiOff` as the Diary's, error), `Button` (with `loading`), `Dialog`, `Toast` (`icon: RefreshCw`, `actionLabel`), `EmptyState`, `ErrorState` (`size` list and page), `Skeleton` with `SkeletonBone`, `OptionCard` and `OptionCardGroup`, `SegmentedControl`, the Weight page's accent back link.
- **Extend:**
  - `ListRow`: a `macro` prop, the phone's 8 square dot before the title in the body weight, for the four figures on Targets.
  - `GroupedList`: a `hidesTitle` prop as the phone's, for the Edit programme and How it works card, which is named but has no heading.
  - `EmptyState`: a `points` prop as the phone's, or `NoProgramView` composes the same parts from `Card` and `ListRow`.
- **New:**
  - `LineChart` ([KEY-858](https://linear.app/sojisoft/issue/KEY-858)).
  - `SettlingProgressBar` ([KEY-863](https://linear.app/sojisoft/issue/KEY-863)). The trend explainer's `SettlingProgress` has no label over its bar, so check whether one can grow into the other.
  - The sticky form footer of Edit programme, feature code and not kit.

## New strings

British English, in `packages/core/src/copy/program.ts`.

| Name                                     | Wording                                                                       | Where                                         |
| ---------------------------------------- | ----------------------------------------------------------------------------- | --------------------------------------------- |
| `PROGRAM_SCREEN.offlineBody` | Showing your programme from this session. Changes need a connection. | `program-offline`, under `OFFLINE_BANNER.title` |
| `PROGRAM_EDIT.backName`                  | Back to Programme                                                             | The back link of every Edit board             |
| `PROGRAM_EDIT.saveOffline` | Saving your programme needs a connection. Try again when you're back online. | `program-edit-offline`, in the footer |

Everything else already exists. `MORE_SCREEN.nutrition.program`, `describeNextCheckInSubtitle`, `TARGETS_SAVED_TOAST` and `TARGETS_PAGE.more` are reused as they are.

## Decisions

- **Recommended (Zee away), reversible:** Programme and Edit programme are pages under More (`/more/program`, `/more/program/edit`), and the explainer is a `Dialog`, as the web's weight explainer is. This is the ticket's own.
- **Recommended (Zee away), reversible:** the chart stays in the wide first column, at the Weight chart's size, so the kit chart has the same width on all three pages, and the second column is the short settings column.
- **Recommended (Zee away), reversible:** Edit programme is two columns at 1280, Goal and Rate beside Protein and Diet style, at the same 1180 as the page it came from. A single column of 13 cards is a long scroll on a desktop screen. At 375 it is the phone's one column.
- **Recommended (Zee away), reversible:** the footer of Edit programme is sticky at the bottom of the window, as the phone's stays in view. It spans the page on `surface-sheet`, with the footnote left and Save changes right at 1280. At 375 it stacks with a full width large button. The boards draw it at the foot of the full length frame.
- **Recommended (Zee away), reversible:** Edit programme has no Close and no Cancel. The back link does what the phone's Close does: it leaves without saving and without asking, and it is dimmed and inert while saving. It does not ask before leaving, where `CloseGoalDialog` and `DiscardRecipeDialog` do: the phone does not ask, and the form is four choices with nothing typed, so little is lost. Browser Back is unguarded in the same way.
- **Recommended (Zee away), reversible:** a chosen option has the web `OptionCard`'s look, the accent border on the muted fill with no radio mark, where the phone draws a radio mark.
- **Recommended (Zee away), reversible:** Done sits in the footer of the explainer as in the trend explainer, where the phone has it beside the title. The panel is 560 and scrolls inside itself on a shorter window, and it fills the screen below 700 as `Dialog` does.
- **Recommended (Zee away), reversible:** offline, the banner sits over both columns and the read figures stay. Edit programme is the one thing off, since it needs a connection, and How it works stays on as it reads nothing. The figures are only what the open page holds: the web has no persisted cache, so the words say "from this session", as `RECIPES_OFFLINE.inMemoryBody` does, and not "last saved". Opening the page offline is `program-offline-nothing-read`.
- **Recommended (Zee away), reversible:** Edit programme offline follows `GoalSummaryScreen`: an info `Banner` with `saveOffline`, and Save changes disabled, at the button's own `opacity-40`. The banner takes the same slot in the sticky footer as the failed banner, over the footnote, and the footer grows to hold it, so the form needs that much more room to scroll clear of it. It shows from the start and not only after a change, because Save changes is always on screen here, where Goal's Save only appears after a change, so a dimmed button with no reason would be left unexplained. The slot holds one banner: offline replaces an earlier failed one, and it goes when the connection returns. The choices stay free and are kept, and the back link stays on. Opened offline with nothing read, Edit is `program-edit-error` with no Try again, as the Weight page does.
- **Recommended (Zee away), reversible:** the first open motion is the phone's: the numeral counts up from the estimate before, flashes the accent, and the check-in card cuts in from the side, once. On the web that is `useCountUp` from `components/ui/CalorieRing`, the `flash` animation (`apps/web/tailwind/animations/flash.json`, `--duration-flourish`), and `kl-cut-in` (in `packages/tokens/src/source/motion.css`, with no Tailwind animation file yet, so it needs one, as `setup.md` of KEY-844 also says). `useReducedMotion` in `apps/web/lib/motion` decides: with reduced motion the figure shows at once with no flash and the card only fades. Where "seen" is remembered on the web is [KEY-871](https://linear.app/sojisoft/issue/KEY-871)'s to settle.
- **Recommended (Zee away), reversible:** the toast is where the kit's `Toast` puts every toast: top right at 1280 and across the top at 375, over the top bar for its 5 seconds. See why goes to `/more/program`. It shows once, on the Diary, as on the phone. It appears on arrival and not after a keyboard action, so `focusAction` does not apply and See why cannot be reached by keyboard within the 5 seconds. Nothing is lost by that: the toast only points at the page, and Programme stays reachable from More.
- **Recommended (Zee away), reversible:** on Targets, the column is the page's own 560 with its breadcrumb. Set my own targets is in the flow at the end of the column rather than in a pinned footer, because the page is short: right aligned at 1280, full width at 375. It opens the form as built, whose save asks first. Offline it is off, per [KEY-870](https://linear.app/sojisoft/issue/KEY-870), with the figures as read.
- **Recommended (Zee away), reversible:** Estimate my targets is drawn on `program-targets-engine` as on the phone. It lands with the web wizard's estimate ticket, not with KEY-870, and until then the row is left out.
- **Recommended (Zee away), reversible:** the Programme row on More has no icon, because no row on the web's More has one. The phone's rows do.
- **Recommended (Zee away), reversible:** Estimate my targets on `program-no-program` is a centred medium button at 1280 and full width at 375, and it opens the wizard. Until the web wizard exists, it must not promise an estimate the Targets page does not offer. So in the interim the view keeps its title, body and three points, the button is a secondary Set my own targets (`PROGRAM_TARGETS_SCREEN.setOwnTargetsLabel`, no new string) that goes to `/more/targets`, and the "stay until you start" line is left out, as there is nothing to start. The board draws the final state, and the wizard ticket swaps the button in.

## Where the sources disagreed

- **Macro tiles.** The canvas draws the grams over the label and says "Carbohydrate". The phone's merged tile puts the label first, says "Carbs" (`SETUP_ESTIMATE.tileLabels`) and mutes the "g". The web's existing `MacroTile` also puts the label first, and draws the amount as one run, "126 g". The web tile is drawn, so these boards agree with KEY-844's `setup.md`.
- **Toast place.** The canvas's `diary · targets-updated` has it at the bottom. Zee's ruling of 2026-10-27 and the web kit put every toast at the top. The top is drawn.
- **The likely range on the chart.** `train-chart-states` of KEY-841 writes "likely 2,431 to 2,728" in its band specimen. The merged phone goes through `expenditureBand`, which rounds to 10, so the summary reads "likely 2,430 to 2,730", as the canvas does. The chart's drawing is not affected. The band's shape uses the same ends the summary reads, which `expenditureBand` has already rounded to 10, on the web and on the phone.
- **Guardrail hero.** The canvas's guardrail boards are scrolled past the estimate, so its figure there (3,158 kcal, likely 2,870 to 3,440) comes from the fixture's own working in `ProgramScreen.dc.html`.

## Not drawn

- The floor guardrail, with its plain follow-up line, and the two reason not measured card. They use the same `SummaryLine` kinds as the two check-in boards, and `guardrailLineOrder` and `describeNotMeasuredReasons` decide the lines.
- `targets · switch-to-manual`: [KEY-769](https://linear.app/sojisoft/issue/KEY-769) already built the question on the web.
- The Targets saved toast after an edit: the existing toast, as the phone uses it.
