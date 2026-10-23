# Programme designs

The approved source of the canvas "Ki-Lo program", version 2, copied byte for byte. Zee approved it on 2026-10-23 ([KEY-623](https://linear.app/sojisoft/issue/KEY-623)): "Both canvases are approved, the setup wizard and the program, with all their recommended answers."

The published canvas is <https://claude.ai/artifact/2KdaDyVg11aMjH749DCra2>. These files are what it holds, so an engineer can read every board without an account on the design tool. There are no rendered PNG or HTML pages here. Read the `.dc.html` files as markup: the layout, the tokens (defined in [`packages/tokens/css/kilo-tokens.css`](../../../packages/tokens/css/kilo-tokens.css)) and every string are in them. The notes in `canvas.json` hold the copy, behaviour, accessible names and arithmetic for each row of boards.

## Files

Components. Each has a state prop (`screenState`, `chartState`, `state` or `section`) and a `theme` prop, and its states are listed in the `data-props` enum at the end of the file.

| File                            | What it draws                                                                  |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `ProgramScreen.dc.html`         | The Programme screen, its states and the check-in summary card                 |
| `ProgramExplainerSheet.dc.html` | The "How your programme works" sheet                                           |
| `ExpenditureChartCard.dc.html`  | The expenditure chart card: LineChart with the likely range band               |
| `ProgramEditScreen.dc.html`     | Edit programme                                                                 |
| `TargetsScreen.dc.html`         | Targets while a programme runs, and switching to your own                      |
| `MoreScreen.dc.html`            | More with the Programme row                                                    |
| `DiaryScreen.dc.html`           | The M4 diary with the optional check-in toast                                  |
| `SetupScreen.dc.html`           | The setup wizard's screen with the measured estimate state added               |
| `ProgramKit.dc.html`            | The summary card parts, the settling rows, and every guardrail and reason line |

Boards. Each lays out one component's states, dark and light. The board headings are in `canvas.json`.

| File                                     | Board heading                   |
| ---------------------------------------- | ------------------------------- |
| `more.program-row.dc.html`               | more · program-row              |
| `program.default.dc.html`                | program: default                |
| `program.settling.dc.html`               | program: settling               |
| `program.no-program.dc.html`             | program: no-program             |
| `program.loading.dc.html`                | program: loading                |
| `program.error.dc.html`                  | program: error                  |
| `checkin-summary.measured.dc.html`       | checkin-summary: measured       |
| `checkin-summary.guardrail.dc.html`      | checkin-summary: guardrail      |
| `checkin-summary.not-measured.dc.html`   | checkin-summary: not-measured   |
| `program-explainer.how-it-works.dc.html` | program-explainer: how it works |
| `expenditure-chart.default.dc.html`      | expenditure-chart: default      |
| `expenditure-chart.few-points.dc.html`   | expenditure-chart: few-points   |
| `expenditure-chart.empty.dc.html`        | expenditure-chart: empty        |
| `program-edit.default.dc.html`           | program-edit: default           |
| `program-edit.under-18.dc.html`          | program-edit: under-18          |
| `program-edit.saving.dc.html`            | program-edit: saving            |
| `program-edit.save-error.dc.html`        | program-edit: save-error        |
| `targets.engine.dc.html`                 | targets · engine                |
| `targets.switch-to-manual.dc.html`       | targets · switch-to-manual      |
| `diary.targets-updated.dc.html`          | diary · targets-updated         |
| `setup.estimate.measured.dc.html`        | setup: estimate · measured      |
| `program.components.dc.html`             | program: components             |

## Rulings behind the boards

- Zee's answers to Q1 to Q8 of 2026-10-23 shape the screens. They are recorded on [KEY-604](https://linear.app/sojisoft/issue/KEY-604) and in ADR 0002 Amendment 2:
  - The check-in day is the weekday of setup, with the first check-in two weeks later.
  - One catch-up per missed week.
  - An active programme's targets win and saving your own ends it.
  - The band is an 80% range.
- The eleven canvas answers, all as drawn:
  - The app says "Programme" (code and routes say "program").
  - The settling week carries the start estimate on the chart.
  - Expenditure in whole kcal with the range to the nearest 10.
  - The diary toast "Check-in done: new targets".
  - The switch-to-manual dialog in the primary tone.
  - Only the guardrail that set the number gets a line.
  - The Programme row in More under Targets.
  - The ChartLine icon.
  - The range shown while settling.
  - Edit programme as one form.
  - Back to Programme with "Targets saved" after an edit.
- Every number is the engine's output for the stated sample person. `program: default` is the golden fixture after its third check-in (2,140 kcal, P 126, C 245, F 73), and `checkin-summary: not-measured` is the gate's fewer-than-10-complete-days case.
- If code and a board disagree, the board wins unless Zee has ruled otherwise.
