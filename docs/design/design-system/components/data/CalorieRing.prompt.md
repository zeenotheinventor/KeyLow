CalorieRing is the Diary hero: remaining calories as a display numeral inside a ring that fills eaten/target.

```jsx
<CalorieRing eaten={1850} target={2400} />
<CalorieRing eaten={2650} target={2400} size={160} />
```

Fill: --calories, track --border, whips in with --ease-whip over --duration-chart. Over target: keeps filling in --warning on top (never resets, never --danger); the numeral turns warning and reads "over target". The numeral counts up over --duration-flourish and flashes --accent (kl-flash). Calories are whole numbers.
