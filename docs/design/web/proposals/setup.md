# Web setup wizard boards

Boards for the web setup wizard ([KEY-844](https://linear.app/sojisoft/issue/KEY-844), part of [KEY-6](https://linear.app/sojisoft/issue/KEY-6)). The design gate was met by these boards, under Zee's ruling of 2026-11-05 for MWEB. Zee reviews them after the build. They are the source for [KEY-864](https://linear.app/sojisoft/issue/KEY-864), [KEY-872](https://linear.app/sojisoft/issue/KEY-872), [KEY-875](https://linear.app/sojisoft/issue/KEY-875) and [KEY-876](https://linear.app/sojisoft/issue/KEY-876).

Each board is a PNG at device pixel ratio 2 and a standalone page that opens from `file://`. The frames are 1280 dark, 1280 light, 375 dark and 375 light, from left to right. The pages link `packages/tokens` by relative path and use no raw hex. Every word and number is the output of the real function in `packages/core` (the copy, `startingPlan`) or of the phone's `describeEstimateLines` and `measuredEstimateOf`, except the three new strings named below.

## Golden data

- Main sample, from the setup canvas: male, born 14 March 1991, 35 on 23 October 2026, 180 cm, 80.0 kg, lightly active, lose 0.5% a week, moderate protein, balanced. It gives 1,970 kcal, P 128, C 218, F 65, expenditure 2,413.
- Floor: female, 30, 160 cm, 55.0 kg, sedentary, lose 1.0%. 1,200 kcal, P 88, C 127, F 38, expenditure 1,487.
- Deficit cap: male, 40, 175 cm, 130.0 kg, moderately active, lose 1.0%. 2,390 kcal, P 208, C 234, F 69, expenditure 3,408.
- Measured, from the program canvas: the main sample at 0.25% a week, a check-in on Friday 23 October with a mean of 2,579.54 kcal, trend weight 79.02 kg. 2,360 kcal, P 126, C 280, F 82, expenditure 2,580.
- Under 18: born 2 June 2010, aged 16, Maintain chosen, so step 5 of 7.
- Targets page: 2,200 kcal, P 160, C 220, F 70, the M3 board's sample.

## Boards

Search by heading. The file is the heading's last word with `setup-` in front.

| Heading | File | State | Kit |
| --- | --- | --- | --- |
| `web-setup · sex` | `setup-sex` | First run, nothing chosen, Continue off, "I'll set my own targets" | Card, OptionCard, Button |
| `web-setup · sex-chosen` | `setup-sex-chosen` | First run, Prefer not to say chosen | Card, OptionCard, Button |
| `web-setup · escape-error` | `setup-escape-error` | The escape's write failed, the save-failed line above the buttons | Card, OptionCard, Banner, Button |
| `web-setup · birth-date` | `setup-birth-date` | Valid, "You are 35." | Card, NumericInput, Button |
| `web-setup · birth-date-under-13` | `setup-birth-date-under-13` | Refused, Continue off | Card, NumericInput, Button |
| `web-setup · birth-date-future` | `setup-birth-date-future` | Refused, Continue off | Card, NumericInput, Button |
| `web-setup · body` | `setup-body` | kg and cm | Card, SegmentedControl sm, NumericInput, Button |
| `web-setup · body-imperial` | `setup-body-imperial` | lb, ft and in | Card, SegmentedControl sm, NumericInput, Button |
| `web-setup · body-prefilled` | `setup-body-prefilled` | "From your weigh-in on 21 Oct" under the weight | Card, SegmentedControl sm, NumericInput, Button |
| `web-setup · body-error` | `setup-body-error` | Both fields refused, Continue off | Card, SegmentedControl sm, NumericInput, Button |
| `web-setup · activity` | `setup-activity` | Lightly active chosen | Card, OptionCard, Button |
| `web-setup · goal` | `setup-goal` | Lose chosen, the pregnancy note | Card, OptionCard, Banner, Button |
| `web-setup · goal-under-18` | `setup-goal-under-18` | Lose off with its reason, the under 18 note, step 5 of 7 | Card, OptionCard, Banner, Button |
| `web-setup · rate-lose` | `setup-rate-lose` | 0.5% chosen, Suggested | Card, OptionCard, Badge, Button |
| `web-setup · rate-gain` | `setup-rate-gain` | 0.25% chosen, Suggested | Card, OptionCard, Badge, Button |
| `web-setup · protein` | `setup-protein` | Moderate chosen, grams a day | Card, OptionCard, Button |
| `web-setup · diet` | `setup-diet` | Balanced chosen, step 8 of 8 | Card, OptionCard, Button |
| `web-setup · estimate` | `setup-estimate` | First run, Start | Card, Badge, MacroTile, ListRow, Button |
| `web-setup · estimate-measured` | `setup-estimate-measured` | Recalculate after a measured check-in, Close, Save targets | As estimate |
| `web-setup · estimate-carried-forward` | `setup-estimate-carried-forward` | Recalculate after check-ins that never measured | As estimate |
| `web-setup · estimate-guardrail` | `setup-estimate-guardrail` | The floor line replaces the rate line | As estimate |
| `web-setup · estimate-guardrail-deficit` | `setup-estimate-guardrail-deficit` | The 30% deficit line replaces the rate line | As estimate |
| `web-setup · estimate-saving` | `setup-estimate-saving` | Start busy, Back dimmed and inert | As estimate |
| `web-setup · estimate-save-error` | `setup-estimate-save-error` | The save-failed line, Start live for the retry | As estimate, Banner |
| `web-setup · estimate-read-failed` | `setup-estimate-read-failed` | The saved answers could not be read, Save targets off, the banner says why | As estimate, Banner |
| `web-setup · loading` | `setup-loading` | The saved answers being read | Card, Skeleton, SkeletonBone |
| `web-setup · error` | `setup-error` | The saved answers could not be read, recalculate, the step still usable, on every step from 1 to 8 | Card, OptionCard, Banner, Button |
| `web-setup · offline` | `setup-offline` | The estimate offline, Start off, the banner says why | As estimate, Banner |
| `web-setup · recalculate` | `setup-recalculate` | Step 1 from Targets, prefilled, Close | Card, OptionCard, Button |
| `web-setup · targets-row` | `setup-targets-row` | Estimate my targets at the top of the manual Targets page | Card, ListRow, NumericInput, Button |

The ticket names twenty boards. These nine are added so no state of the phone's boards or merged screen is lost, and `setup-estimate-read-failed` is added for the hold decided below: `setup-sex-chosen`, `setup-escape-error`, `setup-birth-date-under-13`, `setup-birth-date-future`, `setup-body-imperial`, `setup-body-prefilled`, `setup-body-error`, `setup-estimate-carried-forward` and `setup-estimate-guardrail-deficit`.

Not drawn, because they change only words in a place already drawn: the other birth date lines, the `max_surplus`, `profile_max` and `macro_fit` guardrail lines (each `macro_fit` line is one more Info row under the first), and the floor above expenditure, which adds its advice to the same row. Pressing the escape is the kit's busy ghost Button. In recalculate mode, Start is off while the expenditure history and the weight trend load (`isWaitingForProgramme`), which draws as the `setup-offline` button without its banner.

## How the phone becomes web

- The card is the shape of `QuestionStepper`: 560 px at most, 32 px of padding from 700 px and 16 px under it, a caption above a 4 px progress bar, the h1, the helper, the answers, a notice, then a footer at the right.
- The phone's header becomes the caption and the footer. Its title and subtitle read "About you · Step 1 of 8". The estimate has a title only and a full bar. Back is a secondary Button and Close a ghost Button, in the places `QuestionStepper` gives Back and Cancel, shown exactly when the phone shows them. Continue is md, not the phone's lg.
- First run step 1: the escape is a ghost Button in the secondary ink. From 700 px it sits left of Continue. Under 700 px the two do not fit in a row, so they stack with Continue on top, as the phone draws them.
- The bar fills as on the phone, from core's `progressFraction`: step n of 8 is n ninths, step n of 7 is n eighths, the estimate is all of it. `SetupShell` sets a `--progress` custom property from it, read by a `w-[var(--progress)]` class, as `MacroBarRow` does with `--fill`. It is the allowed runtime exception, and a class list of ninths and eighths would drift from core.
- Notices sit above the buttons, as in the phone's footer. The footer does not stick, as the goal questionnaire's does not.
- Focus moves to the h1 when the step changes, as `QuestionStepper` does.

## Kit: reuse, extend or new

- **Reuse:** `Card`, `OptionCard` and `OptionCardGroup`, `NumericInput` (`className="text-left"` and `invalid` for the three date fields, with one message under them), `SegmentedControl size="sm"`, `Banner`, `Badge`, `Button`, `ListRow`, `Skeleton` with `SkeletonBone` children, `Toast` for "Targets saved".
- **Extend:** `Banner`'s `BannerAction` takes `disabled`, for Try again while it retries. `DashboardNav`: `/setup` joins More's `alsoCurrentOn`.
- **Move:** `MacroTile` lives in `components/foods/FoodDetail/MacroHero/`. The estimate uses its `detail` variant with `share={null}`, so it wants lifting to `components/ui` or importing from there.
- **New:** `apps/web/components/setup/` as the tickets name it, with its own `SetupShell` in the shape of `QuestionStepper`, which stays as it is. `Calculator` is the one new icon use, from `lucide-react`. No new kit component.
- The estimate's expenditure row is `Card` plus `ListRow`. The web `GroupedList` has no `hidesTitle` today, only the phone's has. [KEY-843](https://linear.app/sojisoft/issue/KEY-843)'s `program.md` adds that prop for its own card. Once it lands, `GroupedList hidesTitle` draws this row the same and may be used, which is the phone's markup. This ticket does not add the prop.
- `DateField` is not used, because the phone asks for the date typed as three fields.

## New strings

Exact wording, for `packages/core/src/copy/setup.ts`:

- `SETUP_SHELL.loadingName`: "Loading your answers". Spoken only, the name of the skeleton, as `GOAL_SCREEN.loadingName`.
- `SETUP_SHELL.readFailed`: "Couldn't load your saved answers. You can still answer here." On steps 1 to 8.
- `SETUP_ESTIMATE.readFailedBody`: "Couldn't load your saved answers. Ki-Lo needs them before it can save." On the estimate.
- `SETUP_ESTIMATE.offlineBody`: "Your answers stay on this page. Saving needs a connection."

One new join, no new words: a small helper for the caption, "About you · Step 1 of 8", from `SETUP_GROUP_TITLES` and `describeSetupStepLabel`. The bar's accessible name stays `describeSetupStepLabel` alone, or `SETUP_SHELL.setupCompleteName` on the estimate.

Reused: `OFFLINE_BANNER.title`, `SAVE_FAILED_BANNER`, `RETRY_LABEL`, `TARGETS_SAVED_TOAST` and every `SETUP_*` and `PROGRAM_SETUP_*` string.

## Decisions

- **Recommended (Zee away), reversible:** the wizard is a page in the signed-in shell, in the same column as the goal questionnaire, not a full-bleed takeover, because a person must still see they can get to Terms and sign out. From the ticket.
- **Recommended (Zee away), reversible:** the phone's first run stays: a new account is sent to step 1 once, and the escape marks them set up. From the ticket.
- **Recommended (Zee away), reversible:** More is the current section on `/setup`, in both modes, as on the goal questionnaire, since the top bar goes by the address.
- **Recommended (Zee away), reversible:** `setup-loading` is a skeleton in the shape of the card, following `GoalFlow`: it waits only while a request is running, and a read paused because the browser is offline opens the step at once. The phone draws no skeleton and fills the answers in when they arrive. The web's own stepped flow chooses not to show a question before its answer is known, and the ticket asks for this board.
- **Recommended (Zee away), reversible:** `setup-error` keeps the step usable and adds a Banner with Try again, on every step from 1 to 8. It is drawn in recalculate mode. The phone opens the step empty and says nothing when the read fails. The Banner adds the reason and the retry. The saved answers still lie under whatever has been answered when a retry brings them, as the reducer does. A full page `ErrorState`, as on web Targets, was rejected, because it would block questions that work without the read. The first run does not reach this state from the gate, which fails open on a failed read.
- **Recommended (Zee away), reversible:** saving is held while the read has failed, which differs from the phone. Start and Save targets are off, and `setup-estimate-read-failed` carries the same Banner with a sentence saying why. Without the read, `storedWeightUnit` and `latestWeighInKg` are null, so a save would silently replace a stored unit and add a duplicate weigh-in. Close and Back stay live, and the answers stay.
- **Recommended (Zee away), reversible:** while Try again runs, the Banner and its sentence stay where they are and Try again is dimmed to 40% and inert, with no spinner. Start and Save targets stay off. On success the Banner goes and the buttons come on. On failure Try again is live again. The step stays on the page throughout, since the skeleton is for the first read only.
- **Recommended (Zee away), reversible:** the wizard has an address per step, like `/goal/N`, so the browser's Back goes back a step, as Android's back does on the phone. `/setup` is step 1, which keeps `/setup?mode=first-run` valid for the gate. `/setup/[step]` sits under a layout holding the draft reducer, `mode` is carried on every address, and a step address whose earlier steps are unanswered redirects to the first incomplete step. It needs no new board.
- **Recommended (Zee away), reversible:** `setup-offline` is the estimate, because that is where the phone refuses. Steps 1 to 8 draw no offline notice on the phone and none here, and the answers stay in the reducer. An escape pressed offline fails to `setup-escape-error`.
- **Recommended (Zee away), reversible:** the offline banner's sentence is new. The phone's estimate shows `OFFLINE_BANNER.body`, "Showing your last saved diary. Changes need a connection.", which is not true on this page and does not say why Start is off, which [KEY-875](https://linear.app/sojisoft/issue/KEY-875) asks for. The wording follows `RECIPE_EDITOR.offlineEditingBody`. The phone is not changed by this ticket.
- **Recommended (Zee away), reversible:** the phone's flourish has a web form. On arrival the numeral counts up (`useCountUp` from `CalorieRing`) and flashes (`flash`), one `slash` crosses the card, and the tiles cut in 36 ms apart (`kl-cut-in` needs a Tailwind animation file). No haptic. `motion-reduce` removes the count, flash and slash, and the tiles only fade. The boards draw the resting state.
- **Recommended (Zee away), reversible:** the calorie card is a surface `Card` inside the wizard's card, a bordered box as the option cards are. `GoalSummaryScreen` nests a raised card, but `MacroTile`'s raised fill would vanish on it.
- **Recommended (Zee away), reversible:** `MacroTile` keeps the web kit's order, the label above the amount. The phone's tile has the amount above the label.
- **Recommended (Zee away), reversible:** `OptionCard` has no radio circle, as the web kit draws it. The phone's card has one.
- **Recommended (Zee away), reversible:** Close leaves at once with no dialog, as the phone does, although the goal questionnaire asks through `CloseGoalDialog`. Nothing is saved until the estimate, and a recalculation starts from the saved answers again.
- **Recommended (Zee away), reversible:** the row on Targets is first under the heading, as on the phone. `setup-targets-row` draws the manual state. The row sits in the same place in the programme state of [KEY-870](https://linear.app/sojisoft/issue/KEY-870).

## Where the sources disagree

The merged code won each of these.

- Carbohydrate on the main sample: canvas 219 g, `startingPlan` 218 g. On the measured sample: program canvas 278 g, `recomputeTargets` 280 g.
- Tile label: canvas "Carbohydrate", `SETUP_ESTIMATE.tileLabels` "Carbs".
- Accuracy line: the canvas's board marked live now has "it can be out by a few hundred kcal", and the merged screen always uses `ACCURACY_LINE_WITH_CHECKIN`.
- The measured board is in the program canvas (`design-canvas-program`), not the setup canvas the ticket names. The carried-forward state has words in core and no board on either.
- The ticket's Sources list names no loading, error or offline board on the phone, and the phone has none as such. Those three are decided above.

## Open for the engineer

- The read's status does not say a retry has failed before. On a retry with no data the query goes back to `pending` and `isError` is false until it settles (checked against the repo's `@tanstack/query-core`). So the hold keys off `setupState.data === undefined`, the Banner needs the screen to remember that the read failed, and the skeleton must not come back during a retry. The offline case also has no data, and Start is off there already.
- At 375 the browser breaks "Ki-Lo" after its hyphen in a few long lines, such as the goal note. It is left as it is, because a non-breaking hyphen would be a change to the copy across the app.
