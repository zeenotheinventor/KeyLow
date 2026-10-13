DayCompleteToggle marks a diary day complete so the engine can use it; IncompleteDaysChip reports the week.

```jsx
<DayCompleteToggle complete={done} onChange={setDone} />
<IncompleteDaysChip count={3} onPress={showWeek} />
```

Completing is a moment: kl-slash + kl-punch (--duration-flourish) and --haptic-complete (firm double). Unmarking is quiet. The chip is warning-toned while n > 0, success when 0; the count is in the text.
