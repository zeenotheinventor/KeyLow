Button is the only action control: primary for the single main action on a view, secondary for everything else, destructive only for irreversible actions, ghost inside dense surfaces.

```jsx
<Button variant="primary" onClick={save}>Add entry</Button>
<Button variant="secondary" size="lg" fullWidth>Scan barcode</Button>
<Button variant="destructive" loading>Delete account</Button>
<Button variant="ghost" icon={<Icon name="Plus" size="sm" />}>Add portion</Button>
```

Motion: compresses to --press-scale on press, releases with --ease-spring over --duration-instant. Hover adds --hover-overlay. Focus ring is --focus-ring with a --focus-ring-offset gap. Labels are short, sentence case, no full stop, no exclamation marks.
