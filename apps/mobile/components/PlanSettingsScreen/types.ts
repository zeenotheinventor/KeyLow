import type { OptionCardGroupOption } from "../ui";

/** One answer of the repeat limit question as the option group draws it. Its id is the number the profile stores, as text (`"0"` is No limit). */
export type RepeatLimitAnswer = OptionCardGroupOption<string>;
