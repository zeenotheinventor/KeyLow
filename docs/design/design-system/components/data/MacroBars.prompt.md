MacroBars shows the three macros against target, each labelled, with the overflow printed in grams.

```jsx
<MacroBars protein={{eaten:142,target:160}} carbs={{eaten:231,target:220}} fat={{eaten:48.5,target:70}} />
```

Colours --protein, --carbs, --fat; over target uses --warning for the cap and the "+11 g" delta, never --danger. Grams: one decimal only under 10. Fills whip in (--ease-whip, --duration-chart) staggered by --stagger.
