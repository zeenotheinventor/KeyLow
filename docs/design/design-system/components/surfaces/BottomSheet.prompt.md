BottomSheet hosts a focused task (pick a portion, log weight, choose a meal) above the current screen.

```jsx
<BottomSheet open={open} onClose={() => setOpen(false)} title="Log weight">…</BottomSheet>
```

Surface --surface-sheet, top radius --radius-large, --elevation-sheet, handle 36×4 in --border-strong. Enter: kl-sheet-up, --duration-flourish, --ease-spring; dim kl-dim-in. Exit: kl-sheet-down, --duration-standard, --ease-exit. Haptic --haptic-select on open. Bottom padding includes the safe area.
