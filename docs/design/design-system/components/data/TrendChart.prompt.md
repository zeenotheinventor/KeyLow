TrendChart plots weigh-ins and the smoothed trend; it uses only the chart tokens.

```jsx
<TrendChart title="Trend weight" unit="kg" data={weighIns} range={30} />
```

Tokens: --chart-axis, --chart-grid, --chart-point (r 2.5), --chart-trend (2.5 px), --chart-band, --chart-marker. The trend draws in with kl-draw over --duration-chart (--ease-whip); points fade in. Changing the range re-draws the curve. The delta line is labelled "est.".
