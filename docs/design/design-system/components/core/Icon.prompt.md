Icon renders a Lucide glyph at a token size; use it wherever a component takes an icon slot.

```jsx
<script src="https://unpkg.com/lucide@0.460.0/dist/umd/lucide.min.js"></script>
<Icon name="Flame" size="md" color="var(--text-secondary)" />
```

Sizes: sm/md/lg/xl map to --icon-sm…--icon-xl. Stroke is --icon-stroke (1.75). Decorative by default; pass `label` to expose it to screen readers.
