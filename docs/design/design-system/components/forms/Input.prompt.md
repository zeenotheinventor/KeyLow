Input and NumericInput are the two form fields: labelled, with helper or error text; NumericInput right-aligns tabular digits and shows a unit suffix.

```jsx
<Input label="Name" placeholder="e.g. Greek yoghurt" helper="As it appears on the pack" />
<NumericInput label="Energy" unit="kcal" defaultValue="120" />
<NumericInput label="Protein" unit="g" error="Enter a number" />
```

Height is --control-height-md (44). Focus border is --accent plus the focus ring; error border is --danger. Disabled drops to 50 % opacity on --surface. Helper copy is one short sentence; error copy says what to do.
