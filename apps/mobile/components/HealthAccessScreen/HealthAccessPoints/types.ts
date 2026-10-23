export type HealthAccessPoint = Readonly<{ title: string; text: string }>;

export type HealthAccessPointsProps = {
  points: readonly HealthAccessPoint[];
};
