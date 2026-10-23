# M5 body composition designs

The approved source of the canvas "Ki-Lo M5 screens", version 10, copied byte for byte. Zee approved it on 2026-10-23 ([KEY-575](https://linear.app/sojisoft/issue/KEY-575)). Version 10 adds body fat and lean mass to version 9, which Zee approved on 2026-10-18.

The published canvas is <https://claude.ai/artifact/5QqoJKy2c4G6tJewGRVoPK>. These files are what it holds, so an engineer can read every board without an account on the design tool. There are no rendered PNG or HTML pages here. Read the `.dc.html` files as markup: the layout, the tokens (`var(--surface)`, `var(--space-4)` and the rest, defined in [`packages/tokens/css/kilo-tokens.css`](../../../packages/tokens/css/kilo-tokens.css)) and every string are in them.

## Files

Components. Each has a `state` and a `theme` prop, and its states are listed in the `data-props` enum at the end of the file.

| File | What it draws |
| -- | -- |
| `WeightScreen.dc.html` | The Weight screen, including the Body composition section |
| `HealthAccessScreen.dc.html` | The Health Connect permission flow |
| `TrendExplainerSheet.dc.html` | The trend explainer sheet |
| `WeighInSheet.dc.html` | The weigh-in sheet (unchanged since version 9) |
| `BodyCompositionCard.dc.html` | One body fat or lean mass card |
| `BodyCompositionPrompt.dc.html` | The prompt cards (not allowed, no readings yet, partial, error) |

Boards. Each lays out one component's states, dark and light. The board headings are in `canvas.json`.

| File | Board heading |
| -- | -- |
| `Main.dc.html` | weight: chart and weigh-ins |
| `weigh-in-entry.dc.html` | weigh-in-entry: add and edit |
| `health-access.dc.html` | health-access: permissions flow |
| `trend-explainer.dc.html` | trend-explainer |
| `body-composition.dc.html` | body-composition: components |

## What version 10 added

- **weight: chart and weigh-ins**, body-composition states: `chart`, `settling`, `no-readings-yet`, `not-allowed`, `partial`, `loading`, `error` and `one-range-empty`.
- **health-access: permissions flow**:
  - Changed: `explain`, `connecting` and `connected`.
  - New: `explain · end`, `explain · body-composition`, `denied · body-composition` and `connected · partial`.
- **trend-explainer**: a "Body fat and lean mass" section, and a settling state scrolled to the end.
- **body-composition: components**: the card and the prompt in each of their states.

The `explain-end` and `settling-end` states exist only to show scrolled content on a board. They are not app states.

## Rulings behind the boards

- Health Connect only. Body fat % and lean mass in kg are imported, never typed.
- Each kind has a smoothed trend that settles after 7 readings. The change is shown over the range picked on the weight chart's range control.
- Labels say "lean mass", not "muscle". The caption "Lean mass includes bone and water as well as muscle." explains the difference.
- If code and a board disagree, the board wins unless Zee has ruled otherwise. Rulings are recorded on [KEY-5](https://linear.app/sojisoft/issue/KEY-5).
