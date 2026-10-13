# Ki-Lo screen designs

The approved designs for the M2 screens, kept in source control so that any engineer can read them without an account on the design tool and without running anything deployed. Nothing here is hosted. There is no gallery site and no preview deployment, and none is planned. The files exist to help engineers (and Zee) look at a design before it is built.

## Where the designs come from

The designs were drawn on a design canvas called "Ki-Lo M2 screens", from the briefs and rulings in the design conformance plan. Zee reviewed and approved the boards on 2026-10-13. This folder holds that approved canvas, exported:

- `source/` is the canvas source, copied byte for byte. Nothing in it is edited here.
- `<screen>/` holds one PNG and one standalone HTML page per board, and a README with the decisions behind the screen.
- `design-system/` is a verbatim snapshot of the Ki-Lo design system the boards are built from.
- `tokens/kilo-tokens.css` is the stylesheet every HTML page links.

The boards are the source of truth for layout and behaviour in M2. If code and a board disagree, the board wins unless Zee has ruled otherwise. A change to a board goes back to Zee before it is built.

## How to read a design

**On GitHub.** Open a screen folder, such as [`food-search/`](food-search/README.md). Its README lists every board in order with the image inline, the board's title and the decisions behind the screen.

**Locally, as real HTML.** Clone the repository and open any `<screen>/<state>.html` in a browser. Each page is the rendered board with no script and no runtime. Open the browser inspector on any element to see:

- token references in the inline styles, such as `var(--surface)`, `var(--space-4)` and `var(--type-h2-size)`, which are defined in `tokens/kilo-tokens.css`
- a `data-kilo` attribute on design system components and proposed additions, such as `Button secondary icon` or `SearchField (proposed)`
- a `data-screen` attribute on each frame, naming the canvas component it came from, such as `FoodSearchScreen`

A page loads Geist from Google Fonts and nothing else from the network. Offline it falls back to the system font, so spacing will not match the PNG exactly.

## What a board shows

Every board is the whole canvas board, with all of its frames side by side on a grey background:

- **Mobile boards** are 820 by 844. The frames are 390 by 844 points, dark on the left and light on the right.
- **Web boards** are 3430 by 812. The frames are 1280 dark, 1280 light, 375 dark and 375 light, from left to right.

The PNGs are rendered at device pixel ratio 2, so a mobile board is 1640 by 1688 and a web board is 6860 by 1624.

## Naming

A board is `<screen>/<state>`, taken from the canvas file name. `food-search.results-with-off.dc.html` becomes `food-search/results-with-off.png` and `food-search/results-with-off.html`. The screens are:

| Screen                                   | What it is                                                                    |
| ---------------------------------------- | ----------------------------------------------------------------------------- |
| [`food-search`](food-search/README.md)   | Mobile food search sheet. The board `idle` is the canvas file `Main.dc.html`. |
| [`tab-shell`](tab-shell/README.md)       | Mobile tab bar, placeholders and the session cover.                           |
| [`food-detail`](food-detail/README.md)   | Mobile food detail.                                                           |
| [`food-form`](food-form/README.md)       | Mobile food form: new, copy and edit.                                         |
| [`barcode-scan`](barcode-scan/README.md) | Mobile barcode scanner.                                                       |
| [`auth`](auth/README.md)                 | Mobile sign in and sign up.                                                   |
| [`web`](web/README.md)                   | Web login and app shell.                                                      |
| [`web-foods`](web-foods/README.md)       | Web Foods page: search, barcode lookup, your foods.                           |
| [`web-food`](web-food/README.md)         | Web food detail and food form.                                                |

There are 115 boards. A state with `proposal` in its name (`history-proposal`, `quantity-proposal-m3`, `label-scan-proposal-m3`) is a labelled proposal for M3 and is not built in M2. The component files (`*Screen.dc.html`) hold the markup for a screen's states and are not boards. They stay in `source/project/`.

## The token chain

Tokens flow in one direction. Each step is generated from or copied from the one before it.

1. **The Ki-Lo design system in Claude Design** is the source of record.
2. **The `design-source` snapshot** is a read-only copy of it, committed here as `design-system/`. Its `SNAPSHOT.md` says what was copied and what was left out.
3. **`packages/tokens`** carries the tokens in code (ticket KEY-83), and also emits a CSS file of them.
4. **These exports** link a CSS file by relative path rather than carrying a copy in every page.

Until KEY-83 merges, step 4 links `tokens/kilo-tokens.css`. That is the design system's `colors.css`, `typography.css`, `spacing.css` and `motion.css` joined verbatim, followed by a short block of canvas-only proposals, marked in the file. KEY-83 repoints the pages at the `packages/tokens` CSS.

## How to re-export after a design change

The exports are generated by [`tools/design-export`](../../tools/design-export/README.md). A design change is made on the canvas and approved first. Then:

1. Copy the updated canvas source folder somewhere on your machine. It holds `project/`, `tokens/` and `brand/`.
2. Get the canvas runtime file (`dc-runtime.js`). It is third-party code used only to render. Never copy it into this repository.
3. Run the export, passing the three paths (the README of the tool has the full command and the one-off browser install).
4. Run the verify script, which opens every page from disk and compares it with its PNG.
5. Write the decisions behind any new or changed board into its screen README, below the generated list. The export rewrites only the part between the markers and leaves your text alone.
6. Commit the result.

## Rules for this folder

- Do not edit anything under `source/` or `design-system/` by hand. They are verbatim copies.
- Do not commit the canvas runtime, and do not link to the hosted canvas from here.
- Do not deploy this folder or add a site for it.
