ListRow is the diary and food-list row: icon, title, optional subtitle, a tabular trailing value and a chevron when it navigates.

```jsx
<ListRow icon="Egg" title="Greek yoghurt" subtitle="170 g · Fage" value="165" unit="kcal" source="off" onPress={open} />
<ListRow icon="Flame" title="Expenditure" subtitle="Estimate" value="2,480" unit="kcal" chevron={false} />
```

Min height 56. Rows cut in with kl-cut-in staggered by --stagger when `animate`. Delete is swipe-to-delete (`revealDelete`) followed by an Undo Toast, never a confirm dialog.
