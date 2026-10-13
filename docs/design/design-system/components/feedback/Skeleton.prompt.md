Skeleton stands in for content that is loading; it only appears after 200 ms so quick loads never flicker.

```jsx
<Skeleton variant="row" />
<Skeleton variant="ring" width={200} />
<Skeleton lines={3} />
```

Bones use --skeleton-base with a --skeleton-shine shimmer (kl-shimmer, 1400 ms linear). Match the shape of the content it replaces.
