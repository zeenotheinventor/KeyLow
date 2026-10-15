/** The IANA time zone of the device, such as "Europe/London". The diary has no profile zone to read yet. */
export const deviceTimeZone = (): string => Intl.DateTimeFormat().resolvedOptions().timeZone;
