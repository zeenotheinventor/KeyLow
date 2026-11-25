# Password reset and change designs

The approved source of the canvas "Ki-Lo password reset and change", copied byte for byte. Zee approved it on 2026-11-25 ([KEY-1112](https://linear.app/sojisoft/issue/KEY-1112)): "approved".

The published canvas is <https://claude.ai/artifact/CJXvS6JHM4t2QVoeiKBMLc>. These files are what it holds, so an engineer can read every board without an account on the design tool. There are no rendered PNG or HTML pages here, and no token stylesheet or uploaded images. Read the `.dc.html` files as markup: the layout, the tokens (`var(--surface)`, `var(--space-4)` and the rest, defined in [`packages/tokens/css/kilo-tokens.css`](../../../packages/tokens/css/kilo-tokens.css)) and every string are in them. The notes in `canvas.json` hold the copy and behaviour for each row of boards. The state tables and strings are in `renderVals()` of the component files, and the `data-kilo` attributes name the kit part of each element.

## Files

Components. Each has a `screenState` and a `theme` prop, and its states are listed in the `data-props` enum at the end of the file.

| File                        | What it draws                                                                                                                                           |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PasswordScreen.dc.html`    | The mobile auth states: sign-in-forgot, forgot, forgot-field-error, forgot-sending, forgot-error, forgot-sent, reset-link-error, and the set-new states |
| `AccountScreen.dc.html`     | The More account group and the Change password states                                                                                                   |
| `WebPasswordScreen.dc.html` | Every web state, at 1280 and 375                                                                                                                        |

Boards. Each lays out one component's states, dark and light (the web boards add 375 wide). The board headings are in `canvas.json`.

| File                                         | Board heading                                                        |
| -------------------------------------------- | -------------------------------------------------------------------- |
| `Main.dc.html`                               | auth · sign-in-forgot-link                                           |
| `auth.forgot-password.dc.html`               | auth · forgot-password                                               |
| `auth.forgot-password-field-error.dc.html`   | auth · forgot-password-field-error                                   |
| `auth.forgot-password-sending.dc.html`       | auth · forgot-password-sending                                       |
| `auth.forgot-password-sent.dc.html`          | auth · forgot-password-sent                                          |
| `auth.forgot-password-error.dc.html`         | auth · forgot-password-error                                         |
| `auth.reset-link-error.dc.html`              | auth · reset-link-error                                              |
| `auth.set-new-password.dc.html`              | auth · set-new-password                                              |
| `auth.set-new-password-field-errors.dc.html` | auth · set-new-password-field-errors                                 |
| `auth.set-new-password-saving.dc.html`       | auth · set-new-password-saving                                       |
| `auth.set-new-password-error.dc.html`        | auth · set-new-password-error                                        |
| `auth.set-new-password-saved.dc.html`        | auth · set-new-password-saved                                        |
| `more.account.dc.html`                       | more · account (email account)                                       |
| `more.account-google-only.dc.html`           | more · account-google-only                                           |
| `more.change-password.dc.html`               | more · change-password                                               |
| `more.change-password-field-errors.dc.html`  | more · change-password-field-errors                                  |
| `more.change-password-saving.dc.html`        | more · change-password-saving                                        |
| `more.change-password-error.dc.html`         | more · change-password-error                                         |
| `more.change-password-saved.dc.html`         | more · change-password-saved                                         |
| `web.login-forgot-link.dc.html`              | web · login-forgot-link · 1280 dark, 1280 light, 375 dark, 375 light |
| `web.forgot-password.dc.html`                | web · forgot-password                                                |
| `web.forgot-password-field-error.dc.html`    | web · forgot-password-field-error                                    |
| `web.forgot-password-error.dc.html`          | web · forgot-password-error                                          |
| `web.forgot-password-sent.dc.html`           | web · forgot-password-sent                                           |
| `web.reset-link-error.dc.html`               | web · reset-link-error                                               |
| `web.set-new-password.dc.html`               | web · set-new-password                                               |
| `web.set-new-password-field-errors.dc.html`  | web · set-new-password-field-errors                                  |
| `web.set-new-password-error.dc.html`         | web · set-new-password-error                                         |
| `web.set-new-password-saved.dc.html`         | web · set-new-password-saved                                         |
| `web.more-account.dc.html`                   | web · more-account (email account)                                   |
| `web.more-account-google-only.dc.html`       | web · more-account-google-only                                       |
| `web.change-password.dc.html`                | web · change-password                                                |
| `web.change-password-error.dc.html`          | web · change-password-error                                          |
| `web.change-password-saved.dc.html`          | web · change-password-saved                                          |

## Rulings behind the boards

Zee's decisions of 2026-11-25, recorded in the last comment on [KEY-1112](https://linear.app/sojisoft/issue/KEY-1112). The canvas's open questions stand as drawn:

- Change password asks for the new password twice and has no Current password field. The api-client can add one later without changing callers.
- Other devices are signed out after a reset or a change.
- A Google-only person who uses Forgot password can set a password, which adds email sign-in. The recovery email says Google sign-in still works.
- The recovery email carries a link only, with no code.

One copy change was made after drawing, and the canvas already shows it: the forgot screen says "Ki-Lo will send a link to set a new password.", because the voice test bans "we".

If code and a board disagree, the board wins unless Zee has ruled otherwise.
