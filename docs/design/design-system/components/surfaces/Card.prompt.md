Card is the basic container; pick its level by what it sits on so the surface stack stays legible.

```jsx
<Card title="Today">…</Card>
<Card level="raised" flourish={savedCount}>Entry added</Card>
```

Radius --radius-large, border --border, shadow --elevation-card. The flourish (kl-slash, --duration-flourish, --ease-exit) is reserved for moments: entry added, day complete, check-in applied. Pair with --haptic-confirm.
