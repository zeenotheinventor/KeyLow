# Delete account designs

The approved source of the canvas "Ki-Lo delete account", copied byte for byte. Zee approved it on 2026-11-24 ([KEY-1120](https://linear.app/sojisoft/issue/KEY-1120)): "canvas approved, all choices as drawn".

The published canvas is <https://claude.ai/artifact/ECqFQpaW7ZHHSGLarUPfTe>. These files are what it holds, so an engineer can read every board without an account on the design tool. There are no rendered PNG or HTML pages here. Read the `.dc.html` files as markup: the layout, the tokens (defined in [`packages/tokens/css/kilo-tokens.css`](../../../packages/tokens/css/kilo-tokens.css)) and every string are in them. The notes in `canvas.json` hold the copy, behaviour, accessible names and the choices for each row of boards. The tickets are [KEY-1117](https://linear.app/sojisoft/issue/KEY-1117) (delete your account from inside the app) and [KEY-1128](https://linear.app/sojisoft/issue/KEY-1128) (the mobile screens).

## Files

Components. Each has a state prop (`screenState`) and a `theme` prop, and its states are listed in the `data-props` enum at the end of the file.

| File                          | What it draws                                                                    |
| ----------------------------- | -------------------------------------------------------------------------------- |
| `MoreScreen.dc.html`          | More with the Delete account row last in Account                                 |
| `DeleteAccountScreen.dc.html` | The Delete account screen, its confirm step and the two ways an attempt can fail |
| `SignInScreen.dc.html`        | Sign in with the confirmation that the account was deleted                       |

Boards. Each lays out one component's state, dark and light. The board titles are in `canvas.json`.

| File                                            | Board title                             |
| ----------------------------------------------- | --------------------------------------- |
| `Main.dc.html`                                  | tab-shell.more · delete-account-row     |
| `delete-account.explain.dc.html`                | delete-account · explain                |
| `delete-account.explain-offline.dc.html`        | delete-account · explain-offline        |
| `delete-account.confirm.dc.html`                | delete-account · confirm                |
| `delete-account.confirm-password.dc.html`       | delete-account · confirm-password       |
| `delete-account.confirm-password-wrong.dc.html` | delete-account · confirm-password-wrong |
| `delete-account.deleting.dc.html`               | delete-account · deleting               |
| `delete-account.failed.dc.html`                 | delete-account · failed                 |
| `delete-account.unconfirmed.dc.html`            | delete-account · unconfirmed            |
| `sign-in.account-deleted.dc.html`               | sign-in · account-deleted               |

The two password boards (`confirm-password` and `confirm-password-wrong`) wait for [KEY-1111](https://linear.app/sojisoft/issue/KEY-1111), the forgotten password flow. Until it lands every account gets `confirm`.

## Choices approved as drawn

- The row sits last in the Account group, after Sign out.
- The confirm is the shipped destructive dialog with two buttons and no typed word.
- The explain list is eight lines by area.
- Sign in confirms with a success banner, not a toast.
- The explain card carries one caption about the two 30-day exceptions in the Privacy Policy.
- While deleting, the dialog's title and body change.
- A failure closes the dialog and shows as an error banner on the screen. Try again opens the confirm again.
- `Forgot password?` in the confirm closes it and opens Reset your password with the email filled in.
- The password is checked when Delete account is pressed.
- Sign in keeps its heading, Welcome back, after a deletion.
- Keep my account says my, as Export my data does.
- On the screen Delete account is the filled destructive button, and in the dialog it is the secondary button with danger words.
- When the answer never comes back, a warning banner says Ki-Lo could not confirm the deletion. Try again repeats the request with no second confirm, and the other button says Back to More.

If code and a board disagree, the board wins unless Zee has ruled otherwise.
