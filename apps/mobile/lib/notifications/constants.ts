/** Every reminder this app schedules has an identifier that starts with this, so it can find its own. */
export const reminderIdentifierPrefix = "keylow-reminder:";

export const reminderChannelId = "reminders";
export const reminderChannelName = "Reminders";

export const achievementsChannelId = "achievements";
export const achievementsChannelName = "Badges and levels";

/** Every unlock notification this app posts has an identifier that starts with this, so a tap can be told from another app's. */
export const unlockIdentifierPrefix = "keylow-unlock:";

/** The streak nudge has its own prefix, so replacing the reminders never touches it and the reverse. */
export const streakNudgeIdentifierPrefix = "keylow-streak-nudge:";
