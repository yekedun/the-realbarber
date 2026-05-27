export const SLOT_GRANULARITY_MIN = 15;

export const DEFAULT_TIMEZONE = "Europe/Istanbul";

export const BOOKING_GRACE_PERIOD_MIN = 5;

export const MIN_BOOKING_NOTICE_MINUTES = 60; // 1 saat
export const MAX_BOOKING_DAYS = 30; // 30 gün
export const MIN_CANCEL_NOTICE_MINUTES = 30; // 30 dakika



export const DEFAULT_WORKING_HOURS = {
  mon: { open: "09:00", close: "19:00", enabled: true },
  tue: { open: "09:00", close: "19:00", enabled: true },
  wed: { open: "09:00", close: "19:00", enabled: true },
  thu: { open: "09:00", close: "19:00", enabled: true },
  fri: { open: "09:00", close: "19:00", enabled: true },
  sat: { open: "09:00", close: "17:00", enabled: true },
  sun: { open: null, close: null, enabled: false },
} as const;

export const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAY_KEYS)[number];
