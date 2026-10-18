/**
 * A bias-corrected EWMA, fed one calendar day at a time. With `S_t = (1 - alpha) * S_(t-1) + alpha * u_t`
 * and `S_(-1) = 0`, the trend is `S_t / (1 - (1 - alpha)^(t + 1))`, so day 0 equals the first value
 * with no warm-up. This is the same number written as a step from the previous trend:
 * `trend_t = trend_(t-1) + (u_t - trend_(t-1)) * alpha / (1 - (1 - alpha)^(t + 1))`. The step form
 * reproduces a constant input exactly, where dividing `S_t` by the correction does not, because
 * `u_t - trend_(t-1)` is exactly zero.
 */
export function createTrendSmoother(alpha: number): (usedKg: number) => number {
  let trendKg = 0;
  let days = 0;

  return (usedKg) => {
    if (days === 0) {
      trendKg = usedKg;
    } else {
      trendKg += ((usedKg - trendKg) * alpha) / (1 - (1 - alpha) ** (days + 1));
    }
    days += 1;
    return trendKg;
  };
}
