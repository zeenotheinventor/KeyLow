EmptyState and ErrorState fill a view or card when there is nothing to show or the load failed.

```jsx
<EmptyState icon="BookOpen" title="Nothing logged yet" body="Add your first entry to start the day." actionLabel="Add entry" onAction={add} />
<ErrorState body="Your foods could not be loaded. Check your connection." onRetry={reload} />
```

Copy is direct and dry: a short title, one sentence, no exclamation marks. The action is a secondary Button. Both cut in once (kl-cut-in).
