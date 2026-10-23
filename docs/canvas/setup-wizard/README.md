# Setup wizard designs

The approved source of the canvas "Ki-Lo setup wizard", version 4, copied byte for byte. Zee approved it on 2026-10-23 ([KEY-603](https://linear.app/sojisoft/issue/KEY-603)): "Both canvases are approved, the setup wizard and the program, with all their recommended answers."

The published canvas is <https://claude.ai/artifact/64kr6Ufp2LTXvSEntRdDL1>. These files are what it holds, so an engineer can read every board without an account on the design tool. There are no rendered PNG or HTML pages here. Read the `.dc.html` files as markup: the layout, the tokens (`var(--surface)`, `var(--space-4)` and the rest, defined in [`packages/tokens/css/kilo-tokens.css`](../../../packages/tokens/css/kilo-tokens.css)) and every string are in them. The notes in `canvas.json` hold the copy, behaviour, accessible names and arithmetic for each row of boards.

## Files

Components. Each has a `screenState` (or `theme` only) prop, and its states are listed in the `data-props` enum at the end of the file.

| File                    | What it draws                                         |
| ----------------------- | ----------------------------------------------------- |
| `SetupScreen.dc.html`   | Every step of the wizard, the estimate and its states |
| `TargetsScreen.dc.html` | The Targets screen with the "Estimate my targets" row |
| `SetupKit.dc.html`      | The new OptionCard in each state, and the step header |

Boards. Each lays out one component's states, dark and light. The board headings are in `canvas.json`.

| File                                 | Board heading                 |
| ------------------------------------ | ----------------------------- |
| `setup.about-you.sex.dc.html`        | setup: about you · sex        |
| `setup.about-you.birth-date.dc.html` | setup: about you · birth-date |
| `setup.about-you.body.dc.html`       | setup: about you · body       |
| `setup.activity.dc.html`             | setup: activity               |
| `setup.goal.default.dc.html`         | setup: goal · default         |
| `setup.goal.under-18.dc.html`        | setup: goal · under-18        |
| `setup.rate.lose.dc.html`            | setup: rate · lose            |
| `setup.rate.gain.dc.html`            | setup: rate · gain            |
| `setup.macros.protein.dc.html`       | setup: macros · protein       |
| `setup.macros.diet.dc.html`          | setup: macros · diet          |
| `setup.estimate.default.dc.html`     | setup: estimate · default     |
| `setup.estimate.guardrail.dc.html`   | setup: estimate · guardrail   |
| `setup.estimate.saving.dc.html`      | setup: estimate · saving      |
| `setup.estimate.save-error.dc.html`  | setup: estimate · save-error  |
| `setup.entry.targets-row.dc.html`    | setup: entry · targets-row    |
| `setup.entry.recalculate.dc.html`    | setup: entry · recalculate    |
| `setup.components.dc.html`           | setup: components             |

## Rulings behind the boards

- Zee's ten setup answers of 2026-10-23 decide the steps: sex (female, male, prefer not to say, stored as `other`), date of birth, height and weight, one activity question, goal, rate (skipped for maintain), protein, diet style, then the estimate. They are recorded on [KEY-594](https://linear.app/sojisoft/issue/KEY-594) and in ADR 0002 Amendment 1.
- The six canvas answers, all as drawn:
  - The birth date is three typed fields.
  - Under 18, Lose is shown disabled with its reason.
  - The default rate is marked "Suggested".
  - No stones.
  - Close in recalculate needs no confirm.
  - First run lands on the Diary with no toast.
- The estimate board draws two accuracy lines. The first is live until M6's weekly check-in ships, the second after it.
- Every number on the boards is the engine's output for the stated sample person, worked in the notes.
- If code and a board disagree, the board wins unless Zee has ruled otherwise.
