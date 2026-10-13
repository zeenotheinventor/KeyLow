DayStepper sits at the top of the Diary and moves between days; the label cuts in with an angled wipe.

```jsx
<DayStepper date={date} onChange={setDate} onPickDate={() => setSheet(true)} />
```

Labels: Today, Yesterday, then "Mon 6 Oct". Stepping past today is disabled. Buttons are 44 pt. Haptic --haptic-select per step.
