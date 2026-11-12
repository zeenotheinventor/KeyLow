# Web assistant training cards: the boards

The design gate of [KEY-914](https://linear.app/sojisoft/issue/KEY-914) (the web training cards), drawn for [KEY-993](https://linear.app/sojisoft/issue/KEY-993) under [KEY-988](https://linear.app/sojisoft/issue/KEY-988), with the training cards of the cancelled [KEY-994](https://linear.app/sojisoft/issue/KEY-994) folded in. Brief: `design-briefs/web-assistant/brief.md`, section Ticket 2. Zee's rulings: MWEB designers draw with no approval wait (2026-11-05), and when in doubt the web does what the phone does (2026-11-12). He reviews after the build.

Each board is a PNG at device pixel ratio 2 and a standalone HTML page. Every row is one state, and its frames run left to right: 1280 dark, 1280 light, 375 dark, 375 light, each 940 tall. The HTML opens from disk and links the tokens by relative path. Token references only.

## The frame

The frame is the one the 25 October `web-assistant-card` boards settle, drawn over the shell as merged today:

- **1280:** the top bar (mark, Dashboard, Diary, Train, More, Search for a food, then the Assistant button pressed open), the Train page in the page column, and the panel docked right, 400 px wide, under the top bar. The panel is `role="complementary"` with `aria-label="Assistant"`, not a dialog and not modal: the page beside it stays usable (decision 3 of the brief). This supersedes the `role="dialog"` the 25 October boards drew at 1280. The Train page is drawn as labelled placeholders, as `train-session-bar` draws the Dashboard: it is not part of these boards.
- **375:** the full-screen modal sheet (`role="dialog"`, `aria-modal="true"`), the same header (New conversation, Assistant, Close), the thread and the composer.
- The thread is scrolled to its end, as it is when a card arrives. The composer has the training placeholder, Ask about your training, since every card here is opened from Train.

## Boards

Search the canvases by the heading.

| Heading | File | Rows (states) |
| --- | --- | --- |
| `web-assistant-card · routine-created` | `assistant-card-routine-created` | 3 days, as it arrives (focus on a closed day row) · 3 days, a day opened (Monday open, focus ring on its row) · 7 days, as it arrives · 7 days, a day opened, scrolled (Thursday open) · Undone · Can't undo, now active |
| `web-assistant-card · routine-updated` | `assistant-card-routine-updated` | With Undo (focus on Undo) · Undone · Can't undo · Days added, renamed or moved · Removing a day (the reply, then the link on its own, focused) |
| `web-assistant-card · routine-states` | `assistant-card-routine-states` | Active, with Undo · Active, undone · Active, can't undo · Archived, with Undo (after the confirm) · Archived, undone · Archived, can't undo |
| `web-assistant-card · goals-updated` | `assistant-card-goals-updated` | With Undo · Undone · Can't undo |
| `web-assistant-card · exercise-states` | `assistant-card-exercise-states` | Created, Updated and Archived, each with Undo, undone and can't undo (archived after the confirm) |
| `web-assistant-card · set-updated` | `assistant-card-set-updated` | One set, kg · Several sets merged, lb · Undone · Can't undo · Partly undone, the rest changed ([KEY-909](https://linear.app/sojisoft/issue/KEY-909)) |
| `web-assistant-card · workout-deleted` | `assistant-card-workout-deleted` | With Undo (after the confirm) · Undone · Can't undo |
| `web-assistant-card · undo-unavailable-training` | `assistant-card-undo-unavailable-training` | During a workout · Built routine, during a workout · Built routine, workout logged · Partly undone, the rest waits · A change refused, Ask again. Every 1280 frame with a workout running has the session bar across the page column. The phone board's other four states are drawn on their own boards: Routine changed in the app (`routine-updated`, Can't undo), Set changed in the app (`set-updated`, Can't undo), Exercise changed since (`exercise-states`, Updated, can't undo) and Built routine, now active (`routine-created`, Can't undo, now active) |

The long routine is drawn at both widths, as the ticket asks: 7 days with 8 exercises each, closed and with a day open. At 1280 the panel is 400 wide, a little wider than the phone, so the card wraps the same way and nothing on it changes with the width.

## Words

Every card word is core's. The boards are drawn from a script that calls the card builders in `packages/core/src/assistant/cards/` (`buildRoutineCreatedCard`, `buildRoutineUpdatedCard`, `buildRoutineActiveCard`, `buildRoutineArchivedCard`, `buildGoalsUpdatedCard`, `buildExerciseCreatedCard`, `buildExerciseUpdatedCard`, `buildExerciseArchivedCard`, `buildSetUpdatedCard`, `buildWorkoutDeletedCard`), merges the three set cards with `mergeAssistantCards`, and draws what `describeAssistantCard` returns for each outcome: `undone`, `unavailable` with the reason (`changed`, `active`), the partial outcome `{ state: "partial", undone: 2, total: 3 }`, and `workoutInProgress: true` for Can't undo yet. The thread's other words are core's too: `REMOVE_DAY_REFUSAL`, `OPEN_IN_ROUTINE_EDITOR`, `describeConfirmDeleteWorkoutQuestion`, `describeConfirmArchiveRoutineQuestion`, `describeConfirmArchiveExerciseQuestion` and their buttons, `describeWorkoutInProgressRefusal`, `ASSISTANT_STOPPED.askAgain`, `ASSISTANT_SHEET` and `ASSISTANT_TRAIN_SHEET`. The person's own messages are the mobile boards'.

**New strings: none.** The only frame string not in core is the composer hint at 1280, "Enter sends. Shift and Enter add a line.", which the 25 October boards drew and [KEY-995](https://linear.app/sojisoft/issue/KEY-995) adds with the panel. It is not this ticket's.

Golden data, the phone boards' where they have it: Push Pull Legs (Monday Push, Wednesday Pull, Friday Legs, 5 exercises, 15 sets, about 50 minutes each, 45 sets a week, from the goal look better, intermediate), Upper Lower as the routine before, the Seven day split (Monday to Sunday, 8 exercises and 24 sets each, 168 sets a week), squats on Thursday 8 October (100 kg × 6 to 100 kg × 8, and 220 lb to 225 lb stored as kilograms), the Legs workout with 16 sets, Cable crunch on the cable for abs. The exercise names inside the Pull, Legs and seven-day lists are new golden data, since the phone boards only open Push and Upper.

## Sources and where they disagreed

- Phone boards in `design-canvas-assistant-render/assistant-card/` (`routine-created`, `routine-updated`, `routine-active`, `routine-archived`, `goals-updated`, `exercise-created`, `exercise-updated`, `exercise-archived`, `set-updated`, `workout-deleted`, `undo-unavailable-training`) and `assistant/workout-in-progress`.
- Merged mobile kit: `apps/mobile/components/ui/AssistantActionCard/` with `RoutineDayRow/` and `AssistantLinkRow/`, and `AssistantThread` for the link on its own and Ask again.
- The 25 October `web-assistant-card` boards for the panel, the card's measures and the composer.
- Where they disagreed, core won. The phone's refusal board says "Your Legs workout is in progress", a model's own words. The refusal core sends when a confirm is pressed after a workout started has no workout name, so the board draws core's.

## Kit

| Piece | Reuse, extend or new | Notes |
| --- | --- | --- |
| `AssistantActionCard` (web) | New with [KEY-997](https://linear.app/sojisoft/issue/KEY-997), extended here | The web twin of the mobile card, the measures of the 25 October boards: icon tile 36, title body-strong, subtitle caption muted, Undo 36 high in the accent ink, rows with a border on top, total on `surface-raised`, note caption secondary. This ticket needs its `days` field, a link row and the Can't undo yet label |
| `RoutineDayRow` (web) | New, inside the card | A `button` with `aria-expanded` and the name "Monday · Push, 5 exercises · 15 sets · about 50 min", as the phone's. Min height 52, day name body-strong, summary caption secondary, chevron 16 muted that turns up when open. Open, it lists each exercise as body over caption muted, 8 apart. Focus ring inset, `focus-visible:ring-2 ring-inset ring-focus-ring`, as `ui/ListRow` draws it |
| `AssistantLinkRow` (web) | New, inside the card | Two placements, as the phone's: the last line of a card (border on top, inset focus ring) and on its own under a reply (bordered, `radius-large`, outer focus ring). Label body-strong in the accent ink, ChevronRight 16 |
| Undo | Reuse `ui/Button` ghost, small | The accent ink label. Its focus ring is the kit's |
| Quick reply Ask again | Reuse `ui/ChipGroup` | As the 25 October boards draw quick replies |
| Your message, the reply | From the frame ([KEY-995](https://linear.app/sojisoft/issue/KEY-995)) | `ChatMessage`, you and assistant |
| Session bar | Reuse, as `train-session-bar` | Spans the page column beside the panel |
| Icons | Reuse | Check, RotateCcw, Archive, Target, Trash2, ChevronDown, ChevronUp, ChevronRight, the names `describeAssistantCard` returns |

## Decisions

1. Recommended (Zee away), reversible: each web board twins its phone board state for state, with the card unchanged at the panel's width. The only web differences are the frame (docked panel at 1280, modal sheet at 375), the focus rings and the session bar placement.
2. Recommended (Zee away), reversible: a day row is a real `button` with `aria-expanded`, closed on arrival, one open at a time, as the phone's card holds it. Enter and Space open it. The focus ring is the inset one of `ListRow`, so it sits inside the card's border.
3. Recommended (Zee away), reversible: a long routine is not cut short or capped in height. The thread scrolls, and the open day pushes the rest down, as on the phone. The board's "a day opened, scrolled" row shows the thread scrolled so the open day's row is in view.
4. Recommended (Zee away), reversible: Undo, the link row and the day rows keep the phone's order on the card: header with Undo, rows, days, total, note, link. Tab order follows it.
5. Recommended (Zee away), reversible: the link opens the routine editor or the session beside the open panel at 1280, and closes the sheet first at 375, as decision 3 of the brief says.
6. Recommended (Zee away), reversible: a pressed confirm button is drawn as your message under the question (Archive routine, Archive exercise, Delete workout), as the phone's boards draw it.
7. Recommended (Zee away), reversible: during a workout the web uses the phone's rule as core already words it: Can't undo yet in the muted caption, and the wait note, which keeps "Put back 2 of 3 sets." in front when a partial Undo came first. Undo comes back by itself when the workout ends. At 1280 the session bar stays across the page column, not under the panel. At 375 the modal sheet covers it.
8. Recommended (Zee away), reversible: the refusal after a confirm keeps core's words, "Finish it or discard it on the Train tab, then ask again.", on the web too. Train is a section of the top bar there, not a tab, but a web variant would be a new string in core for one word, and the phone wording still reads. Alternative: a web string with "on the Train page".
9. Recommended (Zee away), reversible: the partial Undo of [KEY-909](https://linear.app/sojisoft/issue/KEY-909) is drawn on the merged set card, the one card that groups several writes in practice, with the reason `changed`. Any other grouped card words it with `describeChangesPartlyUndone` in the same place, the note.
10. Recommended (Zee away), reversible: the Assistant button in the top bar is drawn pressed while the panel is open (`aria-expanded`, `surface-raised`). The 25 October boards draw it plain. [KEY-995](https://linear.app/sojisoft/issue/KEY-995) owns the button, so this is a suggestion to it.

## What is not drawn

- Training answers, suggestions, confirms before a write, injury and workout-in-progress answers to a question: the 26 boards and the phone, as the brief lists.
- What the assistant changed with training rows: `web-assistant-settings · changes` and the phone.
- The Undo while it runs (busy): the kit Button's loading state, as on the food cards.
- The cleared routine card ("No routine is active"): the same card with no link, worded by `buildRoutineClearedCard`.
- Two refusal reasons that no phone board draws, so no web board does either. Each is the same card with Can't undo and this note, worded by `describeAssistantCard`, so [KEY-997](https://linear.app/sojisoft/issue/KEY-997) and [KEY-914](https://linear.app/sojisoft/issue/KEY-914) can map every reason:
  - `routine_updated` refused with reason `logged`: `ASSISTANT_CARD_NOTES.routineDayWasLogged`, "You logged a workout from a day this added, so Undo is off. Edit it in the routine editor."
  - `exercise_created` refused with reason `used`: `ASSISTANT_CARD_NOTES.exerciseWasUsed`, "You have used this exercise since, so Undo is off."
