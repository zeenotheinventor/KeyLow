TabBar is the root navigation: Diary, Foods, Recipes, Weight, Settings.

```jsx
<TabBar active={tab} onChange={setTab} platform="ios" />
```

iOS: --tab-bar-height (49) plus safe area, accent tint, a skewed accent underline that slides with --ease-spring over --duration-quick. Android: 64 tall on --surface-raised with an --accent-muted active pill. Tab content changes with kl-wipe-in (angled wipe). Haptic --haptic-select.
