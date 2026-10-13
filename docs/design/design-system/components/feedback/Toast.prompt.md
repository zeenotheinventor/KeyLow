Toast confirms a quick action and offers one undo; it sits above the tab bar.

```jsx
<Toast message="Entry deleted" actionLabel="Undo" onAction={undo} icon="Trash2" />
<Toast message="Entry added" tone="success" icon="Check" onClose={hide} />
```

kl-toast-in over --duration-standard with --ease-enter. --surface-sheet, --elevation-toast. One short sentence, no full stop, no exclamation mark. Action text is --accent.
