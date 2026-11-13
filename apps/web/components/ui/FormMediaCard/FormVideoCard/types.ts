import type { FormMediaCardProps } from "../types";

export type FormVideoCardProps = Extract<FormMediaCardProps, { kind: "video" }>;
