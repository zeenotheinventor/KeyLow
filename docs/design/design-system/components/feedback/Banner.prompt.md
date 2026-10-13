Banner carries a persistent, in-flow notice: review for foods with missing nutrition data, offline when writes are unavailable.

```jsx
<Banner variant="review" actionLabel="Review" onAction={review} />
<Banner variant="offline" />
```

Review is warning-toned (--warning, --warning-muted), never danger. Offline is neutral and quiet: "Offline. Showing saved data. Changes will not save." and the save button is disabled. Cuts in with kl-cut-in.
