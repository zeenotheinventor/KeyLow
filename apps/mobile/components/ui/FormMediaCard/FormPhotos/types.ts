import type { FormMediaCardProps } from "../types";

export type FormPhotosProps = Extract<FormMediaCardProps, { kind: "photos" }>;
