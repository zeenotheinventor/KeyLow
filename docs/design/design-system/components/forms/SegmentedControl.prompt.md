SegmentedControl picks one of 2–5 short options (meal, portion basis, chart range).

```jsx
<SegmentedControl options={[{value:'b',label:'Breakfast'},{value:'l',label:'Lunch'},{value:'d',label:'Dinner'},{value:'s',label:'Snacks'}]} value={meal} onChange={setMeal} />
```

Motion: the highlight translates to the new segment over --duration-standard with --ease-spring, skewed -10° while moving, straightening on settle (kl-skew-settle). Haptic --haptic-select on change. Selection state changes immediately; the highlight catches up.
