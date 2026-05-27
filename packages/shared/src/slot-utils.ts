import {
  SLOT_GRANULARITY_MIN,
  MIN_BOOKING_NOTICE_MINUTES,
  MAX_BOOKING_DAYS,
  DAY_KEYS,
} from "./constants.ts";
import type { OccupiedRange, Slot, WorkingHours } from "./types.ts";

export function computeAvailableSlots(params: {
  date: Date;
  durationMin: number;
  workingHours: WorkingHours;
  occupied: OccupiedRange[];
  timezone: string;
  bufferMin?: number;
}): Slot[] {
  const { date, durationMin, workingHours, occupied, timezone, bufferMin = 0 } =
    params;

  const dayKey = DAY_KEYS[date.getDay()];
  if (!dayKey) return [];

  const hours = workingHours[dayKey];
  if (!hours?.enabled || !hours.open || !hours.close) return [];

  const openTs = localTimeToUTC(date, hours.open, timezone);
  const closeTs = localTimeToUTC(date, hours.close, timezone);
  const closeMs = closeTs.getTime();
  if (closeMs <= openTs.getTime()) return [];

  // F-10: buffer'ı occupied map'i oluştururken bir kez uygula; loop'ta new Date yok.
  const bufferMs = bufferMin * 60_000;
  const occupiedMs = occupied.map((r) => ({
    start: new Date(r.starts_at).getTime() - bufferMs,
    end: new Date(r.ends_at).getTime() + bufferMs,
  }));

  const slots: Slot[] = [];
  const nowMs = Date.now();
  const minAllowedMs = nowMs + MIN_BOOKING_NOTICE_MINUTES * 60_000;
  const maxAllowedMs = nowMs + MAX_BOOKING_DAYS * 24 * 60 * 60 * 1000;

  const durationMs = durationMin * 60_000;
  // Step = service duration so adjacent slots don't pre-overlap.
  // Floor to SLOT_GRANULARITY_MIN to keep round times when service < granularity.
  const stepMs = Math.max(SLOT_GRANULARITY_MIN * 60_000, durationMs);

  let cursorMs = openTs.getTime();

  while (cursorMs + durationMs <= closeMs) {
    const slotEndMs = cursorMs + durationMs;

    // Check if slot falls within allowed booking window
    if (cursorMs >= minAllowedMs && cursorMs <= maxAllowedMs) {
      const available = !occupiedMs.some(
        (o) => cursorMs < o.end && slotEndMs > o.start
      );
      slots.push({
        startsAt: new Date(cursorMs),
        endsAt: new Date(slotEndMs),
        available,
      });
    }

    cursorMs += stepMs;
  }

  return slots;
}

export function getDayBoundsUTC(
  date: Date,
  timezone: string
): { start: Date; end: Date } {
  const nextDay = new Date(date);
  nextDay.setDate(nextDay.getDate() + 1);

  return {
    start: localTimeToUTC(date, "00:00", timezone),
    end: localTimeToUTC(nextDay, "00:00", timezone),
  };
}

/**
 * Belirli bir takvim gününde, belirli bir timezone'da, belirli bir saatin (HH:mm)
 * UTC karşılığını hesaplar. DST geçişlerinde de doğru çalışır.
 *
 * Strateji: Önce o saati naif olarak UTC kabul et, sonra o UTC anında
 * timezone'un yerel saatini Intl ile oku, fark kadar düzelt.
 */
// F-2J: Intl.DateTimeFormat constructor pahalı (~100-500µs). Module-level cache.
const MAX_TZ_CACHE = 50;
const tzFormatterCache = new Map<string, Intl.DateTimeFormat>();
function getTzFormatter(timezone: string): Intl.DateTimeFormat {
  let f = tzFormatterCache.get(timezone);
  if (!f) {
    if (tzFormatterCache.size >= MAX_TZ_CACHE) {
      const firstKey = tzFormatterCache.keys().next().value;
      if (firstKey !== undefined) tzFormatterCache.delete(firstKey);
    }
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
    tzFormatterCache.set(timezone, f);
  }
  return f;
}

function localTimeToUTC(date: Date, time: string, timezone: string): Date {
  const [hStr, mStr] = time.split(":");
  const h = Number(hStr);
  const m = Number(mStr);

  const y = date.getFullYear();
  const mo = date.getMonth();
  const d = date.getDate();

  // Hedef yerel anı naif UTC olarak yorumla
  const naiveUTC = Date.UTC(y, mo, d, h, m, 0);

  // O UTC anında timezone yerel saati
  const parts = getTzFormatter(timezone).formatToParts(new Date(naiveUTC));
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");

  // Intl bazen 24 saati 24:xx olarak verir, normalize et
  const tzH = get("hour") % 24;
  const tzAsUTC = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    tzH,
    get("minute"),
    get("second")
  );

  // Offset: timezone yerel saati ile naif UTC arasındaki fark
  const offset = tzAsUTC - naiveUTC;

  // Naif UTC'yi offset kadar geri alarak gerçek UTC'yi bul
  return new Date(naiveUTC - offset);
}

export function formatSlotTime(date: Date, timezone: string): string {
  return date.toLocaleTimeString("tr-TR", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}
